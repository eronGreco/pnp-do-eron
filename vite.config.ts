import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tsConfigPaths(),
    tanstackStart(),
    nitro(),
    viteReact(),
    tailwindcss(),
    VitePWA({
      injectRegister: null,
      registerType: "prompt",
      devOptions: { enabled: false },
      filename: "sw.js",
      manifest: false,
      outDir: "dist/client",
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        globIgnores: ["**/downloads/**", "**/_server/**"],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        skipWaiting: false,
        clientsClaim: false,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "pnp-pages",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 20 },
            },
          },
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && /\/assets\/.*\.[0-9a-f]{6,}\./.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "pnp-assets",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 60 },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.origin === "https://fonts.googleapis.com" ||
              url.origin === "https://fonts.gstatic.com",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "pnp-fonts",
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "@radix-ui/react-accordion",
      "@radix-ui/react-collapsible",
    ],
  },
  resolve: {
    dedupe: ["react", "react-dom"],
  },
});
