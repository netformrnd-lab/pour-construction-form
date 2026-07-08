// deploy-rules.mjs — 서비스계정으로 Firestore 보안규칙을 배포(Rules API)
// 사용: node deploy-rules.mjs <서비스계정키경로> <규칙파일경로>
import fs from 'node:fs';
import { GoogleAuth } from 'google-auth-library';

const keyPath = process.argv[2];
const rulesPath = process.argv[3];
const PROJECT = 'pourstoreproject';
const source = fs.readFileSync(rulesPath, 'utf8');

const auth = new GoogleAuth({
  keyFile: keyPath,
  scopes: ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/firebase'],
});
const client = await auth.getClient();
const base = `https://firebaserules.googleapis.com/v1/projects/${PROJECT}`;

// 1) ruleset 생성
const rs = await client.request({
  url: `${base}/rulesets`,
  method: 'POST',
  data: { source: { files: [{ name: 'firestore.rules', content: source }] } },
});
const rulesetName = rs.data.name;
console.log('ruleset 생성:', rulesetName);

// 2) release(cloud.firestore) 를 새 ruleset 으로 갱신 (없으면 생성)
const releaseName = `projects/${PROJECT}/releases/cloud.firestore`;
try {
  const up = await client.request({
    url: `${base}/releases/cloud.firestore`,
    method: 'PATCH',
    data: { release: { name: releaseName, rulesetName } },
  });
  console.log('release 갱신 완료:', up.data.name || releaseName);
} catch (e) {
  const code = e?.response?.status;
  if (code === 404) {
    const cr = await client.request({
      url: `${base}/releases`,
      method: 'POST',
      data: { name: releaseName, rulesetName },
    });
    console.log('release 생성 완료:', cr.data.name || releaseName);
  } else {
    throw e;
  }
}
console.log('✅ 규칙 배포 완료.');
