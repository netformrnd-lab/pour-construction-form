// 업무OS v2 — 보기 모드 쓰기 잠금 (2026-10-15 · 화면 viewas.js · 다른 파일을 가져오지 않음 = 저장 장치 fb.js 가 씀)
//   보기 모드(리드·본부장·관리자가 팀원 화면을 읽기만) 동안 저장 장치의 쓰기가 모두 막힘 → 다른 사람 이름으로 쓰는 일이 없음
//   켜고 끄는 곳 = App.jsx 한 곳 (화면을 그리기 전에 → 아래 화면이 처음 저장하기 전에 막힘)
let ON = null;   // null | { as: 보는 사람 id, by: 연 사람 id }
export const setViewOnly = (v) => { ON = v && v.as ? { as: v.as, by: v.by || "" } : null; };
export const viewOnlyOn = () => ON;
export class ViewOnlyError extends Error {
  constructor() { super("보기 모드 — 저장하지 않음"); this.name = "ViewOnlyError"; this.viewOnly = true; }
}
// 저장 장치의 쓰기 함수 맨 앞에서 부름 (async 함수 안이라 실패한 약속으로 돌아감 → 부른 쪽 catch)
export const guardWrite = () => { if (ON) { console.warn("[v2 보기 모드] 쓰기 막음"); throw new ViewOnlyError(); } };
export const isViewOnlyErr = (e) => !!(e && e.viewOnly);
