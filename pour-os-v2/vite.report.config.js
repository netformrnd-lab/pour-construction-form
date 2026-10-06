import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// 월말 보고서 공유 페이지 — report.html 하나를 단일 HTML 로. 빌드 후 dist-report/report.html → pourstore-renewal/os2-report.html
export default defineConfig({
  base: "./",
  plugins: [react(), viteSingleFile()],
  build: { outDir: "dist-report", assetsInlineLimit: 100000000, cssCodeSplit: false, rollupOptions: { input: "report.html" } },
});
