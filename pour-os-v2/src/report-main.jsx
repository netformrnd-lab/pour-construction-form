// 월말 보고서 공유 페이지 (os2-report.html#보고서id~열쇠) — 로그인 없이 보기만
//  읽는 것은 pour-os/v2/reports/{id} 문서 하나뿐 (관리자 메모 reportnotes 는 절대 안 읽음) · 쓰기 없음
//  공유가 꺼졌거나 열쇠가 바뀌면(공유 끄기 → 다시 만들기) 안 열림 · 금액 숨김이면 금액 대신 %
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import * as fb from "./fb.js";
import { parseShare, sharedView } from "./report.js";
import { ReportView } from "./reportview.jsx";
import "./styles.css";

function SharePage() {
  const [st, setSt] = useState({ loading: true });
  useEffect(() => {
    const go = () => { const h = parseShare(window.location.hash); if (!h) { setSt({ err: "링크가 올바르지 않아요" }); return; }
      setSt({ loading: true });
      fb.getOne("reports", h.id).then((doc) => setSt(sharedView(doc, h.token))).catch((e) => { console.error("[공유 보고서] 못 읽음:", e); setSt({ err: "보고서를 불러오지 못했어요 · 인터넷 연결을 확인해 주세요" }); }); };
    go(); window.addEventListener("hashchange", go); return () => window.removeEventListener("hashchange", go);
  }, []);
  useEffect(() => { if (st.data) document.title = `${st.data.title} (업무OS)`; }, [st.data]);
  return <div className="rp-page">
    <div className="rp-top"><b>업무OS</b><span>월말 보고서 · 보기만</span></div>
    {st.loading ? <div className="rp-msg">불러오는 중…</div> : st.err ? <div className="rp-msg">{st.err}</div>
      : <ReportView data={st.data} money={st.money} final={st.final} finalAt={st.finalAt} />}
  </div>;
}
createRoot(document.getElementById("root")).render(<StrictMode><SharePage /></StrictMode>);
