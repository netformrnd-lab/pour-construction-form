// SVG 그림 → PNG 내려받기 (협업 맵 · 프로젝트 마인드맵 공용)
// 밖으로 보내는 것 없음 · 외부 라이브러리 없음 · 2배 크기 · 위에 '무엇을 · 언제' 한 줄
export const SVG_FONT = "Pretendard, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
// SVG 글자 폭 어림 (한글 1em · 그 밖 0.6em)
export const textW = (s, fs) => [...String(s || "")].reduce((w, ch) => w + (/[ㄱ-힣]/.test(ch) ? 1 : /[\s.·,]/.test(ch) ? 0.35 : 0.62) * fs, 0);
export const clip = (s, fs, maxW) => { let x = String(s || ""); if (textW(x, fs) <= maxW) return x; while (x.length > 1 && textW(x + "…", fs) > maxW) x = x.slice(0, -1); return x + "…"; };
// 파일 이름에 못 쓰는 글자·빈칸만 뺌 (한글 그대로)
export const fileSafe = (s, alt = "그림") => String(s || "").replace(/[\\/:*?"<>|\s]+/g, "") || alt;

//  svg = 지금 화면의 <svg>(viewBox 기준 크기) · caption = 그림 위 한 줄 · name = 파일 이름
export function savePng(svg, caption, name) {
  if (!svg) return;
  const NS = "http://www.w3.org/2000/svg", TOP = 40;
  const vb = (svg.getAttribute("viewBox") || "0 0 720 540").split(/\s+/).map(Number), w = vb[2], h = vb[3] + TOP, k = 2;
  const cl = document.createElementNS(NS, "svg"); cl.setAttribute("xmlns", NS); cl.setAttribute("viewBox", `0 0 ${w} ${h}`); cl.setAttribute("width", w); cl.setAttribute("height", h); cl.setAttribute("font-family", SVG_FONT);
  const bg = document.createElementNS(NS, "rect"); bg.setAttribute("width", w); bg.setAttribute("height", h); bg.setAttribute("fill", "#FFFFFF"); cl.appendChild(bg);
  const tx = document.createElementNS(NS, "text"); tx.setAttribute("x", 16); tx.setAttribute("y", 26); tx.setAttribute("font-size", 14); tx.setAttribute("font-weight", 800); tx.setAttribute("fill", "#0F1F5C"); tx.textContent = clip(caption, 14, w - 32); cl.appendChild(tx);
  const g = document.createElementNS(NS, "g"); g.setAttribute("transform", `translate(0,${TOP})`); [...svg.childNodes].forEach((n) => g.appendChild(n.cloneNode(true))); cl.appendChild(g);
  const src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(cl));
  const img = new Image();
  img.onload = () => {
    const cv = document.createElement("canvas"); cv.width = w * k; cv.height = h * k;
    const g = cv.getContext("2d"); g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, cv.width, cv.height); g.scale(k, k); g.drawImage(img, 0, 0, w, h);
    const done = (url) => { const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); };
    if (cv.toBlob) cv.toBlob((b) => { if (!b) { done(cv.toDataURL("image/png")); return; } const u = URL.createObjectURL(b); done(u); setTimeout(() => URL.revokeObjectURL(u), 4000); }, "image/png");
    else done(cv.toDataURL("image/png"));
  };
  img.onerror = (e) => console.error("[그림으로 저장] 그림 만들기 실패:", e);
  img.src = src;
}
