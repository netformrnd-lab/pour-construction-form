#!/bin/sh
# 두 앱을 빌드해 배포 폴더로 복사: 실사용 → os2.html, 관리자 → os2-admin.html
set -e
cd "$(dirname "$0")"
npx vite build
cp dist/index.html ../pourstore-renewal/os2.html
npx vite build --config vite.admin.config.js
cp dist-admin/admin.html ../pourstore-renewal/os2-admin.html
echo "빌드 완료: os2.html · os2-admin.html"
