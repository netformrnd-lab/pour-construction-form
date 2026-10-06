// 업무OS v2 — 파일 미리 보기 · 올리기 진행 (댓글 · 자료 목록 공용 · 사용자 요청 2026-10-06)
//   미리 보기: 사진 = 작은 그림(지연 읽기 · 높이 180 안) → 누르면 전체 화면(✕ 닫기 · ‹ 이전 · 다음 ›) · PDF = [PDF 미리보기] → 앱 안 보기(iframe · 안 보이면 [새 창에서 열기]) · 그 밖 = 이름 · 크기 · [열기]
//   올리기: 파일마다 진행 막대('n/m 올리는 중 · 45%') · 올리는 동안 버튼 잠금 · 실패한 파일만 [다시] (이미 올린 파일은 다시 안 올림)
import { useEffect, useRef, useState } from "react";
import { C, TBtn, Card, Empty } from "./ui.jsx";
import { ymd, md } from "./model.js";

const stop = (e) => e.stopPropagation();
export const fileKind = (f) => { const t = String((f && f.type) || ""), n = String((f && f.name) || "").toLowerCase();
  if (/^image\/(png|jpe?g|gif|webp|bmp|svg\+xml|avif)$/.test(t) || (!t && /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/.test(n))) return "img";
  if (t === "application/pdf" || /\.pdf$/.test(n)) return "pdf";
  return "file"; };
export const fileSize = (n) => { n = +n || 0; if (!n) return ""; if (n < 1024) return `${n}B`; if (n < 1048576) return `${Math.max(1, Math.round(n / 1024))}KB`; return `${(n / 1048576).toFixed(n < 10485760 ? 1 : 0)}MB`; };
const extOf = (f) => String((f && f.name) || "").split(".").pop().slice(0, 4).toUpperCase() || "파일";

// Esc · ← → 를 시트보다 먼저 받음 (보기만 닫히고 시트는 그대로)
function useKeys(map) {
  const ref = useRef(map); ref.current = map;
  useEffect(() => { const k = (e) => { const fn = ref.current[e.key]; if (fn) { e.stopPropagation(); e.preventDefault(); fn(); } }; window.addEventListener("keydown", k, true); return () => window.removeEventListener("keydown", k, true); }, []);
}
// 사진 전체 화면 (그 댓글·그 목록의 사진끼리 ‹ › · 밀어서 넘기기)
export function ImgViewer({ imgs, at, onClose }) {
  const [i, setI] = useState(at || 0), n = imgs.length, f = imgs[Math.min(i, n - 1)] || {}, tx = useRef(null);
  const prev = () => setI((x) => Math.max(0, x - 1)), next = () => setI((x) => Math.min(n - 1, x + 1));
  useKeys({ Escape: onClose, ArrowLeft: prev, ArrowRight: next });
  return <div className="v2-viewer" role="dialog" aria-label="사진 크게 보기" onClick={onClose}
    onTouchStart={(e) => { tx.current = e.touches[0].clientX; }} onTouchEnd={(e) => { if (tx.current == null) return; const d = e.changedTouches[0].clientX - tx.current; tx.current = null; if (d > 50) prev(); else if (d < -50) next(); }}>
    <div className="vh" onClick={stop}><span className="nm">{f.name || "사진"}</span>{n > 1 && <span className="ct">{i + 1} / {n}</span>}<button type="button" onClick={onClose}>✕ 닫기</button></div>
    <div className="vb"><img src={f.url} alt={f.name || "사진"} onClick={stop} /></div>
    <div className="vf" onClick={stop}>
      {n > 1 && <button type="button" disabled={i === 0} onClick={prev}>‹ 이전</button>}
      <a href={f.url} target="_blank" rel="noopener noreferrer">새 창에서 열기</a>
      {n > 1 && <button type="button" disabled={i === n - 1} onClick={next}>다음 ›</button>}
    </div>
  </div>;
}
// PDF 앱 안 보기 (안 보이는 폰 브라우저가 있어서 [새 창에서 열기] 늘 같이)
export function PdfViewer({ f, onClose }) {
  useKeys({ Escape: onClose });
  return <div className="v2-viewer pdf" role="dialog" aria-label="PDF 미리보기" onClick={onClose}>
    <div className="vh" onClick={stop}><span className="nm">{f.name || "PDF"}</span><a href={f.url} target="_blank" rel="noopener noreferrer">새 창에서 열기</a><button type="button" onClick={onClose}>✕ 닫기</button></div>
    <div className="vp" onClick={stop}><iframe src={f.url} title={f.name || "PDF"} /></div>
    <div className="vn" onClick={stop}>미리보기가 안 보이면 [새 창에서 열기]를 눌러 주세요</div>
  </div>;
}
// 보기 열기 상태 (사진 목록 + 몇 번째 / PDF 하나)
function useView() {
  const [v, setV] = useState(null);
  const el = v ? (v.pdf ? <PdfViewer f={v.pdf} onClose={() => setV(null)} /> : <ImgViewer imgs={v.imgs} at={v.at} onClose={() => setV(null)} />) : null;
  return [setV, el];
}

// 댓글 안 파일 (사진은 그 자리에 작은 그림 · PDF 미리보기 · 그 밖은 이름·크기·[열기])
export function NoteFiles({ files }) {
  const [setV, view] = useView(), [bad, setBad] = useState({});
  const list = (files || []).filter((f) => f && f.url);
  if (!list.length) return null;
  const imgs = list.filter((f) => fileKind(f) === "img" && !bad[f.url]), rest = list.filter((f) => !(fileKind(f) === "img" && !bad[f.url]));
  return <div className="v2-nfiles">
    {imgs.length > 0 && <div className={"v2-nthumbs" + (imgs.length > 1 ? " many" : "")}>{imgs.map((f, i) => <button key={f.url + i} type="button" className="th" aria-label={`사진 크게 보기 · ${f.name || ""}`} onClick={() => setV({ imgs, at: i })}>
      <img src={f.url} alt={f.name || "사진"} loading="lazy" decoding="async" onError={() => setBad((b) => ({ ...b, [f.url]: 1 }))} /></button>)}</div>}
    {rest.map((f, i) => { const k = fileKind(f), meta = [f.name || "파일", fileSize(f.size)].filter(Boolean).join(" · ");
      return <div key={f.url + i} className="v2-nfile"><span className="ex">{k === "pdf" ? "PDF" : extOf(f)}</span><span className="nm">{meta}</span>
        {k === "pdf" ? <TBtn onClick={() => setV({ pdf: f })} style={{ minHeight: 30, padding: "4px 10px", fontSize: 12.5 }}>PDF 미리보기</TBtn>
          : <a className="v2-open" href={f.url} target="_blank" rel="noopener noreferrer">열기</a>}</div>; })}
    {view}
  </div>;
}

// 자료 목록 (업무 · 고정업무 · 반복 실행 · 프로젝트 자료 탭) — 같은 미리 보기
export function FileList({ files, empty = "올린 자료가 없어요" }) {
  const [setV, view] = useView();
  const imgs = (files || []).filter((f) => f && f.url && fileKind(f) === "img");
  return <Card>{!files || files.length === 0 ? <Empty>{empty}</Empty> : files.map((f, i) => <FileRow key={i} f={f} last={i === files.length - 1}
    onOpen={fileKind(f) === "img" ? () => setV({ imgs, at: Math.max(0, imgs.indexOf(f)) }) : fileKind(f) === "pdf" ? () => setV({ pdf: f }) : null} />)}{view}</Card>;
}
export function FileRow({ f, last, onOpen }) {
  const k = fileKind(f), [bad, setBad] = useState(false);
  const sub = [f.byName, f.where, f.uploadedAt ? md(ymd(new Date(f.uploadedAt))) : "", fileSize(f.size)].filter(Boolean).join(" · ");
  const inner = <>
    {k === "img" && !bad ? <img src={f.url} alt="" loading="lazy" decoding="async" onError={() => setBad(true)} style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8, flex: "0 0 auto", background: C.soft }} />
      : <span style={{ width: 44, height: 44, borderRadius: 8, background: C.soft, color: C.navy, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>{k === "pdf" ? "PDF" : extOf(f)}</span>}
    <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: "block", fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span><span style={{ display: "block", fontSize: 12, color: C.mute, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</span></span>
    <span style={{ color: C.navy, fontSize: 13, fontWeight: 800, flex: "0 0 auto" }}>{k === "img" && !bad ? "크게 보기 ›" : k === "pdf" ? "미리보기 ›" : "열기 ›"}</span></>;
  const st = { display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px", border: "none", borderBottom: last ? "none" : `1px solid ${C.line}`, background: "#fff", textDecoration: "none", color: C.text, font: "inherit", textAlign: "left", cursor: "pointer" };
  return onOpen && !(k === "img" && bad) ? <button type="button" onClick={onOpen} style={st}>{inner}</button> : <a href={f.url} target="_blank" rel="noopener noreferrer" style={st}>{inner}</a>;
}

// ── 올리기 진행 ──
// useUploads(A, target, save?) — 파일마다 {k, f, name, size, p(0~1), st 'wait'|'up'|'ok'|'fail'|'savefail', meta}
//   start(files) = 넣고 바로 올림 · flow(ks) = 그 파일들 올림(이미 올린 건 건너뜀) → save(올린 것들)(자료 목록: A.addFiles) 성공하면 줄을 걷음
//   retry(k) = 그 파일만 다시 (저장만 실패했으면 올리기 없이 저장만)
let K = 0;
export function useUploads(A, target, save) {
  const ref = useRef([]), [, force] = useState(0), [run, setRun] = useState(0);
  const upd = (fn) => { ref.current = fn(ref.current); force((x) => x + 1); };
  const set = (k, patch) => upd((rs) => rs.map((r) => (r.k === k ? { ...r, ...patch } : r)));
  const add = (files) => { const nr = [...files].map((f) => ({ k: ++K, f, name: f.name || "파일", size: f.size || 0, p: 0, st: "wait", meta: null })); upd((rs) => [...rs, ...nr]); return nr.map((r) => r.k); };
  const up1 = async (k) => { const r = ref.current.find((x) => x.k === k); if (!r) return null; if (r.meta) return r.meta;
    set(k, { st: "up", p: 0 });
    try { const meta = await A.upload(target, r.f, (p) => set(k, { p: Math.max(0, Math.min(1, +p || 0)) })); set(k, { st: "ok", p: 1, meta }); return meta; }
    catch (e) { console.error("[v2] 파일 올리기 실패:", r.name, e); set(k, { st: "fail" }); return null; } };
  const flow = async (ks) => { setRun((n) => n + 1);
    try { const got = []; for (const k of ks || ref.current.filter((r) => r.st !== "ok").map((r) => r.k)) { const m = await up1(k); if (m) got.push([k, m]); }
      if (save && got.length) { const ok = await save(got.map((g) => g[1])); const ks2 = got.map((g) => g[0]);
        if (ok !== false) upd((rs) => rs.filter((r) => !ks2.includes(r.k))); else ks2.forEach((k) => set(k, { st: "savefail" })); }
      return got.map((g) => g[1]); }
    finally { setRun((n) => n - 1); } };
  const rows = ref.current;
  return { rows, cur: () => ref.current, busy: run > 0 || rows.some((r) => r.st === "up"), add, flow, start: (files) => flow(add(files)), retry: (k) => flow([k]),
    drop: (k) => upd((rs) => rs.filter((r) => r.k !== k)), clear: () => upd(() => []) };
}
// 진행 줄: 'n/m 올리는 중 · 45%' + 파일마다 막대 · 실패는 빨강 '못 올렸어요' [다시] [빼기]
export function UpList({ U, onRetry, onDrop, style }) {
  const rows = U.rows; if (!rows.length) return null;
  const going = rows.some((r) => r.st === "up" || r.st === "wait") && U.busy, done = rows.filter((r) => r.st === "ok").length;
  const pct = Math.round((rows.reduce((a, r) => a + (r.st === "ok" ? 1 : r.p || 0), 0) / rows.length) * 100);
  const cur = Math.min(rows.length, done + 1);
  return <div className="v2-uplist" role="status" aria-live="polite" style={style}>
    {going && <div className="hd">{rows.length > 1 ? `${cur}/${rows.length} 올리는 중` : "올리는 중"} · {pct}%</div>}
    {rows.map((r) => { const bad = r.st === "fail" || r.st === "savefail";
      return <div key={r.k} className={"row" + (bad ? " bad" : "")}>
        <div className="t"><span className="nm">{r.name}{r.size ? ` · ${fileSize(r.size)}` : ""}</span>
          <span className="s">{r.st === "ok" ? "✓ 올림" : r.st === "fail" ? "못 올렸어요" : r.st === "savefail" ? "저장 못 했어요" : r.st === "up" ? `${Math.round((r.p || 0) * 100)}%` : U.busy ? "기다리는 중" : "보내면 올려요"}</span>
          {bad && <><TBtn onClick={() => (onRetry || U.retry)(r.k)} disabled={U.busy} style={{ minHeight: 28, padding: "2px 10px", fontSize: 12.5 }}>다시</TBtn>
            <TBtn tone="mute" onClick={() => (onDrop || U.drop)(r.k)} disabled={U.busy} style={{ minHeight: 28, padding: "2px 10px", fontSize: 12.5 }}>빼기</TBtn></>}
          {!bad && r.st !== "up" && r.st !== "ok" && !U.busy && onDrop && <TBtn tone="mute" onClick={() => onDrop(r.k)} style={{ minHeight: 28, padding: "2px 10px", fontSize: 12.5 }}>✕ 빼기</TBtn>}</div>
        {(r.st === "up" || r.st === "ok" || (r.st === "wait" && U.busy)) && <div className={"bar" + (r.st === "up" && !r.p ? " ind" : "")}><i style={{ width: `${Math.round((r.st === "ok" ? 1 : r.p || 0) * 100)}%` }} /></div>}
      </div>; })}
  </div>;
}
// 자료 목록 위 [+ 파일 올리기] (올리는 동안 '올리는 중' · 잠금)
export function UpBtn({ U, label = "+ 파일 올리기", onPick }) {
  const r = useRef(null);
  return <><TBtn disabled={U.busy} onClick={() => r.current && r.current.click()}>{U.busy ? "올리는 중" : label}</TBtn>
    <input ref={r} type="file" multiple hidden aria-label="파일 고르기" onChange={(e) => { const f = [...e.target.files]; e.target.value = ""; if (f.length) (onPick ? onPick(f) : U.start(f)); }} /></>;
}
