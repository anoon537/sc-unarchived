const { createHmac, timingSafeEqual } = require("node:crypto");

const API_ORIGIN = "https://api.socialchat.id";
const PAGE_SIZE = 100;
const MAX_PAGE = 500;
const JAKARTA_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

class ApiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      throw new ApiError("Format request tidak valid.");
    }
  }
  throw new ApiError("Request harus berisi JSON.");
}

function requireSameOrigin(req) {
  const origin = req.headers.origin;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (!origin || !host)
    throw new ApiError("Permintaan asal tidak diizinkan.", 403);
  try {
    if (new URL(origin).host !== host)
      throw new ApiError("Permintaan asal tidak diizinkan.", 403);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("Permintaan asal tidak diizinkan.", 403);
  }
}

function validateCredentials(value) {
  const accessToken =
    typeof value?.accessToken === "string" ? value.accessToken.trim() : "";
  const refreshToken =
    typeof value?.refreshToken === "string" ? value.refreshToken.trim() : "";
  if (!accessToken || accessToken.length > 10000)
    throw new ApiError("Access token Socialchat wajib diisi.");
  if (refreshToken.length > 10000)
    throw new ApiError("Refresh token tidak valid.");
  return { accessToken, refreshToken };
}

function validateDateRange(fromDate, toDate) {
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoDate.test(fromDate || "") || !isoDate.test(toDate || "")) {
    throw new ApiError(
      "Tanggal awal dan akhir wajib diisi dengan format yang valid.",
    );
  }
  const isRealDate = (value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  };
  if (!isRealDate(fromDate) || !isRealDate(toDate) || fromDate > toDate) {
    throw new ApiError("Rentang tanggal tidak valid.");
  }
  return { fromDate, toDate };
}

function jakartaDate(value) {
  if (typeof value !== "string" || !value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const parts = Object.fromEntries(
    JAKARTA_DATE.formatToParts(parsed).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function unwrapPayload(data) {
  let payload = data;
  for (let depth = 0; depth < 3; depth += 1) {
    if (
      payload &&
      payload.data &&
      !Array.isArray(payload.data) &&
      !payload.docs
    )
      payload = payload.data;
    else break;
  }
  return payload;
}

async function callSocialchat(path, method, credentials, body) {
  let currentCredentials = { ...credentials };
  const request = async (url, options) => {
    try {
      return await fetch(url, options);
    } catch (error) {
      const code = error?.cause?.code;
      if (
        [
          "EACCES",
          "ENETUNREACH",
          "ENOTFOUND",
          "ECONNREFUSED",
          "ETIMEDOUT",
        ].includes(code)
      ) {
        throw new ApiError(
          "Server lokal tidak dapat terhubung ke Socialchat. Jalankan website dari terminal lokal dengan akses internet.",
          502,
        );
      }
      throw new ApiError(
        "Koneksi ke Socialchat gagal. Periksa koneksi internet lalu coba lagi.",
        502,
      );
    }
  };
  const requestOptions = () => ({
    method,
    headers: {
      Authorization: `Bearer ${currentCredentials.accessToken}`,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
  });
  let response = await request(`${API_ORIGIN}${path}`, requestOptions());

  if (response.status === 401 && currentCredentials.refreshToken) {
    const refreshResponse = await request(
      `${API_ORIGIN}/api/auth/refresh-token`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${currentCredentials.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken: currentCredentials.refreshToken }),
        cache: "no-store",
      },
    );
    const refreshed = await refreshResponse.json().catch(() => null);
    if (
      !refreshResponse.ok ||
      !refreshed?.accessToken ||
      !refreshed?.refreshToken
    ) {
      throw new ApiError(
        "Sesi Socialchat kedaluwarsa. Ambil token baru dari akun Socialchat.",
        401,
      );
    }
    currentCredentials = {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
    };
    response = await request(`${API_ORIGIN}${path}`, requestOptions());
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const status =
      response.status === 401 ? 401 : response.status === 429 ? 429 : 502;
    throw new ApiError(
      status === 401
        ? "Sesi Socialchat tidak valid atau sudah kedaluwarsa."
        : status === 429
          ? "Socialchat membatasi permintaan. Tunggu sebentar lalu coba lagi."
          : "Permintaan ke Socialchat gagal. Periksa akun dan coba lagi.",
      status,
    );
  }
  return { data, credentials: currentCredentials };
}

function signingSecret() {
  const secret = process.env.UNARCHIVE_SIGNING_SECRET;
  if (!secret || secret.length < 16) {
    throw new ApiError(
      "Secret penandatangan belum dikonfigurasi di environment.",
      503,
    );
  }
  return secret;
}

function entryProof(entry, range, nonce, expiresAt) {
  return createHmac("sha256", signingSecret())
    .update(
      [
        entry.id,
        entry.lastMessageAt,
        range.fromDate,
        range.toDate,
        nonce,
        expiresAt,
      ].join("\n"),
    )
    .digest("hex");
}

function verifyEntryProof(entry, range, nonce, expiresAt, proof) {
  if (
    !Number.isSafeInteger(expiresAt) ||
    expiresAt < Date.now() ||
    expiresAt > Date.now() + 2 * 60 * 60 * 1000
  ) {
    throw new ApiError(
      "Pratinjau kedaluwarsa. Buat pratinjau baru sebelum melanjutkan.",
      409,
    );
  }
  if (typeof proof !== "string" || !/^[a-f0-9]{64}$/i.test(proof)) {
    throw new ApiError("Data pratinjau tidak valid. Buat pratinjau baru.", 403);
  }
  const expected = Buffer.from(
    entryProof(entry, range, nonce, expiresAt),
    "hex",
  );
  const received = Buffer.from(proof, "hex");
  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    throw new ApiError("Data pratinjau tidak valid. Buat pratinjau baru.", 403);
  }
}

async function getArchivePage(pageNumber, credentials) {
  const query = new URLSearchParams({
    page: String(pageNumber),
    limit: String(PAGE_SIZE),
    search: "",
  });
  const result = await callSocialchat(
    `/api/conversation/archive?${query}`,
    "GET",
    credentials,
  );
  const payload = unwrapPayload(result.data);
  const rows = Array.isArray(payload)
    ? payload
    : payload?.docs ||
      payload?.items ||
      payload?.results ||
      (Array.isArray(payload?.data) ? payload.data : null);
  if (!Array.isArray(rows))
    throw new ApiError(
      "Format daftar Arsip dari Socialchat tidak dikenali.",
      502,
    );
  return {
    rows,
    totalDocs:
      payload?.totalDocs != null && Number.isFinite(Number(payload.totalDocs))
        ? Number(payload.totalDocs)
        : null,
    totalPages:
      payload?.totalPages != null && Number.isFinite(Number(payload.totalPages))
        ? Number(payload.totalPages)
        : null,
    hasNextPage:
      typeof payload?.hasNextPage === "boolean" ? payload.hasNextPage : null,
    credentials: result.credentials,
  };
}

module.exports = {
  ApiError,
  signingSecret,
  callSocialchat,
  entryProof,
  getArchivePage,
  jakartaDate,
  parseBody,
  requireSameOrigin,
  validateCredentials,
  validateDateRange,
  verifyEntryProof,
  PAGE_SIZE,
  MAX_PAGE,
};
