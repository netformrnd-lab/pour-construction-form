import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// 관리자 대시보드 — admin.html 하나를 단일 HTML 로. 빌드 후 dist-admin/admin.html → pourstore-renewal/os2-admin.html
export default defineConfig({
  base: "./",
  plugins: [react(), viteSingleFile()],
  build: { outDir: "dist-admin", assetsInlineLimit: 100000000, cssCodeSplit: false, rollupOptions: { input: "admin.html" } },
});
