const { ApiError, parseBody, requireSameOrigin } = require("../lib/socialchat");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method tidak diizinkan." });

  try {
    requireSameOrigin(req);
    const body = parseBody(req);
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || email.length > 320 || !password || password.length > 1000) {
      throw new ApiError("Email dan password wajib diisi.");
    }

    let response;
    try {
      response = await fetch("https://api.socialchat.id/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        cache: "no-store",
      });
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
          "Server tidak dapat terhubung ke Socialchat. Periksa koneksi internet.",
          502,
        );
      }
      throw new ApiError("Koneksi login Socialchat gagal.", 502);
    }

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401 || response.status === 400) {
        throw new ApiError("Email atau password Socialchat salah.", 401);
      }
      if (response.status === 429)
        throw new ApiError(
          "Terlalu banyak percobaan login. Tunggu sebentar.",
          429,
        );
      throw new ApiError(
        "Login Socialchat gagal. Periksa status akun dan coba lagi.",
        502,
      );
    }

    const data =
      result?.data && typeof result.data === "object" ? result.data : result;
    if (!data?.accessToken || !data?.refreshToken) {
      throw new ApiError(
        "Login memerlukan verifikasi tambahan atau format sesi tidak dikenali. Login 2FA belum tersedia di form ini.",
        422,
      );
    }
    return res.status(200).json({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user
        ? {
            name:
              data.user.name ||
              data.user.fullName ||
              data.user.email ||
              "Akun Socialchat",
          }
        : null,
    });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 502;
    return res
      .status(status)
      .json({
        error:
          error instanceof ApiError ? error.message : "Login Socialchat gagal.",
      });
  }
};
