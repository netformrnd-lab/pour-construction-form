/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║   POUR스토어 → KPI Flow  마이그레이션 스크립트  (검증본)    ║
 * ║   로컬:  node workers/pour-migrate.js [--dry-run]            ║
 * ║   CI  :  SERVICE_ACCOUNT_KEY 환경변수로 자동 실행           ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * 구조 매핑:
 *   pour-objectives        → goals
 *   pour-keyresults        → mainKPIs
 *   pour-kpis(kind=result) → subKPIs      (채널별 매출 KPI)
 *   pour-kpis(kind=activ.) → activityKPIs (별도 보존)
 *   pour-projects          → projects     (keyResultId → mainKPIId)
 *   pour-tasks             → tasks
 *   pour-recurring         → tasks (isFixed:true 변환)
 *   staff                  → users
 *   pour-meetings          → events
 *
 * ── 인증 (우선순위) ──
 *   1) 환경변수 SERVICE_ACCOUNT_KEY (JSON 문자열)  ← GitHub Actions
 *   2) 환경변수 GOOGLE_APPLICATION_CREDENTIALS (파일 경로)
 *   3) ./serviceAccountKey.json (workers/ 폴더 내)  ← 로컬 PC
 *
 * ── 안전장치 ──
 *   --dry-run : 쓰기 없이 "무엇이 생성될지"만 출력 (백업 먼저 원칙)
 *   재실행 안전: 모든 신규 문서를 결정적 ID로 set(merge) → 중복 생성 없음
 *   추가형: 기존 pour-* 및 staff 컬렉션은 읽기만, 절대 삭제·수정 안 함
 */

const admin = require("firebase-admin");
const path  = require("path");

const DRY = process.argv.includes("--dry-run");

// ── 인증 정보 로드 ──
function loadServiceAccount() {
  if (process.env.SERVICE_ACCOUNT_KEY) {
    try { return JSON.parse(process.env.SERVICE_ACCOUNT_KEY); }
    catch (e) { console.error("❌ SERVICE_ACCOUNT_KEY JSON 파싱 실패:", e.message); process.exit(1); }
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return require(path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS));
  }
  return require("./serviceAccountKey.json"); // 로컬 fallback (workers/ 폴더)
}

admin.initializeApp({
  credential: admin.credential.cert(loadServiceAccount()),
  projectId: "pour-app-new",
});
const db = admin.firestore();
const TS = admin.firestore.FieldValue.serverTimestamp;

// ── ID 매핑 저장소 (마이그레이션 중 참조용) ──
const idMap = {
  objectives: {}, keyResults: {}, kpis: {}, projects: {}, staff: {},
};

// ── 청크 커밋 헬퍼 (400건씩, 반드시 await) ──
async function commitInChunks(ops, label) {
  if (DRY) { console.log(`  [dry-run] ${label}: ${ops.length}개 생성 예정`); return; }
  for (let i = 0; i < ops.length; i += 400) {
    const batch = db.batch();
    for (const o of ops.slice(i, i + 400)) {
      o.opts ? batch.set(o.ref, o.data, o.opts) : batch.set(o.ref, o.data);
    }
    await batch.commit();
  }
  console.log(`  ✅ ${label} ${ops.length}개 완료`);
}

// ──────────────────────────────────────────────
// STEP 0. 기존 컬렉션 목록 확인
// ──────────────────────────────────────────────
async function inspectCollections() {
  console.log("\n📦 현재 Firestore 컬렉션 목록:");
  const cols = await db.listCollections();
  for (const c of cols) {
    const snap = await db.collection(c.id).limit(1).get();
    console.log(`  - ${c.id.padEnd(22)} (필드 예시: ${snap.empty ? "없음" : Object.keys(snap.docs[0].data()).slice(0,5).join(", ")})`);
  }
  console.log("");
}

// ──────────────────────────────────────────────
// STEP 1. staff → users
// ──────────────────────────────────────────────
const STAFF_COLOR_MAP = { songhee:"#3182F6", minji:"#8B5CF6", ran:"#00C073", chaerim:"#F97316" };
const STAFF_DEPT_MAP  = { songhee:"전략·자사몰", minji:"디자인·콘텐츠·CS", ran:"광고·B2B·영업", chaerim:"운영·CS·인프라" };

async function migrateStaff() {
  console.log("👤 [1/7] staff → users ...");
  const snap = await db.collection("staff").get();
  if (snap.empty) { console.log("  ⚠️  staff 없음 → 시드 4명"); await seedUsers(); return; }

  const ops = [];
  snap.forEach(d => {
    const s = d.data();
    const key = s.kpiMemberId || s.kpiInitial || d.id;
    idMap.staff[key] = d.id;          // kpiMemberId → doc.id
    idMap.staff[d.id] = d.id;         // doc.id → doc.id (직접참조도 허용)
    ops.push({ ref: db.collection("users").doc(d.id), opts: { merge: true }, data: {
      name: s.name || key,
      email: s.email || `${key}@pour.store`,
      dept: STAFF_DEPT_MAP[key] || s.dept || "",
      role: key === "songhee" ? "lead" : "member",
      color: STAFF_COLOR_MAP[key] || s.kpiColor || "#6B7280",
      active: s.active !== false,
      kpiMemberId: key,
      createdAt: s.createdAt || TS(),
      updatedAt: TS(),
    }});
  });
  await commitInChunks(ops, "users");
}

async function seedUsers() {
  const users = [
    { id:"songhee", name:"송희", dept:"전략·자사몰",      role:"lead",   color:"#3182F6" },
    { id:"minji",   name:"민지", dept:"디자인·콘텐츠·CS", role:"member", color:"#8B5CF6" },
    { id:"ran",     name:"란",   dept:"광고·B2B·영업",    role:"member", color:"#00C073" },
    { id:"chaerim", name:"채림", dept:"운영·CS·인프라",    role:"member", color:"#F97316" },
  ];
  const ops = users.map(u => {
    idMap.staff[u.id] = u.id;
    return { ref: db.collection("users").doc(u.id), opts:{merge:true}, data: {
      ...u, email:`${u.id}@pour.store`, active:true, kpiMemberId:u.id, createdAt:TS(), updatedAt:TS(),
    }};
  });
  await commitInChunks(ops, "users(시드)");
}

// ──────────────────────────────────────────────
// STEP 2. pour-objectives → goals  (결정적 ID = 원본 doc.id)
// ──────────────────────────────────────────────
async function migrateObjectives() {
  console.log("🎯 [2/7] pour-objectives → goals ...");
  const snap = await db.collection("pour-objectives").get();

  if (snap.empty) {
    console.log("  ℹ️  기존 없음 → 시드 goal_2026");
    idMap.objectives["seed"] = "goal_2026";
    await commitInChunks([{ ref: db.collection("goals").doc("goal_2026"), opts:{merge:true}, data:{
      title:"2026년 매출 10억 달성", targetValue:1000000000, currentValue:0, unit:"원", year:2026,
      createdAt:TS(), updatedAt:TS(),
    }}], "goals(시드)");
    return;
  }

  const ops = [];
  for (const d of snap.docs) {
    const s = d.data();
    idMap.objectives[d.id] = d.id;     // 결정적
    ops.push({ ref: db.collection("goals").doc(d.id), opts:{merge:true}, data:{
      title:        s.title       || "2026년 매출 10억 달성",
      targetValue:  s.target      || s.targetValue || 1000000000,
      currentValue: s.current     || s.currentValue || 0,
      unit:         s.unit        || "원",
      year:         s.year        || 2026,
      description:  s.description || "",
      createdAt:    s.createdAt   || TS(),
      updatedAt:    TS(),
      _src: d.id,
    }});
  }
  await commitInChunks(ops, "goals");
}

// ──────────────────────────────────────────────
// STEP 3. pour-keyresults → mainKPIs  (결정적 ID = 원본 doc.id)
// ──────────────────────────────────────────────
async function migrateKeyResults() {
  console.log("📊 [3/7] pour-keyresults → mainKPIs ...");
  const snap = await db.collection("pour-keyresults").get();
  const goalId = Object.values(idMap.objectives)[0] || "goal_2026";
  const ORDER = { KR1:1, KR2:2, KR3:3 };

  if (snap.empty) {
    console.log("  ℹ️  기존 없음 → 시드 3개");
    const krs = [
      { krKey:"KR1", title:"POUR 직판 매출 5억",   targetValue:500000000, unit:"원",   order:1 },
      { krKey:"KR2", title:"B2B 종합 매출 5억",     targetValue:500000000, unit:"원",   order:2 },
      { krKey:"KR3", title:"운영 시스템 4모듈 구축", targetValue:4,        unit:"모듈", order:3 },
    ];
    const ops = krs.map(kr => {
      idMap.keyResults[kr.krKey] = kr.krKey;   // 결정적 ID = krKey
      return { ref: db.collection("mainKPIs").doc(kr.krKey), opts:{merge:true}, data:{
        goalId, ...kr, currentValue:0, createdAt:TS(), updatedAt:TS(),
      }};
    });
    await commitInChunks(ops, "mainKPIs(시드)");
    return;
  }

  const ops = [];
  for (const d of snap.docs) {
    const s = d.data();
    const krKey = s.krKey || s.kpiKey || d.id;
    idMap.keyResults[d.id]  = d.id;   // doc.id 참조
    idMap.keyResults[krKey] = d.id;   // krKey 참조
    ops.push({ ref: db.collection("mainKPIs").doc(d.id), opts:{merge:true}, data:{
      goalId, krKey,
      title:        s.title       || krKey,
      targetValue:  s.target      || s.targetValue || 0,
      currentValue: s.current     || s.currentValue || 0,
      unit:         s.unit        || "원",
      channel:      s.channel     || "",
      order:        ORDER[krKey]  || s.order || 99,
      createdAt:    s.createdAt   || TS(),
      updatedAt:    TS(),
      _src: d.id,
    }});
  }
  await commitInChunks(ops, "mainKPIs");
}

// ──────────────────────────────────────────────
// STEP 4. pour-kpis → subKPIs(result) / activityKPIs(activity)
// ──────────────────────────────────────────────
const SUBKPI_SEED = {
  KR1: [
    { channelCode:"OWN",  title:"자사몰 매출 (OWN)",           targetValue:300000000, unit:"원", order:1 },
    { channelCode:"MK",   title:"마켓플레이스 매출 (MK)",       targetValue:150000000, unit:"원", order:2 },
    { channelCode:"SHOW", title:"쇼룸·전화·박람회 매출 (SHOW)", targetValue:50000000,  unit:"원", order:3 },
  ],
  KR2: [
    { channelCode:"P4", title:"파트너사 매출 (P4)",          targetValue:300000000, unit:"원", order:1 },
    { channelCode:"P3", title:"대리점·오프라인몰 매출 (P3)", targetValue:80000000,  unit:"원", order:2 },
    { channelCode:"H",  title:"공법·솔루션 이관 매출 (H)",   targetValue:50000000,  unit:"원", order:3 },
    { channelCode:"P5", title:"위탁·브로커 매출 (P5)",       targetValue:40000000,  unit:"원", order:4 },
    { channelCode:"P6", title:"온라인 도매 매출 (P6)",       targetValue:30000000,  unit:"원", order:5 },
    { channelCode:"M",  title:"시공매칭 매출 (M)",           targetValue:0,         unit:"원", order:6 },
    { channelCode:"G",  title:"조달청·관급 매출 (G)",        targetValue:0,         unit:"원", order:7 },
  ],
  KR3: [
    { channelCode:"CRM", title:"CRM 시스템 구축",        targetValue:100, unit:"%", order:1 },
    { channelCode:"REV", title:"매출관리 시스템 구축",    targetValue:100, unit:"%", order:2 },
    { channelCode:"ADM", title:"어드민센터 구축",         targetValue:100, unit:"%", order:3 },
    { channelCode:"MAN", title:"매뉴얼 33건 (7카테고리)", targetValue:33,  unit:"건",order:4 },
  ],
};

async function migrateKPIs() {
  console.log("📈 [4/7] pour-kpis → subKPIs / activityKPIs ...");
  const snap = await db.collection("pour-kpis").get();

  if (snap.empty) {
    console.log("  ℹ️  기존 없음 → subKPIs 시드");
    const ops = [];
    for (const [krKey, items] of Object.entries(SUBKPI_SEED)) {
      const mainKPIId = idMap.keyResults[krKey];
      if (!mainKPIId) { console.log(`  ⚠️  ${krKey} mainKPIId 없음`); continue; }
      for (const item of items) {
        const docId = `${krKey}_${item.channelCode}`;   // 결정적 ID
        idMap.kpis[item.channelCode] = docId;
        ops.push({ ref: db.collection("subKPIs").doc(docId), opts:{merge:true}, data:{
          mainKPIId, ...item, currentValue:0, createdAt:TS(), updatedAt:TS(),
        }});
      }
    }
    await commitInChunks(ops, "subKPIs(시드)");
    return;
  }

  const subOps = [], actOps = [];
  for (const d of snap.docs) {
    const s = d.data();
    const krKey = s.krKey || "";
    const mainKPIId = idMap.keyResults[s.keyResultId] || idMap.keyResults[krKey] || "";

    if (s.kind === "result") {
      idMap.kpis[d.id] = d.id;                                  // doc.id 참조
      if (s.channelCode) idMap.kpis[s.channelCode] = d.id;      // ⭐ 채널코드 참조 (subKPIId 매핑 핵심)
      subOps.push({ ref: db.collection("subKPIs").doc(d.id), opts:{merge:true}, data:{
        mainKPIId,
        title:        s.name        || s.title,
        targetValue:  s.target      || s.targetValue || 0,
        currentValue: s.current     || s.currentValue || 0,
        baseline:     s.baseline    || 0,
        unit:         s.unit        || "",
        channelCode:  s.channelCode || "",
        source:       s.source      || "manual",
        history:      s.history     || [],
        period:       s.period      || "",
        order:        s.order       || 99,
        createdAt:    s.createdAt   || TS(),
        updatedAt:    TS(),
        _src:d.id, _kind:"result",
      }});
    } else {
      // 활동지표 → activityKPIs (결정적 doc.id)
      actOps.push({ ref: db.collection("activityKPIs").doc(d.id), opts:{merge:true}, data:{
        ...s, mainKPIId, updatedAt:TS(), _src:d.id,
      }});
    }
  }
  await commitInChunks(subOps, "subKPIs(result)");
  await commitInChunks(actOps, "activityKPIs(activity)");
}

// ──────────────────────────────────────────────
// STEP 5. pour-projects → projects
// ──────────────────────────────────────────────
function guessSubKPIId(proj) {
  const g = (proj.group || "").toLowerCase();
  if (g.includes("자사몰") || g.includes("광고"))     return idMap.kpis["OWN"] || idMap.kpis["MK"] || "";
  if (g.includes("b2b") || g.includes("대리점"))      return idMap.kpis["P4"]  || idMap.kpis["P3"] || "";
  if (g.includes("조달") || g.includes("관급"))       return idMap.kpis["G"]   || "";
  if (g.includes("운영 시스템") || g.includes("개발")) return idMap.kpis["ADM"] || "";
  return "";
}

async function migrateProjects() {
  console.log("🗂  [5/7] pour-projects → projects ...");
  const snap = await db.collection("pour-projects").get();

  let sourceList;
  if (snap.empty) {
    console.log("  ℹ️  기존 없음 → 시드 55개 사용");
    // ✅ require는 빈 경우에만, 올바른 경로로 (workers/ 기준 ../workmgmt-export/)
    const SEED = require(path.join(__dirname, "..", "workmgmt-export", "workmgmt-seed-data.json"));
    sourceList = (SEED.projects || []).map(p => ({ _isSeed:true, ...p }));
  } else {
    sourceList = snap.docs.map(d => ({ _docId:d.id, ...d.data() }));
  }

  const ops = [];
  let i = 0;
  for (const p of sourceList) {
    const docId   = p._docId || p.code || ("proj_" + (i++));
    const krKey   = p.krKey || p.keyResultId || "";
    const mainKPIId = idMap.keyResults[krKey] || "";
    const subKPIId  = p.subKPIId || guessSubKPIId(p);
    const ownerKey  = p.ownerKey || p.staffId || "";
    const assigneeId = idMap.staff[ownerKey] || ownerKey;
    const collaboratorIds = (p.collabKeys || p.assigneeStaffIds || []).map(k => idMap.staff[k] || k);

    idMap.projects[docId] = docId;
    ops.push({ ref: db.collection("projects").doc(docId), opts:{merge:true}, data:{
      code:        p.code        || docId,
      krKey, mainKPIId, subKPIId,
      group:       p.group       || "",
      title:       p.name        || p.title || "",
      description: p.description || "",
      assigneeId, collaboratorIds,
      status:      p.status      || "active",
      progress:    Number(p.progress || 0),
      priority:    p.priority    || "mid",
      dueDate:     p.dueDate     || "",
      activityKPIs:(p.kpis || []).map(k => ({ name:k.name, unit:k.unit, target:k.target || 0, current:0 })),
      createdAt:   p.createdAt   || TS(),
      updatedAt:   TS(),
      _src: docId,
    }});
  }
  await commitInChunks(ops, "projects");
}

// ──────────────────────────────────────────────
// STEP 6. pour-tasks + pour-recurring → tasks
// ──────────────────────────────────────────────
async function migrateTasks() {
  console.log("✅ [6/7] pour-tasks + pour-recurring → tasks ...");
  const ops = [];

  // 6-1. 일반 tasks (결정적 doc.id)
  const taskSnap = await db.collection("pour-tasks").get();
  taskSnap.forEach(d => {
    const s = d.data();
    ops.push({ ref: db.collection("tasks").doc(d.id), opts:{merge:true}, data:{
      projectId:     idMap.projects[s.projectId] || s.projectId || "",
      assigneeId:    idMap.staff[s.staffId] || s.staffId || "",
      title:         s.title || "",
      type:          s.isFixed ? "fixed" : "general",
      status:        s.done ? "done" : s.status === "hold" ? "hold" : "todo",
      isFixed:       s.isFixed || false,
      weekDay:       s.weekDay || null,
      weekSlot:      s.weekSlot || null,
      dueDate:       s.dueDate || "",
      memo:          typeof s.notes === "string" ? s.notes : "",  // notes(배열 레거시 안전) → memo
      attachments:   Array.isArray(s.attachments) ? s.attachments : [],
      priority:      s.priority || "mid",
      recurringId:   s.recurringId || null,
      performedDate: s.performedDate || null,
      doneAt:        s.doneAt || null,
      createdAt:     s.createdAt || TS(),
      updatedAt:     TS(),
      _src: "pour-tasks",
    }});
  });

  // 6-2. pour-recurring → tasks (담당자별 isFixed, 결정적 doc.id)
  const recurSnap = await db.collection("pour-recurring").get();
  recurSnap.forEach(d => {
    const s = d.data();
    if (s.active === false) return;
    const assignees = s.assigneeStaffIds === "all"
      ? [...new Set(Object.values(idMap.staff))]
      : (Array.isArray(s.assigneeStaffIds) && s.assigneeStaffIds.length ? s.assigneeStaffIds : [s.staffId])
          .map(k => idMap.staff[k] || k);
    assignees.forEach((uid, idx) => {
      ops.push({ ref: db.collection("tasks").doc(`rec_${d.id}_${idx}`), opts:{merge:true}, data:{
        projectId:   idMap.projects[s.projectId] || s.projectId || "",
        assigneeId:  uid,
        title:       s.title || "",
        type:        "fixed", status:"todo", isFixed:true,
        weekDay:     s.weekDay || null, weekSlot:null, dueDate:"",
        memo:"", attachments:[],
        priority:    s.priority || "mid",
        recurringId: d.id, recurType: s.recurType || "daily",
        performedDate:null,
        createdAt:   s.createdAt || TS(), updatedAt:TS(),
        _src:"pour-recurring",
      }});
    });
  });

  await commitInChunks(ops, "tasks(일반+고정)");
}

// ──────────────────────────────────────────────
// STEP 7. pour-meetings → events
// ──────────────────────────────────────────────
async function migrateMeetings() {
  console.log("📅 [7/7] pour-meetings → events ...");
  const snap = await db.collection("pour-meetings").get();
  if (snap.empty) { console.log("  ℹ️  데이터 없음, 스킵"); return; }

  const ops = [];
  snap.forEach(d => {
    const s = d.data();
    ops.push({ ref: db.collection("events").doc(d.id), opts:{merge:true}, data:{
      title:       s.title || "",
      date:        s.date  || "",
      time:        s.time  || "",
      type:        s.type  || "internal",
      place:       s.place || "",
      description: s.agenda || s.description || "",
      attendeeIds: (s.attendeeStaffIds || []).map(k => idMap.staff[k] || k),
      projectId:   idMap.projects[s.projectId] || s.projectId || null,
      createdById: idMap.staff[s.createdBy] || s.createdBy || "",
      createdAt:   s.createdAt || TS(),
      updatedAt:   TS(),
      _src:"pour-meetings",
    }});
  });
  await commitInChunks(ops, "events");
}

// ──────────────────────────────────────────────
// 전체 실행
// ──────────────────────────────────────────────
async function run() {
  console.log("╔══════════════════════════════════════════╗");
  console.log(`║  POUR → KPI Flow 마이그레이션 ${DRY ? "(DRY-RUN)" : "(LIVE)  "}    ║`);
  console.log("╚══════════════════════════════════════════╝");
  if (DRY) console.log("⚠️  DRY-RUN: 어떤 데이터도 쓰지 않고 생성 예정 건수만 출력합니다.\n");

  if (process.argv.includes("--inspect")) { await inspectCollections(); process.exit(0); }

  await inspectCollections();
  await migrateStaff();
  await migrateObjectives();
  await migrateKeyResults();
  await migrateKPIs();
  await migrateProjects();
  await migrateTasks();
  await migrateMeetings();

  console.log("\n╔══════════════════════════════════════════╗");
  console.log(`║  ${DRY ? "✅ DRY-RUN 미리보기 완료 (쓰기 없음)" : "✅ 전체 마이그레이션 완료!         "}║`);
  console.log("╚══════════════════════════════════════════╝");
  console.log("📋 ID 매핑 요약:");
  console.log("  users:    ", new Set(Object.values(idMap.staff)).size + "명");
  console.log("  goals:    ", new Set(Object.values(idMap.objectives)).size + "개");
  console.log("  mainKPIs: ", new Set(Object.values(idMap.keyResults)).size + "개");
  console.log("  subKPIs:  ", new Set(Object.values(idMap.kpis)).size + "개");
  console.log("  projects: ", Object.keys(idMap.projects).length + "개");
  process.exit(0);
}

run().catch(e => { console.error("❌ 오류:", e); process.exit(1); });
