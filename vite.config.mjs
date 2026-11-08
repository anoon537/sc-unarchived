import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4173",
        configure(proxy) {
          proxy.on("proxyReq", (proxyReq, req) => {
            // The local API compares Origin with the original browser host.
            // Preserve that host when the proxy forwards the request.
            const origin = req.headers.origin;
            const requestHost = req.headers.host;
            if (!origin || !requestHost) return;
            try {
              if (new URL(origin).host === requestHost) {
                proxyReq.setHeader("x-forwarded-host", requestHost);
              }
            } catch {
              // The API rejects invalid Origin values itself.
            }
          });
        },
      },
    },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
