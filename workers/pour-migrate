/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║   POUR스토어 → KPI Flow  마이그레이션 스크립트              ║
 * ║   Claude Code 터미널에서: node pour-migrate.js              ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * 구조 매핑:
 *   pour-objectives       → goals
 *   pour-keyresults       → mainKPIs
 *   pour-kpis(kind=result)→ subKPIs     (채널별 매출 KPI)
 *   pour-kpis(kind=activ) → projects.activityKPI 필드 (유지)
 *   pour-projects         → projects    (keyResultId → mainKPIId)
 *   pour-tasks            → tasks
 *   pour-recurring        → tasks (isFixed:true 변환)
 *   staff                 → users
 *   pour-meetings         → events
 *   work-channels         → subKPIs.channelCode 필드로 흡수
 *
 * ⚠️ 실행 전 serviceAccountKey.json 파일을 이 스크립트와 같은 폴더에 두세요.
 *    Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성
 */

const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "pour-app-new",
});
const db = admin.firestore();
const TS = admin.firestore.FieldValue.serverTimestamp;

// ── ID 매핑 저장소 (마이그레이션 중 참조용) ──
const idMap = {
  objectives: {},   // oldId → newId
  keyResults: {},   // oldId → newId (= mainKPI id)
  kpis:       {},   // oldId → newId (result→subKPI)
  projects:   {},   // oldId → newId
  staff:      {},   // kpiMemberId → uid
};

// ──────────────────────────────────────────────
// STEP 0. 기존 컬렉션 목록 확인 (먼저 실행)
// ──────────────────────────────────────────────
async function inspectCollections() {
  console.log("\n📦 현재 Firestore 컬렉션 목록:");
  const cols = await db.listCollections();
  for (const c of cols) {
    const snap = await db.collection(c.id).limit(1).get();
    console.log(`  - ${c.id.padEnd(25)} (문서 예시 필드: ${snap.empty ? "없음" : Object.keys(snap.docs[0].data()).slice(0,5).join(", ")})`);
  }
  console.log("");
}

// ──────────────────────────────────────────────
// STEP 1. staff → users
// ──────────────────────────────────────────────
const STAFF_COLOR_MAP = {
  songhee: "#3182F6",
  minji:   "#8B5CF6",
  ran:     "#00C073",
  chaerim: "#F97316",
};
const STAFF_DEPT_MAP = {
  songhee: "전략·자사몰",
  minji:   "디자인·콘텐츠·CS",
  ran:     "광고·B2B·영업",
  chaerim: "운영·CS·인프라",
};

async function migrateStaff() {
  console.log("👤 [1/7] staff → users 마이그레이션...");
  const snap = await db.collection("staff").get();
  if (snap.empty) { console.log("  ⚠️  staff 컬렉션 없음 → 시드 데이터로 생성"); await seedUsers(); return; }

  const batch = db.batch();
  snap.forEach(d => {
    const s = d.data();
    const key = s.kpiMemberId || s.kpiInitial || d.id;
    idMap.staff[key] = d.id; // kpiMemberId → doc.id
    const ref = db.collection("users").doc(d.id);
    batch.set(ref, {
      name:      s.name || key,
      email:     s.email || `${key}@pour.store`,
      dept:      STAFF_DEPT_MAP[key] || s.dept || "",
      role:      key === "songhee" ? "lead" : "member",
      color:     STAFF_COLOR_MAP[key] || s.kpiColor || "#6B7280",
      active:    s.active !== false,
      kpiMemberId: key,
      createdAt: s.createdAt || TS(),
      updatedAt: TS(),
    }, { merge: true });
  });
  await batch.commit();
  console.log(`  ✅ ${snap.size}명 완료`);
}

async function seedUsers() {
  const users = [
    { id:"songhee", name:"송희", dept:"전략·자사몰",       role:"lead",   color:"#3182F6" },
    { id:"minji",   name:"민지", dept:"디자인·콘텐츠·CS",  role:"member", color:"#8B5CF6" },
    { id:"ran",     name:"란",   dept:"광고·B2B·영업",     role:"member", color:"#00C073" },
    { id:"chaerim", name:"채림", dept:"운영·CS·인프라",     role:"member", color:"#F97316" },
  ];
  const batch = db.batch();
  users.forEach(u => {
    idMap.staff[u.id] = u.id;
    batch.set(db.collection("users").doc(u.id), {
      ...u, email:`${u.id}@pour.store`, active:true, kpiMemberId:u.id,
      createdAt:TS(), updatedAt:TS(),
    });
  });
  await batch.commit();
  console.log(`  ✅ 시드 사용자 4명 생성`);
}

// ──────────────────────────────────────────────
// STEP 2. pour-objectives → goals
// ──────────────────────────────────────────────
async function migrateObjectives() {
  console.log("🎯 [2/7] pour-objectives → goals 마이그레이션...");
  const snap = await db.collection("pour-objectives").get();

  if (snap.empty) {
    console.log("  ℹ️  기존 데이터 없음 → 시드 데이터로 생성");
    const ref = await db.collection("goals").add({
      title: "2026년 매출 10억 달성",
      targetValue: 1000000000,
      currentValue: 0,
      unit: "원",
      year: 2026,
      createdAt: TS(), updatedAt: TS(),
    });
    idMap.objectives["seed"] = ref.id;
    console.log(`  ✅ goals 시드 생성: ${ref.id}`);
    return;
  }

  for (const d of snap.docs) {
    const s = d.data();
    const ref = await db.collection("goals").add({
      title:        s.title        || "2026년 매출 10억 달성",
      targetValue:  s.target       || s.targetValue || 1000000000,
      currentValue: s.current      || s.currentValue || 0,
      unit:         s.unit         || "원",
      year:         s.year         || 2026,
      description:  s.description  || "",
      createdAt:    s.createdAt    || TS(),
      updatedAt:    TS(),
      _src: d.id,
    });
    idMap.objectives[d.id] = ref.id;
  }
  console.log(`  ✅ ${snap.size}개 완료`);
}

// ──────────────────────────────────────────────
// STEP 3. pour-keyresults → mainKPIs
// ──────────────────────────────────────────────
async function migrateKeyResults() {
  console.log("📊 [3/7] pour-keyresults → mainKPIs 마이그레이션...");
  const snap = await db.collection("pour-keyresults").get();
  const goalId = Object.values(idMap.objectives)[0] || "goal_2026";

  if (snap.empty) {
    console.log("  ℹ️  기존 데이터 없음 → 시드 데이터로 생성");
    const krs = [
      { krKey:"KR1", title:"POUR 직판 매출 5억",        targetValue:500000000, unit:"원",   order:1 },
      { krKey:"KR2", title:"B2B 종합 매출 5억",          targetValue:500000000, unit:"원",   order:2 },
      { krKey:"KR3", title:"운영 시스템 4모듈 구축",      targetValue:4,         unit:"모듈", order:3 },
    ];
    for (const kr of krs) {
      const ref = await db.collection("mainKPIs").add({
        goalId, ...kr, currentValue:0,
        createdAt:TS(), updatedAt:TS(),
      });
      idMap.keyResults[kr.krKey] = ref.id;
    }
    console.log(`  ✅ mainKPIs 시드 3개 생성`);
    return;
  }

  const ORDER = { KR1:1, KR2:2, KR3:3 };
  for (const d of snap.docs) {
    const s = d.data();
    const krKey = s.krKey || s.kpiKey || d.id;
    const ref = await db.collection("mainKPIs").add({
      goalId,
      krKey,
      title:        s.title        || krKey,
      targetValue:  s.target       || s.targetValue || 0,
      currentValue: s.current      || s.currentValue || 0,
      unit:         s.unit         || "원",
      channel:      s.channel      || "",
      order:        ORDER[krKey]   || s.order || 99,
      createdAt:    s.createdAt    || TS(),
      updatedAt:    TS(),
      _src: d.id,
    });
    idMap.keyResults[d.id] = ref.id;
    idMap.keyResults[krKey] = ref.id; // krKey로도 참조
  }
  console.log(`  ✅ ${snap.size}개 완료`);
}

// ──────────────────────────────────────────────
// STEP 4. pour-kpis(kind=result) → subKPIs
//         pour-kpis(kind=activity) → projects 내 필드로 보존
// ──────────────────────────────────────────────

// 시드 subKPIs 정의 (기존 데이터 없을 때)
const SUBKPI_SEED = {
  KR1: [
    { channelCode:"OWN",  title:"자사몰 매출 (OWN)",          targetValue:300000000, unit:"원", order:1 },
    { channelCode:"MK",   title:"마켓플레이스 매출 (MK)",      targetValue:150000000, unit:"원", order:2 },
    { channelCode:"SHOW", title:"쇼룸·전화·박람회 매출 (SHOW)",targetValue:50000000,  unit:"원", order:3 },
  ],
  KR2: [
    { channelCode:"P4",   title:"파트너사 매출 (P4)",          targetValue:300000000, unit:"원", order:1 },
    { channelCode:"P3",   title:"대리점·오프라인몰 매출 (P3)", targetValue:80000000,  unit:"원", order:2 },
    { channelCode:"H",    title:"공법·솔루션 이관 매출 (H)",   targetValue:50000000,  unit:"원", order:3 },
    { channelCode:"P5",   title:"위탁·브로커 매출 (P5)",       targetValue:40000000,  unit:"원", order:4 },
    { channelCode:"P6",   title:"온라인 도매 매출 (P6)",       targetValue:30000000,  unit:"원", order:5 },
    { channelCode:"M",    title:"시공매칭 매출 (M)",           targetValue:0,         unit:"원", order:6 },
    { channelCode:"G",    title:"조달청·관급 매출 (G)",        targetValue:0,         unit:"원", order:7 },
  ],
  KR3: [
    { channelCode:"CRM",  title:"CRM 시스템 구축",             targetValue:100, unit:"%", order:1 },
    { channelCode:"REV",  title:"매출관리 시스템 구축",         targetValue:100, unit:"%", order:2 },
    { channelCode:"ADM",  title:"어드민센터 구축",              targetValue:100, unit:"%", order:3 },
    { channelCode:"MAN",  title:"매뉴얼 33건 (7카테고리)",      targetValue:33,  unit:"건",order:4 },
  ],
};

async function migrateKPIs() {
  console.log("📈 [4/7] pour-kpis → subKPIs 마이그레이션...");
  const snap = await db.collection("pour-kpis").get();

  if (snap.empty) {
    console.log("  ℹ️  기존 데이터 없음 → 시드 데이터로 생성");
    for (const [krKey, items] of Object.entries(SUBKPI_SEED)) {
      const mainKPIId = idMap.keyResults[krKey];
      if (!mainKPIId) { console.log(`  ⚠️  ${krKey}의 mainKPIId 없음`); continue; }
      for (const item of items) {
        const ref = await db.collection("subKPIs").add({
          mainKPIId, ...item, currentValue:0,
          createdAt:TS(), updatedAt:TS(),
        });
        idMap.kpis[item.channelCode] = ref.id;
      }
    }
    console.log(`  ✅ subKPIs 시드 생성 완료`);
    return;
  }

  let resultCount = 0, activityCount = 0;
  for (const d of snap.docs) {
    const s = d.data();
    const krKey = s.krKey || "";
    const mainKPIId = idMap.keyResults[s.keyResultId] || idMap.keyResults[krKey] || "";

    if (s.kind === "result") {
      // 채널 결과지표 → subKPIs
      const ref = await db.collection("subKPIs").add({
        mainKPIId,
        title:        s.name         || s.title,
        targetValue:  s.target       || s.targetValue || 0,
        currentValue: s.current      || s.currentValue || 0,
        baseline:     s.baseline     || 0,
        unit:         s.unit         || "",
        channelCode:  s.channelCode  || "",
        source:       s.source       || "manual",
        history:      s.history      || [],
        period:       s.period       || "",
        order:        s.order        || 99,
        createdAt:    s.createdAt    || TS(),
        updatedAt:    TS(),
        _src: d.id, _kind: "result",
      });
      idMap.kpis[d.id] = ref.id;
      resultCount++;
    } else {
      // 활동지표(activity) → projects.activityKPI 필드에 보존 (별도 저장)
      await db.collection("activityKPIs").doc(d.id).set({
        ...s, mainKPIId, updatedAt: TS(), _src: d.id,
      });
      activityCount++;
    }
  }
  console.log(`  ✅ subKPIs(result): ${resultCount}개 / activityKPIs 보존: ${activityCount}개`);
}

// ──────────────────────────────────────────────
// STEP 5. pour-projects → projects
// ──────────────────────────────────────────────

// 시드 데이터 기반 subKPI 코드→채널 추론 함수
function guessSubKPIId(proj) {
  const krKey = proj.krKey || proj.keyResultId || "";
  // KR1 프로젝트는 기본적으로 자사몰(OWN) or 마켓(MK) 채널 연결
  // group 기반으로 추론
  const g = (proj.group || "").toLowerCase();
  if (g.includes("자사몰") || g.includes("광고"))   return idMap.kpis["OWN"]  || idMap.kpis["MK"] || "";
  if (g.includes("b2b") || g.includes("대리점"))    return idMap.kpis["P4"]   || idMap.kpis["P3"] || "";
  if (g.includes("조달") || g.includes("관급"))     return idMap.kpis["G"]    || "";
  if (g.includes("운영 시스템") || g.includes("개발")) return idMap.kpis["ADM"] || "";
  return "";
}

async function migrateProjects() {
  console.log("🗂  [5/7] pour-projects → projects 마이그레이션...");
  const snap = await db.collection("pour-projects").get();

  // 시드 데이터에서 직접 import할 배열 (기존 pour-projects 없을 때 사용)
  const SEED_PROJECTS = require("./workmgmt-seed-data.json").projects;

  const sourceList = snap.empty
    ? SEED_PROJECTS.map(p => ({ _isSeed:true, ...p }))
    : snap.docs.map(d => ({ _docId:d.id, ...d.data() }));

  if (snap.empty) console.log("  ℹ️  기존 데이터 없음 → 시드 데이터 55개 사용");

  const BATCH_SIZE = 400;
  let batch = db.batch();
  let batchCount = 0, total = 0;

  for (const p of sourceList) {
    const docId = p._docId || p.code || ("proj_" + Date.now() + "_" + total);
    const ref   = db.collection("projects").doc(docId);

    // krKey → mainKPIId 변환
    const krKey    = p.krKey    || p.keyResultId || "";
    const mainKPIId = idMap.keyResults[krKey] || "";

    // subKPIId 추론
    const subKPIId = p.subKPIId || guessSubKPIId(p);

    // assigneeId (ownerKey → staff doc.id)
    const ownerKey  = p.ownerKey || p.staffId || "";
    const assigneeId = idMap.staff[ownerKey] || ownerKey;

    // collabKeys → collaboratorIds
    const collaboratorIds = (p.collabKeys || p.assigneeStaffIds || []).map(k => idMap.staff[k] || k);

    batch.set(ref, {
      code:            p.code        || docId,
      krKey,
      mainKPIId,
      subKPIId,
      group:           p.group       || "",
      title:           p.name        || p.title || "",
      description:     p.description || "",
      assigneeId,
      collaboratorIds,
      status:          p.status      || "active",
      progress:        Number(p.progress || 0),
      priority:        p.priority    || "mid",
      dueDate:         p.dueDate     || "",
      activityKPIs:    (p.kpis || []).map(k => ({ name: k.name, unit: k.unit, target: k.target || 0, current: 0 })),
      createdAt:       p.createdAt   || TS(),
      updatedAt:       TS(),
      _src: p._docId || p.code,
    });

    idMap.projects[p._docId || p.code] = docId;
    batchCount++; total++;

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }
  if (batchCount > 0) await batch.commit();
  console.log(`  ✅ projects ${total}개 완료`);
}

// ──────────────────────────────────────────────
// STEP 6. pour-tasks + pour-recurring → tasks
// ──────────────────────────────────────────────
async function migrateTasks() {
  console.log("✅ [6/7] pour-tasks + pour-recurring → tasks 마이그레이션...");

  // 6-1. 일반 tasks
  const taskSnap = await db.collection("pour-tasks").get();
  if (!taskSnap.empty) {
    const BATCH_SIZE = 400;
    let batch = db.batch(), cnt = 0, total = 0;
    taskSnap.forEach(d => {
      const s = d.data();
      const ref = db.collection("tasks").doc(d.id);
      batch.set(ref, {
        projectId:     idMap.projects[s.projectId] || s.projectId || "",
        assigneeId:    idMap.staff[s.staffId] || s.staffId || "",
        title:         s.title        || "",
        type:          s.isFixed ? "fixed" : "general",
        status:        s.done ? "done"
                     : s.status === "hold" ? "hold"
                     : "todo",
        isFixed:       s.isFixed      || false,
        weekDay:       s.weekDay      || null,
        weekSlot:      s.weekSlot     || null,
        dueDate:       s.dueDate      || "",
        memo:          s.notes        || "",
        attachments:   s.attachments  || [],
        priority:      s.priority     || "mid",
        recurringId:   s.recurringId  || null,
        performedDate: s.performedDate|| null,
        doneAt:        s.doneAt       || null,
        createdAt:     s.createdAt    || TS(),
        updatedAt:     TS(),
        _src: "pour-tasks",
      });
      cnt++; total++;
      if (cnt >= BATCH_SIZE) { batch.commit(); batch = db.batch(); cnt = 0; }
    });
    if (cnt > 0) await batch.commit();
    console.log(`  ✅ 일반 tasks ${total}개 완료`);
  }

  // 6-2. pour-recurring → tasks (isFixed:true)
  const recurSnap = await db.collection("pour-recurring").get();
  if (!recurSnap.empty) {
    let batch = db.batch(), cnt = 0, total = 0;
    recurSnap.forEach(d => {
      const s = d.data();
      if (s.active === false) return; // 비활성 제외
      const ref = db.collection("tasks").doc("rec_" + d.id);
      const assignees = s.assigneeStaffIds === "all"
        ? Object.values(idMap.staff)
        : (s.assigneeStaffIds || [s.staffId]).map(k => idMap.staff[k] || k);

      // 각 담당자별 고정업무 생성
      assignees.forEach((uid, i) => {
        const r = db.collection("tasks").doc(`rec_${d.id}_${i}`);
        batch.set(r, {
          projectId:   idMap.projects[s.projectId] || s.projectId || "",
          assigneeId:  uid,
          title:       s.title        || "",
          type:        "fixed",
          status:      "todo",
          isFixed:     true,
          weekDay:     s.weekDay      || null,
          weekSlot:    null,
          dueDate:     "",
          memo:        "",
          attachments: [],
          priority:    s.priority     || "mid",
          recurringId: d.id,
          recurType:   s.recurType    || "daily",
          performedDate: null,
          createdAt:   s.createdAt    || TS(),
          updatedAt:   TS(),
          _src: "pour-recurring",
        });
        cnt++; total++;
      });
      if (cnt >= 400) { batch.commit(); batch = db.batch(); cnt = 0; }
    });
    if (cnt > 0) await batch.commit();
    console.log(`  ✅ 고정tasks(반복→isFixed) ${total}개 완료`);
  }
}

// ──────────────────────────────────────────────
// STEP 7. pour-meetings → events
// ──────────────────────────────────────────────
async function migrateMeetings() {
  console.log("📅 [7/7] pour-meetings → events 마이그레이션...");
  const snap = await db.collection("pour-meetings").get();
  if (snap.empty) { console.log("  ℹ️  데이터 없음, 스킵"); return; }

  let batch = db.batch(), cnt = 0;
  snap.forEach(d => {
    const s = d.data();
    const ref = db.collection("events").doc(d.id);
    batch.set(ref, {
      title:        s.title        || "",
      date:         s.date         || "",
      time:         s.time         || "",
      type:         s.type         || "internal",
      place:        s.place        || "",
      description:  s.agenda       || s.description || "",
      attendeeIds:  (s.attendeeStaffIds || []).map(k => idMap.staff[k] || k),
      projectId:    s.projectId    || null,
      createdById:  idMap.staff[s.createdBy] || s.createdBy || "",
      createdAt:    s.createdAt    || TS(),
      updatedAt:    TS(),
      _src: "pour-meetings",
    });
    cnt++;
    if (cnt >= 400) { batch.commit(); batch = db.batch(); cnt = 0; }
  });
  if (cnt > 0) await batch.commit();
  console.log(`  ✅ events ${snap.size}개 완료`);
}

// ──────────────────────────────────────────────
// 전체 실행
// ──────────────────────────────────────────────
async function run() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  POUR → KPI Flow 마이그레이션 시작       ║");
  console.log("╚══════════════════════════════════════════╝\n");

  const args = process.argv.slice(2);

  // --inspect 옵션: 컬렉션 목록만 확인
  if (args.includes("--inspect")) {
    await inspectCollections();
    process.exit(0);
  }

  await inspectCollections();   // 항상 먼저 출력
  await migrateStaff();
  await migrateObjectives();
  await migrateKeyResults();
  await migrateKPIs();
  await migrateProjects();
  await migrateTasks();
  await migrateMeetings();

  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║  ✅ 전체 마이그레이션 완료!              ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("\n📋 ID 매핑 요약:");
  console.log("  users:    ", Object.keys(idMap.staff).length + "명");
  console.log("  goals:    ", Object.keys(idMap.objectives).length + "개");
  console.log("  mainKPIs: ", Object.keys(idMap.keyResults).length + "개");
  console.log("  subKPIs:  ", Object.keys(idMap.kpis).length + "개");
  console.log("  projects: ", Object.keys(idMap.projects).length + "개");

  process.exit(0);
}

run().catch(e => { console.error("❌ 오류:", e); process.exit(1); });
