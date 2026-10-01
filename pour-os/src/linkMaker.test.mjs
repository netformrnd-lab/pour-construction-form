// 추적 링크 만들기 테스트 — node src/linkMaker.test.mjs  (마진대시보드와 같은 결과인지)
import fs from "node:fs";
import { ML_PURPOSES, utmNorm, mlCode, mlDest, mlBuild, normUrl, mlMakeDoc, mlReady, recentCombos, mergeLinks, trackUrl, isTrackUrl, trackId, genLinkId } from "./linkMaker.js";

let pass = 0, fail = 0;
const eq = (name, got, exp) => { const ok = JSON.stringify(got) === JSON.stringify(exp);
  console.log(`${ok ? "✅" : "❌"} ${name} → ${JSON.stringify(got)}${ok ? "" : " (기대: " + JSON.stringify(exp) + ")"}`); ok ? pass++ : fail++; };

// ① 대시보드 코드와 똑같은지 — 대시보드 파일에서 함수를 꺼내 같은 입력으로 비교
const html = fs.readFileSync(new URL("../../pourstore-pricing-dashboard.html", import.meta.url), "utf8");
const grab = (re) => { const m = html.match(re); if (!m) throw new Error("대시보드 함수 못 찾음 " + re); return m[0]; };
const dash = new Function(grab(/function utmNorm\(s\)\{[^\n]*\}/) + "\n" + grab(/const mlCode=[^\n]*\n/) + "\n" + grab(/function mlDest\(url\)\{[\s\S]*?return \{dest:'기타 사이트',brand:'',mode:'utm'\}; \}/) + "\n" + grab(/function mlBuild\(url,mode,t\)\{[\s\S]*?return url; \} \}/) + "\nreturn {utmNorm,mlCode,mlDest,mlBuild};")();
const dashP = new Function(grab(/const ML_PURPOSES=\[[\s\S]*?\n\];/) + "\nreturn ML_PURPOSES;")();
eq("용도·올릴 곳·코드가 대시보드와 같음", ML_PURPOSES.map((p) => [p.k, p.places || [], p.src || "", p.med || ""]), dashP.map((p) => [p.k, p.places || [], p.src || "", p.med || ""]));
const words = ["10월 옥상방수", "Spring Sale-2026", "홍길동", "@insta_id", "", "a.b c"];
eq("영문 코드 같음", words.map((w) => mlCode(w, "c")), words.map((w) => dash.mlCode(w, "c")));
const urls = ["https://pourstore.net/product/1", "https://m.grohome.co.kr/x", "https://smartstore.naver.com/grohome/products/1", "https://www.coupang.com/vp/1", "https://blog.naver.com/a", "nope"];
eq("목적지 판단 같음", urls.map(mlDest), urls.map(dash.mlDest));
const t = { source: "naver_blog", medium: "post", campaign: "", content: "c_abc" };
eq("꼬리표 붙이기 같음", ["utm", "nt", "none"].map((m) => mlBuild("https://pourstore.net/p?a=1", m, t)), ["utm", "nt", "none"].map((m) => dash.mlBuild("https://pourstore.net/p?a=1", m, t)));

// ② 만들기
const m = { url: "pourstore.net/product/detail.html?product_no=12", purpose: "포스팅", place: "네이버 블로그", product: "옥상방수 세트" };
eq("http 없이 붙여넣어도", normUrl(m.url), "https://pourstore.net/product/detail.html?product_no=12");
eq("다 골랐나", [mlReady(m), mlReady({ ...m, place: "" }), mlReady({ url: "x", purpose: "광고", place: "메타 광고" }), mlReady({ url: "a.com", purpose: "공동구매", partner: " " })], [true, false, false, false]);
const d = mlMakeDoc(m, { id: "oabc123", now: new Date(2026, 9, 2, 10, 0), by: "songhee", byName: "김송희" });
eq("문서", [d.dest, d.brand, d.tagMode, d.utmSource, d.utmMedium, d.label, d.createdVia, d.clicks], ["자사몰", "POUR스토어", "utm", "naver_blog", "post", "네이버 블로그 · 옥상방수 세트 · 10/02", "pour-os", 0]);
eq("완성 주소", d.url, "https://pourstore.net/product/detail.html?product_no=12&utm_source=naver_blog&utm_medium=post&utm_content=" + mlCode("네이버 블로그", "c"));
const g = mlMakeDoc({ url: "https://smartstore.naver.com/grohome/products/9", purpose: "공동구매", partner: "홍길동 공구", campaign: "10월 세일" }, { id: "o1" });
eq("스마트스토어 = 네이버 꼬리표 · 그로홈 · 이름형", [g.tagMode, g.brand, g.partner, g.place, /nt_source=groupbuy/.test(g.url), /nt_keyword=10(&|$)/.test(g.url)], ["nt", "GROHOME", "홍길동 공구", "", true, true]);
let err = ""; try { mlMakeDoc({ url: "a.com", purpose: "광고", place: "없는곳" }, { id: "x" }); } catch (e) { err = e.message; }
eq("잘못 고르면 이유", err, "올릴 곳을 골라 주세요");

// ③ 짧은 링크 · 목록
eq("짧은 링크", [trackUrl("oabc123"), isTrackUrl("보세요 https://pour-construction-form.pages.dev/g?l=oabc123 !"), trackId("https://x/g?l=k2j3h4x")], ["https://pour-construction-form.pages.dev/g?l=oabc123", true, "k2j3h4x"]);
eq("id 모양 (o + 6자)", /^o[a-z0-9]{6}$/.test(genLinkId()), true);
const os = [{ id: "o1", createdAt: "2026-10-02", purpose: "광고", place: "메타 광고", createdBy: "songhee" }, { id: "o2", createdAt: "2026-10-03", purpose: "광고", place: "메타 광고", createdBy: "songhee" }];
const mkt = [{ id: "o1", createdAt: "2026-10-02", clicks: 5, purpose: "광고", place: "메타 광고" }, { id: "k1", createdAt: "2026-09-01", purpose: "포스팅", place: "인스타그램" }, { id: "k2", createdAt: "2026-09-02", deleted: true }, { id: "k3", createdAt: "2026-09-03", archived: true }];
const all = mergeLinks(mkt, os);
eq("합치기: 옮겨 담긴 건 대시보드 것 · 삭제·보관 제외 · 최신순", all.map((l) => l.id + ":" + l._src), ["o2:os", "o1:mkt", "k1:mkt"]);
eq("최근 설정 (같은 조합은 하나만 · 남이 만든 건 빼고 — 대시보드와 같음)", recentCombos(all, "songhee").map((l) => l.id), ["o2", "k1"]);

console.log(`\n${fail ? "❌" : "✅"} ${pass} 통과 · ${fail} 실패`); if (fail) process.exit(1);
