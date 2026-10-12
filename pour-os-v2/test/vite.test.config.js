// 화면 시험용 빌드: src/fb.js 를 test/fb.fake.js(메모리 가짜 저장 장치)로 바꿔 끼움 — 실제 Firestore 에 쓰지 않음
//   팀 앱:    npx vite build --config test/vite.test.config.js            → test/out/team/index.html
//   관리자:   ADMIN=1 npx vite build --config test/vite.test.config.js    → test/out/admin/admin.html
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, ".."), fake = path.resolve(here, "fb.fake.js"), real = path.resolve(root, "src/fb.js");
const admin = !!process.env.ADMIN;
const swapFb = { name: "swap-fb", enforce: "pre", resolveId(src, importer) { if (!importer || !/fb\.js$/.test(src)) return null; const abs = path.resolve(path.dirname(importer), src); return abs === real ? fake : null; } };
export default defineConfig({
  root, base: "./",
  plugins: [swapFb, react(), viteSingleFile()],
  build: { minify: process.env.NOMIN ? false : "esbuild", outDir: path.resolve(here, admin ? "out/admin" : "out/team"), emptyOutDir: true, assetsInlineLimit: 100000000, cssCodeSplit: false,
    rollupOptions: { input: path.resolve(root, admin ? "admin.html" : "index.html") } },
  logLevel: "warn",
});
