const {
  ApiError,
  callSocialchat,
  jakartaDate,
  parseBody,
  requireSameOrigin,
  validateCredentials,
  validateDateRange,
  verifyEntryProof,
} = require("../lib/socialchat");

function sendError(res, error) {
  const status = error instanceof ApiError ? error.status : 502;
  res.status(status).json({ error: error instanceof ApiError ? error.message : "Gagal menghubungi Socialchat." });
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  if (req.method !== "POST") return res.status(405).json({ error: "Method tidak diizinkan." });

  try {
    requireSameOrigin(req);
    const body = parseBody(req);
    let credentials = validateCredentials(body.credentials);
    const range = validateDateRange(body.fromDate, body.toDate);
    const nonce = typeof body.nonce === "string" ? body.nonce : "";
    const expiresAt = Number(body.expiresAt);
    const entries = body.entries;
    if (!/^[a-f0-9]{32,128}$/i.test(nonce)) throw new ApiError("Pratinjau tidak valid.");
    if (!Array.isArray(entries) || entries.length < 1 || entries.length > 5) {
      throw new ApiError("Setiap batch harus berisi 1 sampai 5 percakapan.");
    }

    let succeeded = 0;
    let failedStatus = null;
    for (const entry of entries) {
      if (typeof entry?.id !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(entry.id)) {
        throw new ApiError("ID percakapan tidak valid.");
      }
      if (!entry.lastMessageAt || typeof entry.proof !== "string") throw new ApiError("Data pratinjau tidak lengkap.");
      const localDate = jakartaDate(entry.lastMessageAt);
      if (!localDate || localDate < range.fromDate || localDate > range.toDate) {
        throw new ApiError("Ada percakapan di luar rentang tanggal yang dipilih.", 403);
      }
      verifyEntryProof(entry, range, nonce, expiresAt, entry.proof);

      try {
        const result = await callSocialchat(
          `/api/conversation/${encodeURIComponent(entry.id)}/archive`,
          "PUT",
          credentials,
          { isArchived: false },
        );
        credentials = result.credentials;
        succeeded += 1;
      } catch (error) {
        failedStatus = error instanceof ApiError ? error.status : 502;
        break;
      }
    }

    return res.status(failedStatus ? 207 : 200).json({
      succeeded,
      failed: entries.length - succeeded,
      stopped: Boolean(failedStatus),
      error: failedStatus === 401
        ? "Sesi Socialchat kedaluwarsa. Ambil token baru lalu buat pratinjau lagi."
        : failedStatus
          ? "Batch berhenti karena Socialchat menolak salah satu perubahan."
          : null,
      credentials,
    });
  } catch (error) {
    return sendError(res, error);
  }
};
