// 관리자 대시보드 (자리만 — 설계 확정 후 채움)
import { useBoot, Gate } from "../core.jsx";
export default function AdminApp() {
  const B = useBoot(); const g = Gate({ B, title: "커머스본부 관리 대시보드" }); if (g) return g;
  return <div className="v2-page"><h1>관리 대시보드</h1></div>;
}
