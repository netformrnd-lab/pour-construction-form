// 업무OS v2 — 다른 앱에서 온 '할 일 한 줄' (CRM · 마진 · 사용자 결정 2026-10-05 · 계산만)
// 저장: pour-os/v2/links/{id} — CRM·마진 앱이 씀(업무OS 는 읽기만) · 전화번호·주소 같은 개인정보는 안 받음(이름·업체명 한 줄 + 날짜 + 담당 + 바로가기)
//   마케팅 허브(marketing-hub/): aiReview(AI 팀원 결과 검토 → 허브 AI 팀에서 [검토 끝]) · voc(고객의 소리 하자·안전 / 같은 이야기 3건 · 내용 없음)
//   { id, src: "crm"|"margin"|"mkt", kind, title, sub, date: "YYYY-MM-DD"(이날부터 보임 · 없으면 바로), time, owner(이름), ownerOsId, url, open, at }
//   그 앱에서 처리되면 open:false (지우지 않음)
//   마진 v2(pourstore-margin2.html): marginLow(마진 낮음 · 제품·채널·% 만) · priceReq(가격 바꾸기 요청 → 관리자 · 승인·반려되면 닫힘)
// 누구에게: 담당(업무OS 사람 번호 → 이름 끝이 같은 사람 1명)이 있으면 그 사람 · 없으면 마스터 '확인할 것'
import { isMaster } from "./model.js";

export const LINK_TAG = { recall: "재통화", visit: "방문예약", dealerOrder: "대리점 발주", dealerChat: "대리점 채팅", lowStock: "재고 위험", marginLow: "마진 낮음", quoteAccepted: "견적 수락", bigDeal: "큰 건", priceReq: "가격 컨펌", aiReview: "AI 검토", voc: "고객의 소리" };
export const LINK_APP = { crm: "CRM", margin: "마진", mkt: "마케팅 허브" };
const clean = (s) => String(s || "").replace(/\s/g, "");
// 이름으로 업무OS 사람 찾기 (같은 이름 → 끝이 같은 사람이 딱 1명)
export function linkOwnerId(l, users) {
  const act = (users || []).filter((u) => u && u.active !== false && u.name);
  if (l.ownerOsId && act.some((u) => u.id === l.ownerOsId)) return l.ownerOsId;
  const n = clean(l.owner); if (n.length < 2) return "";
  const ex = act.find((u) => clean(u.name) === n); if (ex) return ex.id;
  const c = act.filter((u) => clean(u.name).endsWith(n) || n.endsWith(clean(u.name))); return c.length === 1 ? c[0].id : "";
}
const dd = (a, b) => Math.round((new Date(a + "T00:00:00") - new Date(b + "T00:00:00")) / 864e5);
// 이 사람 '확인할 것'에 넣을 줄
// 같은 종류가 3줄 넘게 오면(예: 재고 위험 54개) 한 줄로 묶음 — '확인할 것'이 넘치지 않게
export const LINK_GROUP_MIN = 4;
export function linkInbox(links, users, uid, key) {
  const rows = linkRows(links, users, uid, key), by = {};
  rows.forEach((x) => { (by[x._k] = by[x._k] || []).push(x); });
  const out = [];
  Object.values(by).forEach((g) => {
    if (g.length < LINK_GROUP_MIN) { out.push(...g); return; }
    const late = g.filter((x) => x.red).length, names = g.slice(0, 2).map((x) => x.title.replace(/\s*재고 위험$/, "")).join(" · ");
    // 재고 위험 묶음은 빨강 아님 · '읽음'으로 오늘 하루 숨길 수 있음(내일·수가 바뀌면 다시) — 정밀 검토 2026-10-06
    const stock = g[0]._k === "lowStock";
    out.push({ ...g[0], id: "lk:grp:" + g[0]._k + ":" + g.length + (stock ? ":" + key : ""), title: `${g[0].tag} ${g.length}건`, text: `${names} 외 ${g.length - 2}건${late && !stock ? ` · 지남 ${late}` : ""}`, group: g.length, red: stock ? false : g[0].red, keep: !stock });
  });
  return out;
}
function linkRows(links, users, uid, key) {
  const me = (users || []).find((u) => u.id === uid); if (!me) return [];
  return (links || []).filter((l) => l && l.open !== false && (!l.date || l.date <= key)).filter((l) => { const o = linkOwnerId(l, users); return o ? o === uid : isMaster(me); })
    .map((l) => { const late = l.date && l.date < key ? dd(key, l.date) : 0;
      return { kind: "link", src: l.src || "crm", whoName: LINK_APP[l.src || "crm"] || "", tag: LINK_TAG[l.kind] || "알림", red: late > 0 || l.kind === "marginLow", id: "lk:" + l.id + ":" + (l.date || ""), title: l.title || "", url: l.url || "",
        text: [l.sub, l.time, late ? `${late}일 지남` : "", !linkOwnerId(l, users) && l.owner ? `담당 ${l.owner}` : ""].filter(Boolean).join(" · "), at: l.at || "", keep: true, _k: l.kind || "" }; });
}
