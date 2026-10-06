#!/bin/sh
# 두 앱 + 보고서 공유 페이지를 빌드해 배포 폴더로 복사: 실사용 → os2.html, 관리자 → os2-admin.html, 공유 보고서 → os2-report.html
set -e
cd "$(dirname "$0")"
npx vite build
cp dist/index.html ../pourstore-renewal/os2.html
npx vite build --config vite.admin.config.js
cp dist-admin/admin.html ../pourstore-renewal/os2-admin.html
npx vite build --config vite.report.config.js
cp dist-report/report.html ../pourstore-renewal/os2-report.html
echo "빌드 완료: os2.html · os2-admin.html · os2-report.html"
