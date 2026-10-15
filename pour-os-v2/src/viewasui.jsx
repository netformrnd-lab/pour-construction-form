// 업무OS v2 — 팀원 화면 보기 (보기 모드 화면 · 계산 viewas.js · 2026-10-15)
//   더보기 › 팀원 화면 보기 / 사람 화면 [화면 그대로 보기] → 이름 고르기 → 그 사람 화면(오늘·달력·프로젝트·더보기)을 읽기만
//   보는 동안: 위 보라색 막대(누구 화면 · [다른 사람] · [내 화면으로]) + 화면 테두리 · 시트가 열리면 위 가운데 '보기 · 이름'
import { ymd } from "./model.js";
import { viewables, peekOf, peekText } from "./viewas.js";
import { C, Head, Card, Row, Empty, Sheet } from "./ui.jsx";

const arrow = <span style={{ color: C.navy, fontWeight: 800 }}>›</span>;
export function ViewAsSheet({ D, cu, view, onBack, onClose }) {
  const me = (view && view.by) || cu, rows = viewables(D.users, me), key = ymd(new Date());
  const under = rows.filter((r) => r.under), rest = rows.filter((r) => !r.under), teams = [...new Set(rest.map((r) => r.team || "팀 미정"))];
  const groups = [...(under.length ? [{ k: "under", label: "내 아래 사람", rows: under }] : []), ...teams.map((t) => ({ k: t, label: t, rows: rest.filter((r) => (r.team || "팀 미정") === t) }))];
  const go = (id) => { if (view && view.go) view.go(id); };
  return <Sheet title="팀원 화면 보기" kind="보기 모드" onBack={onBack} onClose={onClose}>
    <div style={{ marginTop: 12, padding: "10px 12px", background: "#F3EEFD", borderRadius: 12, fontSize: 13, color: "#4C1D95", lineHeight: 1.6 }}>
      이름을 고르면 그 사람이 보는 화면(오늘·달력·프로젝트·더보기)을 그대로 봐요. <b>읽기만</b> — 눌러도 저장되지 않아요. 기밀은 두 사람 모두 볼 수 있는 것만 보여요.
    </div>
    {!rows.length && <Card style={{ marginTop: 12 }}><Empty>볼 수 있는 사람이 없어요 · 리드는 내 아래 사람(관리자 › 사람 › 상급자)만 봐요</Empty></Card>}
    {groups.map((g) => <div key={g.k}>
      <Head>{g.label} {g.rows.length}</Head>
      <Card>{g.rows.map((r, i) => { const now = view && view.by && cu.id === r.u.id;
        return <Row key={r.u.id} title={r.u.name} tag={r.tag || null} tagTone={now ? "turn" : null} sub={peekText(peekOf(D, r.u.id, key))} onClick={now ? undefined : () => go(r.u.id)}
          right={now ? <span style={{ fontSize: 12, fontWeight: 800, color: "#6D28D9" }}>보는 중</span> : arrow} last={i === g.rows.length - 1} />; })}</Card>
    </div>)}
  </Sheet>;
}
// 보는 동안 위 막대 (오늘·달력·프로젝트·더보기 위 · 시험판 안내 대신)
export function ViewBar({ cu, view, open }) {
  return <div className="v2-viewbar" role="status" aria-label={`보기 모드 · ${cu.name}님 화면`}>
    <div className="t"><b>👀 {cu.name}님 화면</b><span className="s">{view.by.name}님이 보는 중 · 읽기만</span></div>
    <button type="button" onClick={() => open({ type: "viewAs" })}>다른 사람</button>
    <button type="button" className="x" onClick={view.exit}>내 화면으로</button>
  </div>;
}
// 화면 테두리 + 시트가 열렸을 때 위 가운데 이름표 (누르는 데 방해 안 됨)
export function ViewFrame({ cu, sheet }) {
  return <><div className="v2-viewframe" aria-hidden="true" />{sheet && <div className="v2-viewtag" aria-hidden="true">보기 · {cu.name}</div>}</>;
}
