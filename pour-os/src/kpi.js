// KPI 집계 순수 헬퍼 (App.jsx에서 추출 — 동작 동일성 유지 + 테스트 가능 표면)
// 계층: 최종목표(goals) → 메인KPI(mainKPIs) → 서브KPI(subKPIs) → 프로젝트(projects) → 업무(tasks)
// ⚠️ 매출 집계 규칙(절대 변경 금지):
//   · 메인KPI2(mk2) 서브KPI(원) 자동 → 자식 프로젝트 resultValue 합계
//   · 운영(%) 자동 → 자식 프로젝트 progress 평균
//   · 그 외/수동(manualOverride) → currentValue
//   · mainKPI(원) = 자식 subKPI 합계, goal = mainKPI(원) 합계

// 문자열·NaN·Infinity → 0 (집계 방탄)
export const numF=(x)=>{const n=Number(x);return isFinite(n)?n:0;};

// 서브KPI 현재값:
//  · 출시집계(launchCount) → 템플릿 프로젝트 완료(progress 100%) 수
//  · 카운트형(원·%·출시 제외) → 누적 currentValue + countKPIId 프로젝트 완료 수 + 구간(세그먼트) 완료 수
//  · 메인2(원) 자동 → 자식 프로젝트 매출(resultValue) 합계
//  · 운영(%) 자동 → 자식 프로젝트 진척(progress) 평균  ← 업무→진척→운영KPI 롤업
//  · 그 외/수동지정 → currentValue
// ※ 구간(세그먼트) 완료 수는 recalcProg가 프로젝트에 스탬프한 p.segDoneByKpi[sk.id]에서 읽음.
//   구간이 하나도 없으면 seg=0 → 기존 동작과 완전 동일(안전 불변식).
export const skCur=(sk,projects)=>{
  if(sk.launchCount){
    const proj=(projects||[]).filter(p=>p.templateId&&(p.progress||0)>=100).length;            // 출시 완료(progress 100%) 프로젝트 수
    const seg=(projects||[]).reduce((a,p)=>a+numF(p.segDoneByKpi&&p.segDoneByKpi[sk.id]),0);     // 완료된 연결 구간 수(없으면 0 → 기존과 동일)
    return proj+seg;
  }
  // 카운트형 집계: 이 지표를 가리키는 프로젝트 완료(+1) / 구간 완료(+1). (원/%·출시집계 제외 — 매출·진척·출시 롤업 보호)
  if(sk.unit!=="원"&&sk.unit!=="%"&&!sk.launchCount){
    const cc=(projects||[]).filter(p=>p.countKPIId===sk.id&&(p.progress||0)>=100).length;          // 완료된 연결 프로젝트 수
    const seg=(projects||[]).reduce((a,p)=>a+numF(p.segDoneByKpi&&p.segDoneByKpi[sk.id]),0);        // 완료된 연결 구간 수(없으면 0)
    if(cc||seg) return numF(sk.currentValue)+cc+seg;
  }
  if(sk.mainKPIId==="mk2"&&sk.unit==="원"&&!sk.manualOverride) return (projects||[]).filter(p=>p.subKPIId===sk.id).reduce((a,p)=>a+numF(p.resultValue),0);
  if(sk.unit==="%"&&!sk.manualOverride){ const ch=(projects||[]).filter(p=>p.subKPIId===sk.id); if(ch.length) return Math.round(ch.reduce((a,p)=>a+numF(p.progress),0)/ch.length); }
  return numF(sk.currentValue);
};

// 메인KPI 현재값:
//  · 원 → 자식 서브KPI 합계
//  · 운영(원 아님) 자동 → 자식 서브KPI 완료비율 합(= 환산 달성 단위), 자식 없으면 currentValue
//  · 수동지정(manualOverride) → currentValue
export const mkCur=(mk,subKPIs,projects)=>{
  if(mk.unit==="원") return subKPIs.filter(s=>s.mainKPIId===mk.id&&s.unit==="원").reduce((a,s)=>a+skCur(s,projects),0);   // 매출(원) = 원 단위 서브KPI만 합산(카운트형 섞임 방지 — 단위 오염 차단)
  if(!mk.manualOverride){ const subs=subKPIs.filter(s=>s.mainKPIId===mk.id&&!s.launchCount); if(subs.length){ const eq=subs.reduce((a,s)=>{const t=numF(s.targetValue); return a+(t>0?Math.min(1,skCur(s,projects)/t):0);},0); return Math.round(eq*10)/10; } }
  return numF(mk.currentValue);
};

// 구간(세그먼트) 완료 집계 — recalcProg에서 호출. tasks 기준으로 프로젝트별 {kpiId: 완료구간수} 산출.
// segment = {id, name, stageIds:[taskId...], kpiId}. 모든 stageIds가 done이면 완료 1건.
// 반환: 변경 없으면 null(=스탬프 불필요), 변경되면 새 segDoneByKpi 맵.
export const calcSegDone=(project,doneIds)=>{
  if(!Array.isArray(project.segments)||!project.segments.length) return null;
  const map={};
  project.segments.forEach(sg=>{
    if(!sg||!sg.kpiId||!Array.isArray(sg.stageIds)||!sg.stageIds.length) return;
    if(sg.stageIds.every(id=>doneIds.has(id))) map[sg.kpiId]=(map[sg.kpiId]||0)+1;
  });
  const prev=project.segDoneByKpi||{};
  return JSON.stringify(prev)===JSON.stringify(map)?null:map;
};
