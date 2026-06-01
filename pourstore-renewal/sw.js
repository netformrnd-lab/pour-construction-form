// POUR스토어 어드민 — 미니멀 Service Worker
// 목적: PWA 설치 가능성(installability) 충족 + 오프라인 shell fallback
// 정책: 네트워크 우선, 실패 시 캐시. Firestore/Cloudflare 등 외부 API는 통과(intercept 안 함).
// scope: /pourstore-renewal/ — admin.html · workmgmt.html · preview.html 등 포함

const VERSION = 'pour-admin-v8';  // 2026-05-27 — 프로젝트 priority + 활동지표·task 보충 + 슬롯 정렬 강화
const SHELL = [
  './admin.html',
  './workmgmt.html',
  './manifest.webmanifest',
  './admin-icon.svg',
  './admin-icon-maskable.svg',
];

// install: shell 캐시 (실패해도 SW는 활성화)
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(SHELL).catch((err) => console.warn('[sw] precache 일부 실패:', err)))
      .catch(() => {})
  );
  self.skipWaiting();
});

// activate: 구버전 캐시 정리 + 클라이언트 즉시 제어
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// fetch: navigation만 인터셉트 (HTML shell). 그 외(JS/CSS/이미지/API)는 브라우저 기본 처리.
// Firestore·구글폰트·외부 CDN은 절대 가로채지 않음 (인증·실시간 동기화 깨짐 방지).
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.mode !== 'navigate') return;
  const url = new URL(req.url);
  // 동일 출처 + /pourstore-renewal/ scope만
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith('/pourstore-renewal/')) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        // 응답 정상이면 캐시 갱신
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy).catch(() => {}));
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('./admin.html')))
  );
});

// 메시지: 페이지에서 SW 갱신 강제 요청
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
