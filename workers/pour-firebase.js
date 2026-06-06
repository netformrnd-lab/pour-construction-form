/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║   pour-firebase.js — KPI Flow용 Firebase CRUD               ║
 * ║   pour-app-new 프로젝트 기준 (compat SDK 10.12.0)           ║
 * ║   기존 admin.html에서 import하거나 script 태그로 로드        ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * 사용법 (HTML):
 *   <script src="pour-firebase.js"></script>
 *   <script>
 *     const users = await DB.Users.getAll();
 *   </script>
 */

// ── Firebase 초기화 (기존 앱과 중복 초기화 방지) ──
if (!firebase.apps.length) {
  firebase.initializeApp({
    apiKey:            "AIzaSyBbct9tO8nCUCjz4s9GnXQLkHuHe2FFyyU",
    authDomain:        "pour-app-new.firebaseapp.com",
    projectId:         "pour-app-new",
    storageBucket:     "pour-app-new.firebasestorage.app",
    messagingSenderId: "411031141847",
    appId:             "1:411031141847:web:e658174fd4b9652cdadf92",
  });
}
const _db      = firebase.firestore();
const _storage = firebase.storage();
const _TS      = firebase.firestore.FieldValue.serverTimestamp;

// ── 내부 유틸 ──
const _snap2arr = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));
const _ts       = () => _TS();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DB 네임스페이스 — 전역 노출
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
window.DB = {

  // ──────────────────────────────────────
  // USERS (기존: staff)
  // ──────────────────────────────────────
  Users: {
    getAll: async () => {
      const s = await _db.collection("users").where("active", "==", true).get();
      return _snap2arr(s);
    },
    get: async (uid) => {
      const d = await _db.collection("users").doc(uid).get();
      return d.exists ? { id: d.id, ...d.data() } : null;
    },
    set: (uid, data) =>
      _db.collection("users").doc(uid).set({ ...data, updatedAt: _ts() }, { merge: true }),
    update: (uid, data) =>
      _db.collection("users").doc(uid).update({ ...data, updatedAt: _ts() }),
  },

  // ──────────────────────────────────────
  // GOALS (기존: pour-objectives)
  // ──────────────────────────────────────
  Goals: {
    getAll: async () => _snap2arr(await _db.collection("goals").get()),
    add: (data) =>
      _db.collection("goals").add({ ...data, createdAt: _ts(), updatedAt: _ts() }),
    update: (id, data) =>
      _db.collection("goals").doc(id).update({ ...data, updatedAt: _ts() }),
  },

  // ──────────────────────────────────────
  // MAIN KPIs (기존: pour-keyresults / KR1·KR2·KR3)
  // ──────────────────────────────────────
  MainKPIs: {
    getAll: async () => {
      const s = await _db.collection("mainKPIs").orderBy("order").get();
      return _snap2arr(s);
    },
    getByGoal: async (goalId) => {
      const s = await _db.collection("mainKPIs")
        .where("goalId", "==", goalId).orderBy("order").get();
      return _snap2arr(s);
    },
    add: (data) =>
      _db.collection("mainKPIs").add({ ...data, createdAt: _ts(), updatedAt: _ts() }),
    // ⚠️ 리드(role=lead) 권한만 호출할 것
    update: (id, data) =>
      _db.collection("mainKPIs").doc(id).update({ ...data, updatedAt: _ts() }),
    delete: (id) => _db.collection("mainKPIs").doc(id).delete(),
  },

  // ──────────────────────────────────────
  // SUB KPIs (기존: pour-kpis, kind='result' — 채널별 매출 지표)
  // KR1: OWN/MK/SHOW | KR2: P4/P3/H/P5/P6/M/G | KR3: CRM/REV/ADM/MAN
  // ──────────────────────────────────────
  SubKPIs: {
    getAll: async () => {
      const s = await _db.collection("subKPIs").orderBy("order").get();
      return _snap2arr(s);
    },
    getByMainKPI: async (mainKPIId) => {
      const s = await _db.collection("subKPIs")
        .where("mainKPIId", "==", mainKPIId).orderBy("order").get();
      return _snap2arr(s);
    },
    add: (data) =>
      _db.collection("subKPIs").add({ ...data, createdAt: _ts(), updatedAt: _ts() }),
    update: (id, data) =>
      _db.collection("subKPIs").doc(id).update({ ...data, updatedAt: _ts() }),
    delete: (id) => _db.collection("subKPIs").doc(id).delete(),
  },

  // ──────────────────────────────────────
  // PROJECTS (기존: pour-projects)
  // 핵심 필드 추가: mainKPIId(krKey→변환), subKPIId(채널연결), collaboratorIds
  // ──────────────────────────────────────
  Projects: {
    getAll: async () => {
      const s = await _db.collection("projects").orderBy("createdAt", "desc").get();
      return _snap2arr(s);
    },
    getByMainKPI: async (mainKPIId) => {
      const s = await _db.collection("projects")
        .where("mainKPIId", "==", mainKPIId).get();
      return _snap2arr(s);
    },
    getBySubKPI: async (subKPIId) => {
      const s = await _db.collection("projects")
        .where("subKPIId", "==", subKPIId).get();
      return _snap2arr(s);
    },
    getByAssignee: async (assigneeId) => {
      const s = await _db.collection("projects")
        .where("assigneeId", "==", assigneeId)
        .where("status", "==", "active").get();
      return _snap2arr(s);
    },
    getByGroup: async (group) => {
      const s = await _db.collection("projects").where("group", "==", group).get();
      return _snap2arr(s);
    },
    add: (data) =>
      _db.collection("projects").add({ ...data, createdAt: _ts(), updatedAt: _ts() }),
    update: (id, data) =>
      _db.collection("projects").doc(id).update({ ...data, updatedAt: _ts() }),
    delete: (id) => _db.collection("projects").doc(id).delete(),
  },

  // ──────────────────────────────────────
  // TASKS (기존: pour-tasks)
  // 필드 변경: notes→memo, staffId→assigneeId, done→status
  // ──────────────────────────────────────
  Tasks: {
    // 담당자 오늘 슬롯 업무
    getTodayByAssignee: async (assigneeId, weekDay) => {
      const s = await _db.collection("tasks")
        .where("assigneeId", "==", assigneeId)
        .where("weekDay", "==", weekDay)
        .where("isFixed", "==", false).get();
      return _snap2arr(s);
    },
    // 담당자 고정업무
    getFixedByAssignee: async (assigneeId) => {
      const s = await _db.collection("tasks")
        .where("assigneeId", "==", assigneeId)
        .where("isFixed", "==", true).get();
      return _snap2arr(s);
    },
    // 프로젝트 업무 전체
    getByProject: async (projectId) => {
      const s = await _db.collection("tasks")
        .where("projectId", "==", projectId).get();
      return _snap2arr(s);
    },
    // 담당자 전체 업무 (주간 보드용)
    getAllByAssignee: async (assigneeId) => {
      const s = await _db.collection("tasks")
        .where("assigneeId", "==", assigneeId).get();
      return _snap2arr(s);
    },
    add: (data) =>
      _db.collection("tasks").add({ ...data, createdAt: _ts(), updatedAt: _ts() }),
    update: (id, data) =>
      _db.collection("tasks").doc(id).update({ ...data, updatedAt: _ts() }),
    delete: (id) => _db.collection("tasks").doc(id).delete(),

    // 파일 첨부 (Storage: task-attachments/{taskId}/{filename})
    uploadAttachment: async (taskId, file) => {
      const path = `task-attachments/${taskId}/${Date.now()}_${file.name}`;
      const ref  = _storage.ref(path);
      const snap = await ref.put(file);
      const url  = await snap.ref.getDownloadURL();
      return {
        name: file.name, url, path,
        size: file.size, contentType: file.type,
        uploadedAt: new Date().toISOString(),
      };
    },
    deleteAttachment: async (taskId, attachment) => {
      await _storage.ref(attachment.path).delete();
      const task = await _db.collection("tasks").doc(taskId).get();
      const attachments = (task.data().attachments || []).filter(a => a.path !== attachment.path);
      await _db.collection("tasks").doc(taskId).update({ attachments, updatedAt: _ts() });
    },
  },

  // ──────────────────────────────────────
  // EVENTS (기존: pour-meetings)
  // ──────────────────────────────────────
  Events: {
    getByMonth: async (year, month) => {
      const start = `${year}-${String(month).padStart(2,"0")}-01`;
      const end   = `${year}-${String(month).padStart(2,"0")}-31`;
      const s = await _db.collection("events")
        .where("date", ">=", start).where("date", "<=", end)
        .orderBy("date").get();
      return _snap2arr(s);
    },
    add: (data) =>
      _db.collection("events").add({ ...data, createdAt: _ts(), updatedAt: _ts() }),
    update: (id, data) =>
      _db.collection("events").doc(id).update({ ...data, updatedAt: _ts() }),
    delete: (id) => _db.collection("events").doc(id).delete(),
    // 2차 액션 서브컬렉션
    addAction: (eventId, data) =>
      _db.collection("events").doc(eventId).collection("actions")
        .add({ ...data, createdAt: _ts() }),
  },

  // ──────────────────────────────────────
  // PERSONAL GOALS (개인 월간목표)
  // ──────────────────────────────────────
  PersonalGoals: {
    getByUserMonth: async (userId, month) => {
      const s = await _db.collection("personalGoals")
        .where("userId", "==", userId)
        .where("month", "==", month).get();
      return _snap2arr(s);
    },
    add: (data) =>
      _db.collection("personalGoals").add({ ...data, createdAt: _ts(), updatedAt: _ts() }),
    update: (id, data) =>
      _db.collection("personalGoals").doc(id).update({ ...data, updatedAt: _ts() }),
    delete: (id) => _db.collection("personalGoals").doc(id).delete(),
  },

  // ──────────────────────────────────────
  // RETROS (월말 회고)
  // ──────────────────────────────────────
  Retros: {
    getByUser: async (userId) => {
      const s = await _db.collection("retros")
        .where("userId", "==", userId)
        .orderBy("month", "desc").get();
      return _snap2arr(s);
    },
    add: (data) =>
      _db.collection("retros").add({ ...data, createdAt: _ts(), updatedAt: _ts() }),
    update: (id, data) =>
      _db.collection("retros").doc(id).update({ ...data, updatedAt: _ts() }),
  },

  // ──────────────────────────────────────
  // AI REVIEWS (기존: pour-ai-reviews)
  // ──────────────────────────────────────
  AIReviews: {
    getByUser: async (userId) => {
      const s = await _db.collection("aiReviews")
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc").limit(20).get();
      return _snap2arr(s);
    },
    add: (data) =>
      _db.collection("aiReviews").add({ ...data, createdAt: _ts() }),
  },

  // ──────────────────────────────────────
  // 앱 전체 초기 로드 (한번에 전부 가져오기)
  // ──────────────────────────────────────
  loadAll: async (currentUserId) => {
    const [users, goals, mainKPIs, subKPIs, projects] = await Promise.all([
      DB.Users.getAll(),
      DB.Goals.getAll(),
      DB.MainKPIs.getAll(),
      DB.SubKPIs.getAll(),
      DB.Projects.getAll(),
    ]);

    // 현재 사용자 업무만 로드 (전체 tasks는 너무 많을 수 있음)
    const [todayTasks, fixedTasks] = await Promise.all([
      DB.Tasks.getTodayByAssignee(currentUserId, _todayDay()),
      DB.Tasks.getFixedByAssignee(currentUserId),
    ]);

    return { users, goals, mainKPIs, subKPIs, projects, todayTasks, fixedTasks };
  },

  // ──────────────────────────────────────
  // 실시간 리스너 (선택 사용)
  // ──────────────────────────────────────
  listen: {
    // 오늘 내 업무 실시간
    myTodayTasks: (userId, weekDay, callback) =>
      _db.collection("tasks")
        .where("assigneeId", "==", userId)
        .where("weekDay", "==", weekDay)
        .where("isFixed", "==", false)
        .onSnapshot(snap => callback(_snap2arr(snap))),

    // 고정업무 실시간
    myFixedTasks: (userId, callback) =>
      _db.collection("tasks")
        .where("assigneeId", "==", userId)
        .where("isFixed", "==", true)
        .onSnapshot(snap => callback(_snap2arr(snap))),

    // 프로젝트 목록 실시간
    projects: (callback) =>
      _db.collection("projects").orderBy("createdAt", "desc")
        .onSnapshot(snap => callback(_snap2arr(snap))),
  },
};

// ── 요일 헬퍼 ──
function _todayDay() {
  return ["일","월","화","수","목","금","토"][new Date().getDay()];
}

console.log("✅ pour-firebase.js (KPI Flow DB) 로드 완료");
