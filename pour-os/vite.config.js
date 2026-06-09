import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// 정적 호스팅(Cloudflare Pages)의 pourstore-renewal/ 폴더에 단일 HTML로 넣기 위해
// JS·CSS를 index.html에 인라인한다 (preview.html 같은 단일 정적 파일 형태).
// 빌드 후 dist/index.html → pourstore-renewal/os.html 로 복사.
export default defineConfig({
  base: "./",
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: "dist",
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
  },
});
