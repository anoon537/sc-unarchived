const {
  ApiError,
  callSocialchat,
  parseBody,
  requireSameOrigin,
  validateCredentials,
} = require("../lib/socialchat");

const LABEL_ID = /^[A-Za-z0-9_-]{8,128}$/;

function unwrap(data) {
  let value = data;
  for (let depth = 0; depth < 3; depth += 1) {
    if (value?.data && !Array.isArray(value.data) && !value.docs)
      value = value.data;
    else break;
  }
  return value;
}

function normalizeLabel(label) {
  return {
    id: String(label?._id || label?.id || ""),
    name: typeof label?.name === "string" ? label.name : "",
    textColor:
      typeof label?.textColor === "string" ? label.textColor : "#17734f",
    backgroundColor:
      typeof label?.backgroundColor === "string"
        ? label.backgroundColor
        : "#eaf5ef",
    chatStageId: label?.chatStageId ?? null,
    automation: label?.automation ?? null,
  };
}

function getRows(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ["docs", "items", "results", "data"]) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  throw new ApiError("Format daftar label Socialchat tidak dikenali.", 502);
}

function labelPayload(body, existing = null) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const textColor =
    typeof body.textColor === "string" ? body.textColor.trim() : "";
  const backgroundColor =
    typeof body.backgroundColor === "string" ? body.backgroundColor.trim() : "";
  if (!name || name.length > 150)
    throw new ApiError("Nama label wajib diisi dan maksimal 150 karakter.");
  if (textColor.length > 100 || backgroundColor.length > 100)
    throw new ApiError("Nilai warna label tidak valid.");

  const payload = { name, textColor, backgroundColor };
  if (Object.hasOwn(body, "chatStageId"))
    payload.chatStageId = body.chatStageId;
  else if (existing?.chatStageId != null)
    payload.chatStageId = existing.chatStageId;
  if (Object.hasOwn(body, "automation")) payload.automation = body.automation;
  else if (existing?.automation != null)
    payload.automation = existing.automation;
  return payload;
}

function sendError(res, error) {
  const status = error instanceof ApiError ? error.status : 502;
  res
    .status(status)
    .json({
      error:
        error instanceof ApiError
          ? error.message
          : "Operasi label Socialchat gagal.",
    });
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method tidak diizinkan." });

  try {
    requireSameOrigin(req);
    const body = parseBody(req);
    const credentials = validateCredentials(body.credentials);
    const action = body.action;

    if (action === "list") {
      const page = Number(body.page || 1);
      if (!Number.isInteger(page) || page < 1 || page > 500)
        throw new ApiError("Nomor halaman label tidak valid.");
      const query = new URLSearchParams({
        page: String(page),
        limit: "500",
        search: "",
      });
      const result = await callSocialchat(
        `/api/label?${query}`,
        "GET",
        credentials,
      );
      const payload = unwrap(result.data);
      const rows = getRows(payload).map(normalizeLabel);
      const totalDocs = Number.isFinite(Number(payload?.totalDocs))
        ? Number(payload.totalDocs)
        : null;
      const totalPages = Number.isFinite(Number(payload?.totalPages))
        ? Number(payload.totalPages)
        : totalDocs === null
          ? null
          : Math.ceil(totalDocs / 500);
      const hasNextPage =
        typeof payload?.hasNextPage === "boolean"
          ? payload.hasNextPage
          : totalPages !== null
            ? page < totalPages
            : rows.length >= 500;
      return res
        .status(200)
        .json({
          rows,
          page,
          totalPages,
          hasNextPage,
          credentials: result.credentials,
        });
    }

    if (action === "create") {
      const result = await callSocialchat(
        "/api/label",
        "POST",
        credentials,
        labelPayload(body),
      );
      return res
        .status(200)
        .json({ ok: true, data: result.data, credentials: result.credentials });
    }

    const labelId = typeof body.id === "string" ? body.id.trim() : "";
    if (!LABEL_ID.test(labelId)) throw new ApiError("ID label tidak valid.");
    const path = `/api/label/${encodeURIComponent(labelId)}`;

    if (action === "update") {
      const result = await callSocialchat(
        path,
        "PUT",
        credentials,
        labelPayload(body),
      );
      return res
        .status(200)
        .json({ ok: true, data: result.data, credentials: result.credentials });
    }
    if (action === "delete") {
      const result = await callSocialchat(path, "DELETE", credentials);
      return res
        .status(200)
        .json({ ok: true, data: result.data, credentials: result.credentials });
    }

    throw new ApiError("Operasi label tidak dikenal.");
  } catch (error) {
    return sendError(res, error);
  }
};
