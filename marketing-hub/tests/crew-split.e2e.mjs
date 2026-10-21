import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
// crew.html 할 일마다 Aside 도는 PC 시험 (2026-10-19 사장님 1A · 가짜 Firebase = tests/crew.fakefb.js · 실제 Firestore 안 씀)
//   실행: 저장소 맨 위에서 python3 -m http.server 8765 → node marketing-hub/tests/crew-split.e2e.mjs  (BASE=다른 주소 · OUT=그림 폴더)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const here=path.dirname(fileURLToPath(import.meta.url)), BASE=process.env.BASE||'http://localhost:8765', OUT=process.env.OUT||'';
const FAKE=fs.readFileSync(path.join(here,'crew.fakefb.js'),'utf8');
let n=0,bad=0; const ok=(name,c,info)=>{n++;if(c)console.log('✓',name);else{bad++;console.log('✗',name,info===undefined?'':JSON.stringify(info).slice(0,500));}};
const today=new Date(Date.now()+9*3600e3).toISOString().slice(0,10);
const DB={
  'pour-os/marketing-hub/mkt-access/roles':{uploaders:['up@x.com'],admins:[]},
  'pour-os/v2/aimates/gaeul':{owners:{grohome:'minji',pourstore:'minji'},actOwners:{G:'songhee',H:'songhee'},actPc:{G:'songhee',H:'songhee'}},
  'pour-os/v2/users/minji':{name:'김민지'},'pour-os/v2/users/songhee':{name:'김송희'},
  'pour-os/v2/aiasks/x1':{id:'x1',mate:'gaeul',board:'gh-traffic',act:'G',state:'back',run:'2026-10-19',title:'메타 광고 재가동',back:{text:'예산 칸 더',byName:'김송희'},cols:['캠페인'],items:[{n:'G1',c:{캠페인:'a'}}]},
  'pour-os/v2/aiasks/x2':{id:'x2',mate:'gaeul',board:'gh-traffic',act:'D',state:'back',run:'2026-10-19',title:'쿠팡 키워드',back:{text:'고쳐',byName:'김민지'},cols:['키워드'],items:[{n:'D1',c:{키워드:'a'}}]},
};
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
async function page(hash,w){const ctx=await b.newContext({viewport:{width:w,height:900}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
  await p.addInitScript(`${process.env.PAUSED?'':'window.__NO_PAUSE=1;'}window.__DB=${JSON.stringify(DB)};window.__USER={email:'up@x.com'};`);   // ⏸ 자동화 멈춤(2026-10-21) — 기본은 켜진 동작 · PAUSED=1 이면 멈춤 화면
  await p.route(/gstatic\.com\/firebasejs\//,r=>r.fulfill({contentType:'text/javascript',body:/app-compat/.test(r.request().url())?FAKE:''}));
  await p.route(/googleapis|jsdelivr|fonts\./,r=>r.fulfill({contentType:'text/css',body:''}));
  await p.goto(BASE+'/marketing-hub/crew.html#'+hash);await p.waitForTimeout(900);return {p,errs,ctx};}
// ⏸ 멈춤 화면 (2026-10-21 사장님 '자동 모두 멈춰') — window.__NO_PAUSE 없이 열면 지시문 = 멈춤 한 장 · 고쳐서 다시·맡긴 일 안 보임 · 올리기 막힘 · 아무것도 안 씀
{ const ctx=await b.newContext({viewport:{width:375,height:900}}), p=await ctx.newPage(), errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(`window.__DB=${JSON.stringify(DB)};window.__USER={email:'up@x.com'};`);
  await p.route(/gstatic\.com\/firebasejs\//,r=>r.fulfill({contentType:'text/javascript',body:/app-compat/.test(r.request().url())?FAKE:''}));
  await p.route(/googleapis|jsdelivr|fonts\./,r=>r.fulfill({contentType:'text/css',body:''}));
  await p.goto(BASE+'/marketing-hub/crew.html#gh-traffic');await p.waitForTimeout(900);
  const g=await p.textContent('#crew-guide'), redo=await p.textContent('#crew-redo'), dis=await p.evaluate(()=>document.getElementById('save-button').disabled);
  await p.fill('#crew-text','[지표]\nvisit7\t1\n[상태]\nA: 변화 없음'); await p.click('#preview-button'); await p.waitForTimeout(300);
  const W=await p.evaluate(()=>window.__WRITES||[]);
  ok('멈춤: 지시문 = 멈춤 한 장 · 고쳐서 다시 없음 · 올리기 막힘 · 쓰기 0 · 375 넘침 없음',/\[멈춤\]/.test(g)&&!redo.includes('메타 광고 재가동')&&dis&&!W.length&&(await p.evaluate(()=>document.documentElement.scrollWidth))<=375&&!errs.length,{g:g.slice(0,80),dis,W:W.length,errs});
  if(OUT)await p.screenshot({path:path.join(OUT,'crew-paused-375.png'),fullPage:true}); await ctx.close(); }
// ① G·H 만
{ const {p,errs}=await page('gh-traffic~GH',375);
  const g=await p.textContent('#crew-guide'), head=await p.textContent('#crew-guide-head'), redo=await p.textContent('#crew-redo');
  ok('G·H 주소 = 머리·지시문에 G·H 할 일만 · 지표 없음 · 다른 할 일 없음',head.includes('G·H 할 일만')&&g.includes('이 예약 몫: G·H 할 일만')&&!/\nA\. /.test(g)&&g.includes('■ 1. 지표 — 이 예약은 올리지 않는다'),{head});
  ok('고쳐서 다시 = G 줄만 (D 안 보임)',redo.includes('메타 광고 재가동')&&!redo.includes('쿠팡 키워드'),redo.slice(0,200));
  await p.fill('#crew-text',`[지표]\nvisit7\t120\n[상태]\nA: 변화 없음\nG: 메타 2개\n[다음주]\n- x\n[A]\n요약: a\n항목\t내용\nx\ty\n[G]\n요약: 메타 안\n캠페인\t할 일\n새\t켜기`);
  await p.click('#preview-button'); const pv=await p.textContent('#preview');
  ok('미리보기 = A·지표·[다음주] 빼고 안내',pv.includes('이 예약은 G·H 할 일만 — A 는 안 올려요')&&pv.includes('지표·[다음주]는 담당 PC 예약 몫')&&/지표 0개/.test(pv),pv.slice(0,300));
  await p.click('#save-button'); await p.waitForTimeout(800);
  const W=await p.evaluate(()=>window.__WRITES), bd=W.filter(x=>x.path.endsWith('aiboards/gh-traffic')), asks=W.filter(x=>/aiasks\//.test(x.path)&&x.o&&x.o.act);
  ok('올림 = 보드엔 G 상태만 · 지표 없음 · 승인 건 G 만',bd.length===1&&JSON.stringify(bd[0].o.stHist[Object.keys(bd[0].o.stHist)[0]])==='{"G":"메타 2개"}'&&Object.keys(bd[0].o.metrics||{}).length===0&&asks.map(x=>x.o.act).join()==='G',{bd:bd.map(x=>x.o),asks:asks.map(x=>x.o.act)});
  ok('375 넘침 없음 · 오류 없음',(await p.evaluate(()=>document.documentElement.scrollWidth))<=375&&!errs.length,errs);
  if(OUT)await p.screenshot({path:path.join(OUT,'crew-only-375.png'),fullPage:true}); }
// ② 담당 PC
{ const {p,errs}=await page('gh-traffic',1280);
  const g=await p.textContent('#crew-guide'), redo=await p.textContent('#crew-redo');
  ok('담당 PC 지시문 = 다른 PC 몫 G·H 안내 · G·H 할 일 없음 · 지표 있음',g.includes('다른 PC 몫: G(김송희 PC) · H(김송희 PC)')&&!/\nG\. /.test(g)&&/\n\[지표\]/.test(g));
  ok('고쳐서 다시 = 둘 다 · G 는 다른 PC 몫 표시',redo.includes('쿠팡 키워드')&&/메타 광고 재가동[^·]*·[^]*다른 PC 몫 \(김송희 PC\)/.test(redo),redo.slice(0,300));
  await p.fill('#crew-text',`[상태]\nA: 변화 없음\nG: 메타\n[G]\n요약: 메타\n캠페인\t할 일\n새\t켜기`);
  await p.click('#preview-button'); const pv=await p.textContent('#preview');
  ok('담당 PC 에서 G 를 올리면 빼고 안내',pv.includes('G 는 다른 PC 몫 (G 김송희 PC) — 안 올려요'),pv.slice(0,200));
  ok('1280 넘침 없음 · 오류 없음',(await p.evaluate(()=>document.documentElement.scrollWidth))<=1280&&!errs.length,errs);
  if(OUT)await p.screenshot({path:path.join(OUT,'crew-main-1280.png'),fullPage:false}); }
// ③ 나눔 없는 보드 = 예전 그대로
{ const {p,errs}=await page('gh-conv',768); const g=await p.textContent('#crew-guide');
  ok('다른 보드 = 예전 그대로 (다른 PC 몫 없음)',!g.includes('다른 PC 몫')&&!g.includes('이 예약 몫')&&!errs.length,errs); }
await b.close(); console.log(`\n${n-bad}/${n} 통과`); if(bad)process.exit(1);
