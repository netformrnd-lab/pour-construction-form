// 업무OS v2 — 문자 알림 설정 (더보기 › 문자 알림 · 나만) · 관리자 › 사람 › 휴대폰 번호 (마스터)
import { useState } from "react";
import * as fb from "./fb.js";
import { C, Chip, Card, TBtn, inp } from "./ui.jsx";
import { smsPref, SMS_FROM, SMS_TO } from "./mention.js";

const HOURS = Array.from({ length: 11 }, (_, i) => String(8 + i).padStart(2, "0") + ":00");   // 08:00 ~ 18:00
const mask = (p) => { const d = String(p || "").replace(/\D/g, ""); return d.length >= 9 ? d.slice(0, 3) + "-****-" + d.slice(-4) : ""; };
const saveFail = (setToast) => (e) => { console.error("[v2] 문자 설정 저장 실패:", e); setToast && setToast({ text: "저장 실패 · 인터넷 연결을 확인해 주세요" }); };

// 받침 따라 '로/으로' (ㄹ 받침은 '로')
const roParticle = (name) => { const c = String(name || "").slice(-1).charCodeAt(0) - 0xAC00; if (c < 0 || c > 11171) return "(으)로"; const j = c % 28; return j === 0 || j === 8 ? "로" : "으로"; };
export function SmsSettings({ cu, setToast }) {
  const p = smsPref(cu), phone = mask(cu.phone);
  const save = (patch) => fb.patch("users", cu._doc || cu.id, { sms: { ...p, ...patch } }).then(() => setToast && setToast({ text: "문자 알림 설정을 바꿨어요" })).catch(saveFail(setToast));
  return <Card style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
    <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.6 }}>누가 댓글에서 <b>@{cu.name}</b>{roParticle(cu.name)} 부르면 '확인할 것'에 떠요. 아래 시간 안이면 문자도 와요 (10분 안에 여러 번이면 한 통으로).</div>
    <div style={{ fontSize: 13, color: C.sub }}>{phone ? `받는 번호 ${phone} (관리자가 넣음)` : "번호가 없어서 문자는 안 가요 · 관리자에게 번호를 넣어 달라고 해 주세요"}</div>
    <div className="v2-chips" role="group" aria-label="문자 받기"><Chip on={p.on} onClick={() => !p.on && save({ on: true })}>문자 받기</Chip><Chip on={!p.on} onClick={() => p.on && save({ on: false })}>앱에만</Chip></div>
    {p.on && <>
      <div className="v2-chips" role="group" aria-label="주말·공휴일"><Chip on={!p.weekend} onClick={() => p.weekend && save({ weekend: false })}>주말·공휴일 안 받음</Chip><Chip on={p.weekend} onClick={() => !p.weekend && save({ weekend: true })}>주말·공휴일도 받음</Chip></div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13.5, color: C.text }}>받는 시간
        <select className="v2-sel" aria-label="시작 시각" value={p.from} onChange={(e) => save({ from: e.target.value, to: e.target.value >= p.to ? SMS_TO : p.to })}>{HOURS.slice(0, -1).map((h) => <option key={h} value={h}>{h}</option>)}</select> ~
        <select className="v2-sel" aria-label="끝 시각" value={p.to} onChange={(e) => save({ to: e.target.value, from: e.target.value <= p.from ? SMS_FROM : p.from })}>{HOURS.slice(1).map((h) => <option key={h} value={h}>{h}</option>)}</select></div>
      <div style={{ fontSize: 12.5, color: C.mute, lineHeight: 1.6 }}>08:00~18:00 안에서만 고를 수 있어요 · 시간 밖에 불리면 앱에만 떠요(나중에 몰아서 보내지 않아요) · 내가 쓴 댓글엔 안 와요</div>
    </>}
  </Card>;
}

// 관리자 › 사람: 휴대폰 번호 (문자 알림용 · 마스터만)
export function PhoneEdit({ u, A, setToast }) {
  const [v, setV] = useState(""), cur = mask(u.phone);
  const ok = /^\d{10,11}$/.test(v.replace(/\D/g, ""));
  const save = async (val) => { try { await fb.patch("users", u._doc || u.id, { phone: val }); A && A.log && A.log("edit", { col: "users", targetId: u.id, label: `${u.name} · 휴대폰 번호 ${val ? "넣음" : "지움"}` }); setV(""); setToast && setToast({ text: val ? `${u.name}님 번호를 넣었어요` : `${u.name}님 번호를 지웠어요` }); } catch (e) { saveFail(setToast)(e); } };
  return <Card style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
    <div style={{ fontSize: 13.5, color: C.text }}>{cur ? `지금 번호 ${cur}` : "번호 없음 · @로 불려도 앱에만 떠요"}</div>
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <input type="tel" inputMode="numeric" value={v} onChange={(e) => setV(e.target.value.replace(/[^\d-]/g, "").slice(0, 13))} placeholder="010-0000-0000" aria-label="휴대폰 번호" style={{ ...inp, width: 170, padding: "9px 12px" }} />
      <TBtn v="solid" disabled={!ok} onClick={() => ok && save(v.replace(/\D/g, ""))}>{cur ? "바꾸기" : "넣기"}</TBtn>
      {cur && <TBtn onClick={() => save("")}>지우기</TBtn>}</div>
    <div style={{ fontSize: 12.5, color: C.mute, lineHeight: 1.6 }}>문자 알림(@ 태그)에만 써요 · 받는 시간·주말은 본인이 더보기 › 문자 알림에서 정해요</div>
  </Card>;
}
