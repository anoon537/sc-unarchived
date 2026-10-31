const {
  ApiError,
  signingSecret,
  entryProof,
  getArchivePage,
  jakartaDate,
  parseBody,
  requireSameOrigin,
  validateCredentials,
  validateDateRange,
  MAX_PAGE,
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
    signingSecret(); // Preview actions need a server-side signing secret.
    const body = parseBody(req);
    const credentials = validateCredentials(body.credentials);
    const range = validateDateRange(body.fromDate, body.toDate);
    const page = Number(body.page);
    const nonce = typeof body.nonce === "string" ? body.nonce : "";
    const expiresAt = Number(body.expiresAt);
    if (!Number.isInteger(page) || page < 1 || page > MAX_PAGE) throw new ApiError("Nomor halaman pratinjau tidak valid.");
    if (!/^[a-f0-9]{32,128}$/i.test(nonce)) throw new ApiError("Nonce pratinjau tidak valid.");
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now() || expiresAt > Date.now() + 2 * 60 * 60 * 1000) {
      throw new ApiError("Sesi pratinjau tidak valid. Mulai pratinjau baru.");
    }

    const result = await getArchivePage(page, credentials);
    const eligible = [];
    let excludedAfterDate = 0;
    let excludedMissingDate = 0;
    for (const conversation of result.rows) {
      const id = conversation?._id || conversation?.id;
      const lastMessageAt = conversation?.lastMessage?.sendAt || conversation?.lastMessageAt || null;
      if (!lastMessageAt) {
        excludedMissingDate += 1;
        continue;
      }
      const localDate = jakartaDate(lastMessageAt);
      if (!localDate) {
        excludedMissingDate += 1;
        continue;
      }
      if (localDate < range.fromDate || localDate > range.toDate) {
        excludedAfterDate += 1;
        continue;
      }
      if (typeof id !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(id)) continue;
      const entry = { id, lastMessageAt };
      eligible.push({ ...entry, proof: entryProof(entry, range, nonce, expiresAt) });
    }

    const nextPage = result.hasNextPage !== null
      ? result.hasNextPage
      : result.totalPages !== null
        ? page < result.totalPages
        : result.rows.length >= 100;

    return res.status(200).json({
      page,
      pageSize: result.rows.length,
      totalDocs: result.totalDocs,
      totalPages: result.totalPages,
      hasNextPage: nextPage,
      eligible,
      excludedAfterDate,
      excludedMissingDate,
      credentials: result.credentials,
    });
  } catch (error) {
    return sendError(res, error);
  }
};
