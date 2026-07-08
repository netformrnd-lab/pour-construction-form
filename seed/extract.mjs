#!/usr/bin/env node
/**
 * extract.mjs — 원본 대시보드 HTML에서 대외비 데이터를 뽑아 seed/data.json 생성
 *
 * 사용법:  node extract.mjs <원본HTML경로>
 *   예)   node extract.mjs ./POUR스토어_가격마진_대시보드.html
 *
 * 출력:  seed/data.json  (⚠️ 대외비 — .gitignore 대상, 절대 커밋 금지)
 *
 * 원칙(CLAUDE.md): 수치 값은 화면/로그에 출력하지 않는다. 개수만 로그로 남긴다.
 * 원본 HTML의 첫 <script> 블록(데이터 정의부)만 샌드박스(vm)에서 평가해
 * CH_DEF / RAW / PKG_DEF / SEC_BLOB / ORDER8 / MOQ_TIERS / CH_VAR_DEFAULT / CODE_RANK 를 회수한다.
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const srcArg = process.argv[2];
if (!srcArg) {
  console.error('❌ 원본 HTML 경로를 인자로 주세요.  예: node extract.mjs ./POUR스토어_가격마진_대시보드.html');
  process.exit(1);
}
const srcPath = path.resolve(process.cwd(), srcArg);
if (!fs.existsSync(srcPath)) {
  console.error(`❌ 파일을 찾을 수 없습니다: ${srcPath}`);
  process.exit(1);
}

const html = fs.readFileSync(srcPath, 'utf8');

// 데이터 정의부: 첫 번째 <script> ~ 그에 대응하는 </script>
const start = html.indexOf('<script>');
const end = html.indexOf('</script>', start);
if (start < 0 || end < 0) {
  console.error('❌ 데이터 <script> 블록을 찾지 못했습니다. 원본 구조가 바뀌었는지 확인하세요.');
  process.exit(1);
}
const dataCode = html.slice(start + '<script>'.length, end);

// 샌드박스에서 평가 (DOM 접근 없음 — 순수 데이터 정의부라 안전)
// top-level const/let 은 vm context 전역에 붙지 않으므로, 말미에서 명시적으로 내보낸다.
const EXPORTS = ['CH_DEF', 'RAW', 'SEC_BLOB', 'ORDER8', 'MOQ_TIERS', 'CH_VAR_DEFAULT', 'CODE_RANK'];
const ctx = {};
vm.createContext(ctx);
try {
  vm.runInContext(
    dataCode + `\n;Object.assign(globalThis, { ${EXPORTS.join(', ')} });`,
    ctx,
    { filename: 'data-block.js' }
  );
} catch (e) {
  console.error('❌ 데이터 블록 평가 실패:', e.message);
  process.exit(1);
}

const { CH_DEF, RAW, SEC_BLOB, ORDER8, MOQ_TIERS, CH_VAR_DEFAULT, CODE_RANK } = ctx;
for (const [k, v] of Object.entries({ CH_DEF, RAW, SEC_BLOB, ORDER8, MOQ_TIERS, CH_VAR_DEFAULT, CODE_RANK })) {
  if (v == null) {
    console.error(`❌ 데이터 심볼 누락: ${k} — 원본 구조 확인 필요`);
    process.exit(1);
  }
}

// ── 채널: 표시 순서(ord) 부여 ──
const channels = CH_DEF.map((c, i) => ({ ord: i, ...c }));

// ── 제품: RAW(패키지 확장 포함) → {seq, kind, cat, name, spec, cost, pr:{uid:price}} ──
const products = RAW.map((r, i) => {
  const [cat, name, spec, cost, prices] = r;
  const pr = {};
  prices.forEach((v, j) => { if (v != null) pr[ORDER8[j]] = v; });
  return { seq: i, kind: cat === '패키지' ? 'pkg' : 'raw', cat, name, spec, cost: cost ?? null, pr };
});

// ── 계산/정책 상수 (Infinity는 JSON 불가 → null 로 저장, 앱에서 복원) ──
const calc = {
  moqTiers: MOQ_TIERS.map(t => ({ label: t.label, f: t.f, min: t.min, max: t.max === Infinity ? null : t.max })),
  chVar: CH_VAR_DEFAULT,
  codeRank: CODE_RANK,
};

const out = {
  channels,
  products,
  config: {
    secure: { blob: SEC_BLOB },
    calc,
  },
};

const outPath = path.join(__dirname, 'data.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 0), 'utf8');

// 값은 출력하지 않는다 — 개수만
console.log('✅ 추출 완료 → seed/data.json');
console.log(`   · channels : ${channels.length}건`);
console.log(`   · products : ${products.length}건  (raw ${products.filter(p => p.kind === 'raw').length} / pkg ${products.filter(p => p.kind === 'pkg').length})`);
console.log(`   · config   : secure(blob ${SEC_BLOB.length}자) · calc(moqTiers ${calc.moqTiers.length} · chVar ${Object.keys(calc.chVar).length} · codeRank ${Object.keys(calc.codeRank).length})`);
console.log('⚠️  data.json 은 대외비입니다 — 커밋 금지(.gitignore 확인).');
