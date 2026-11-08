const http = require("node:http");
const { randomBytes } = require("node:crypto");

const port = Number(process.env.PORT) || 4173;
if (!process.env.UNARCHIVE_SIGNING_SECRET) {
  process.env.UNARCHIVE_SIGNING_SECRET = randomBytes(32).toString("base64url");
}

const apiHandlers = {
  "/api/login": require("./api/login"),
  "/api/labels": require("./api/labels"),
  "/api/preview": require("./api/preview"),
  "/api/unarchive": require("./api/unarchive"),
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
  const handler = apiHandlers[url.pathname];
  if (!handler) return sendJson(res, 404, { error: "Endpoint tidak ditemukan." });

  let rawBody = "";
  for await (const chunk of req) {
    rawBody += chunk;
    if (rawBody.length > 1_000_000)
      return sendJson(res, 413, { error: "Request terlalu besar." });
  }
  try {
    req.body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return sendJson(res, 400, { error: "Format request tidak valid." });
  }

  const response = {
    statusCode: 200,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      res.writeHead(this.statusCode, {
        ...this.headers,
        "Content-Type": "application/json; charset=utf-8",
      });
      res.end(JSON.stringify(payload));
    },
  };
  try {
    await handler(req, response);
  } catch {
    if (!res.headersSent) sendJson(res, 500, { error: "Kesalahan server lokal." });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Socialchat API lokal: http://127.0.0.1:${port}`);
});
