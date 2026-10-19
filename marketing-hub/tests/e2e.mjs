// 마케팅 허브 E2E 시험 — 에뮬레이터(auth·firestore)에서 업로더 계정 만들기 → 5종 업로드 → 관리자 정리 → 재업로드 중복 없음 · 375/768/1280 넘침
// 실행(rules.test.mjs 와 같은 폴더 준비 + cdn/ 에 firebase 10.12.0 compat 3개 + naver-euckr.csv·naver-v2.csv):
//   marketing-hub 를 127.0.0.1:5500 으로 띄우고 OUT=<스크린샷 폴더> npx firebase emulators:exec --only auth,firestore --project pour-app-new "node e2e.mjs"
// 실제 Firebase(googleapis 등) 요청은 막고 0건인지 검사한다.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
async function route(p){await p.route(/gstatic\.com\/firebasejs\/10\.12\.0\/(firebase-[a-z]+-compat\.js)/,(r)=>{const n=r.request().url().match(/(firebase-[a-z]+-compat\.js)/)[1];r.fulfill({contentType:'application/javascript',body:readFileSync('cdn/'+n)});});
  await p.route(/^https?:\/\/[^/]*(googleapis\.com|firebaseio\.com|firebaseapp\.com)/,(r)=>{console.log('  ✗ 실제 Firebase 요청 차단:',r.request().url().slice(0,90));globalThis.PROD_HITS=(globalThis.PROD_HITS||0)+1;r.abort();});
  await p.route(/cdn\.jsdelivr\.net/,(r)=>r.fulfill({contentType:'text/css',body:''}));}
const BASE='http://127.0.0.1:5500', OUT=process.env.OUT;
const signUp=(email,pw)=>fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=x',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password:pw,returnSecureToken:true})}).then(r=>r.json());
const getDoc=async(path)=>{const r=await fetch(`http://127.0.0.1:8080/v1/projects/pour-app-new/databases/(default)/documents/${path}`,{headers:{Authorization:'Bearer owner'}});return r.ok?(await r.json()).fields:null;};
const encF=(v)=>v===null?{nullValue:null}:typeof v==='boolean'?{booleanValue:v}:typeof v==='number'?{integerValue:String(v)}:Array.isArray(v)?{arrayValue:{values:v.map(encF)}}:typeof v==='object'?{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,encF(x)]))}}:{stringValue:String(v)};
const putDoc=(path,obj,mask)=>fetch(`http://127.0.0.1:8080/v1/projects/pour-app-new/databases/(default)/documents/${path}${mask?'?'+mask.map(m=>'updateMask.fieldPaths='+m).join('&'):''}`,{method:'PATCH',headers:{'content-type':'application/json',Authorization:'Bearer owner'},body:JSON.stringify({fields:Object.fromEntries(Object.entries(obj).map(([k,v])=>[k,encF(v)]))})}).then(r=>r.json());
const list=async(c,top)=>{const r=await fetch(`http://127.0.0.1:8080/v1/projects/pour-app-new/databases/(default)/documents/${top?'':'pour-os/marketing-hub/'}${c}?pageSize=300`,{headers:{Authorization:'Bearer owner'}});const j=await r.json();return (j.documents||[]);};
await signUp('netformrnd@gmail.com','ownerpw123');
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--ignore-certificate-errors']});
const log=(...a)=>console.log(...a);
let fails=0; const check=(n,c)=>{log(c?'  ✓':'  ✗',n);if(!c)fails++;};
async function page(w){const ctx=await b.newContext({viewport:{width:w,height:900},ignoreHTTPSErrors:true});const p=await ctx.newPage();await route(p);
  await p.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{const st=document.createElement('style');st.textContent='.firebase-emulator-warning{display:none!important}';document.head.appendChild(st);})); /* 시험용 에뮬레이터 띠가 아래 버튼을 가림 */
  p.on('pageerror',e=>log('  [pageerror]',e.message));p.on('console',m=>{if(m.type()==='error')log('  [console]',m.text().slice(0,300));});return p;}
const overflow=(p)=>p.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
const KD=(n)=>new Date(Date.now()+9*3600e3-n*864e5).toISOString().slice(0,10), D1=KD(3), D2=KD(2), D3=KD(1);   // 리포트 날짜 = 오늘(한국)에서 3·2·1일 전 (광고는 최근 7일만 봄)

// 1) 대표: 계정 탭에서 Aside 업로더 만들기
let p=await page(375);
await p.goto(BASE+'/index.html?emu=1');
await p.fill('#lg-email','netformrnd@gmail.com');await p.fill('#lg-pw','ownerpw123');await p.click('#lg-btn');
await p.waitForSelector('nav button[data-tab="acct"]');
await p.click('nav button[data-tab="acct"]');
await p.fill('#ac-email','aside-upload@example.com');await p.fill('#ac-name','Aside');await p.selectOption('#ac-role','uploader');
await p.click('[data-acct="add"]');await p.waitForSelector('.temp code');
const pw=await p.textContent('.temp code');check('임시 비밀번호 표시',pw.length>10);
await p.screenshot({path:OUT+'/acct-375.png',fullPage:true});
check('계정 탭 375 가로 넘침 없음',await overflow(p)<=0);
await p.context().close();

// 2) Aside: 대시보드 주소로 들어가도 올리기 화면으로
p=await page(375);
await p.goto(BASE+'/index.html?emu=1');
await p.fill('#lg-email','aside-upload@example.com');await p.fill('#lg-pw',pw);await p.click('#lg-btn');
await p.waitForTimeout(4000);log('   url',p.url(),await p.textContent('body').then(t=>t.slice(0,200)));await p.waitForURL(/upload\.html\?emu=1/,{timeout:5000});check('업로더 → upload.html 로 이동',true);
await p.waitForSelector('#upload-section:not([hidden])');
const yday=new Date(Date.now()+9*3600e3-864e5).toISOString().slice(0,10);check('날짜 기본값 = 어제',(await p.inputValue('#report-date'))===yday);
async function up(channel,date,{text,file}){
  await p.selectOption('#channel',channel);await p.fill('#report-date',date);
  if(file)await p.setInputFiles('#csv-file',file);else{await p.setInputFiles('#csv-file',[]);await p.fill('#csv-text',text);}
  await p.click('#preview-button');await p.waitForFunction(()=>document.querySelector('#status-message').textContent.length>0);
  const pv=await p.textContent('#status-message');
  await p.click('#save-button');await p.waitForFunction(()=>/^(완료|실패)/.test(document.querySelector('#status-message').textContent));
  return [pv,await p.textContent('#status-message')];
}
// 오류 미리보기
await p.selectOption('#channel','naver_ads');await p.fill('#csv-text','키워드,노출수\n방수,10');await p.click('#preview-button');
await p.waitForSelector('#preview-errors div');
check('필수 열 없음 → 빨간 오류 문구',(await p.textContent('#preview-errors')).includes("오류: '비용' 열이 없습니다."));
await p.screenshot({path:OUT+'/upload-error-375.png',fullPage:true});
let r=await up('cafe24',D1,{text:'상품코드,상품명,옵션,판매수량,판매합계\nP001,곰팡이젤,단품,10,"159,000"\nP002,방수테이프,,1,"10,000"'});log('  ',r);check('카페24 (3일 전) 완료',r[1]===`완료: ${D1} 카페24 판매 2행`);
r=await up('cafe24',D2,{text:'상품코드\t상품명\t옵션\t판매수량\t판매합계\nP001\t곰팡이젤\t단품\t14\t"222,600"\nP001\t곰팡이젤\t2개세트\t2\t"51,600"'});log('  ',r);check('카페24 (2일 전 · 탭 붙여넣기) 완료',r[1]===`완료: ${D2} 카페24 판매 2행`);
r=await up('naver_ads',D2,{file:'naver-euckr.csv'});log('  ',r);check('네이버 EUC-KR 파일 완료',r[1]===`완료: ${D2} 네이버 광고 3행`);
r=await up('coupang_ads',D2,{text:'캠페인명\t키워드\t노출수\t클릭수\t광고비\t총 전환매출액(14일)\n자동\t실리콘곰팡이\t900\t40\t20,000\t120,000'});log('  ',r);check('쿠팡 완료',r[1].startsWith(`완료: ${D2} 쿠팡 광고 1행`));
r=await up('stock',D2,{text:'상품코드,상품명,가용재고\nP001,곰팡이젤,20\nP002,방수테이프,50'});log('  ',r);check('재고 완료',r[1]===`완료: ${D2} 재고 2행`);
check('업로드 375 가로 넘침 없음',await overflow(p)<=0);
await p.screenshot({path:OUT+'/upload-375.png',fullPage:true});
await p.context().close();

// 3) 대표: 대시보드 열면 정리
for(const w of [1280,768,375]){
  p=await page(w);await p.goto(BASE+'/index.html?emu=1');
  await p.fill('#lg-email','netformrnd@gmail.com');await p.fill('#lg-pw','ownerpw123');await p.click('#lg-btn');
  await p.waitForSelector('.kpis');await p.waitForTimeout(2500);
  if(w===1280){const m=await p.textContent('.msg').catch(()=>'');log('   msg:',m);check('5건 정리 성공',m.includes('5건 정리 — 성공 5'));}
  check(`요약 ${w} 가로 넘침 없음`,await overflow(p)<=0);
  await p.screenshot({path:`${OUT}/home-${w}.png`,fullPage:true});
  for(const t of ['stock','ads','sales','log']){await p.click(`nav button[data-tab="${t}"]`);await p.waitForTimeout(200);check(`${t} ${w} 넘침 없음`,await overflow(p)<=0);if(w!==768)await p.screenshot({path:`${OUT}/${t}-${w}.png`,fullPage:true});}
  if(w===1280){
    await p.click('nav button[data-tab="stock"]');const st=await p.textContent('main');
    check('P001 발주 필요 (26개÷14일 → 남은 10.8일 · 발주 49)',st.includes('곰팡이젤')&&st.includes('10.8일')&&st.includes('49'));
    await p.click('nav button[data-tab="ads"]');const ad=await p.textContent('main');
    check('우레탄방수 = 끌 키워드',/끌 키워드 1[\s\S]*우레탄방수/.test(ad));
    check('실리콘곰팡이·옥상방수 = 올릴 키워드',/올릴 키워드 2[\s\S]*실리콘곰팡이[\s\S]*옥상방수/.test(ad));
  }
  await p.context().close();
}
const ads1=(await list('mkt-ads')).length, st1=(await list('mkt-upload-status')).length;
check('ads 4건',ads1===4);check('status 5건',st1===5);

// 4) 같은 날짜 다시 올리기 (우레탄방수 빠진 리포트) → 중복 없이 바뀜
p=await page(375);await p.goto(BASE+'/upload.html?emu=1');
await p.fill('#login-email','aside-upload@example.com');await p.fill('#login-password',pw);await p.click('#login-button');
await p.waitForSelector('#upload-section:not([hidden])');
check('올리기 375: 머리에 작업대 링크 · 넘침 없음',await p.isVisible('#go-drafts')&&await overflow(p)<=0);
r=await up('naver_ads',D2,{file:'naver-v2.csv'});check('재업로드 완료',r[1]===`완료: ${D2} 네이버 광고 2행`);
await p.context().close();
p=await page(1280);await p.goto(BASE+'/index.html?emu=1');
await p.fill('#lg-email','netformrnd@gmail.com');await p.fill('#lg-pw','ownerpw123');await p.click('#lg-btn');
await p.waitForSelector('.kpis');await p.waitForTimeout(2500);
const ads2=(await list('mkt-ads')).map(d=>d.fields.keyword.stringValue).sort();
log('   ads after:',ads2);check('재업로드 후 ads 3건 (네이버 2 + 쿠팡 1) · 우레탄방수 사라짐',ads2.length===3&&!ads2.includes('우레탄방수'));
await p.click('nav button[data-tab="log"]');await p.screenshot({path:OUT+'/log-1280b.png',fullPage:true});

// 5) 옵시디언으로 보내기 링크 (375)
p=await page(375);await p.goto(BASE+'/index.html?emu=1');
await p.fill('#lg-email','netformrnd@gmail.com');await p.fill('#lg-pw','ownerpw123');await p.click('#lg-btn');
await p.waitForSelector('#obsidian-send');await p.waitForTimeout(1500);
const href=await p.getAttribute('#obsidian-send','href');const dec=decodeURIComponent(href);
check('옵시디언 링크 = 오늘 숫자 덮어쓰기 (볼트 이름 빈칸 = 지금 열린 볼트)',href.startsWith('obsidian://new?file=')&&href.endsWith('&overwrite=true')&&dec.includes('file=05 오늘 숫자'));
check('노트에 발주 필요·끌 키워드',dec.includes('| P001 | 곰팡이젤 |')&&dec.includes('**옥상방수**'));
log('   링크 길이',href.length);
check('요약 375 넘침 없음(옵시디언 카드)',await overflow(p)<=0);
await p.screenshot({path:OUT+'/home-obs-375.png',fullPage:true});
await p.click('nav button[data-tab="set"]');await p.waitForTimeout(200);
const hub=await p.getAttribute('#obs-hub','href');check('허브 연결 = append',hub.includes('append=true')&&decodeURIComponent(hub).includes('![[05 오늘 숫자]]'));
check('설정 375 넘침 없음',await overflow(p)<=0);
await p.screenshot({path:OUT+'/set-375.png',fullPage:true});
await p.context().close();

// 5-2) 고객의 소리: 대표가 직원 계정 만들기 → 직원은 voc.html 에서 쓰기만
p=await page(375);await p.goto(BASE+'/index.html?emu=1');
await p.fill('#lg-email','netformrnd@gmail.com');await p.fill('#lg-pw','ownerpw123');await p.click('#lg-btn');
await p.waitForSelector('nav button[data-tab="acct"]');await p.click('nav button[data-tab="acct"]');
await p.fill('#ac-email','cs@example.com');await p.fill('#ac-name','CS 담당');await p.selectOption('#ac-role','staff');
await p.click('[data-acct="add"]');await p.waitForSelector('.temp code');
const spw=await p.textContent('.temp code');check('직원 계정 · 직원 표시',(await p.textContent('.acct-list')).includes('직원 · 고객의 소리'));
await p.context().close();
p=await page(375);await p.goto(BASE+'/index.html?emu=1');
await p.fill('#lg-email','cs@example.com');await p.fill('#lg-pw',spw);await p.click('#lg-btn');
await p.waitForURL(/voc\.html\?emu=1/,{timeout:10000});check('직원 → 대시보드 주소로 와도 voc.html',true);
await p.waitForSelector('#voc-section:not([hidden])');
async function voc(product,type,text){
  await p.fill('#voc-product',product);await p.click(`#voc-types label:has(input[value="${type}"])`);await p.fill('#voc-text',text);
  await p.evaluate(()=>{document.querySelector('#status-message').textContent='';});
  await p.click('#save-button');await p.waitForFunction(()=>/^(완료|실패)/.test(document.querySelector('#status-message').textContent));
  return p.textContent('#status-message');
}
await p.click('#save-button');check('빈 칸 → 실패 문구',(await p.textContent('#status-message')).startsWith('실패: 제품을 고르거나 적으세요.'));
let vr=await voc('실리콘','하자·안전','바르고 나서 손이 따갑다고 함 010-2222-3333');log('  ',vr);
check('하자·안전 저장 · 번호 가림 · 급함 알림',vr==='완료: 실리콘 하자·안전 저장 (개인정보 1곳 가림) · 급함으로 바로 알림');
for(const t of ['냄새가 강함','냄새 때문에 환불 문의','냄새 빠지는 시간 문의'])vr=await voc('곰팡이젤','불만',t);
check('곰팡이젤 불만 3건 저장',vr==='완료: 곰팡이젤 불만 저장');
check('오늘 쓴 것 4건 · 번호는 가린 채',(await p.$$('#mine > div')).length===4&&(await p.textContent('#mine')).includes('(번호)')&&!(await p.textContent('#mine')).includes('3333'));
check('voc.html 375 넘침 없음',await overflow(p)<=0);await p.screenshot({path:OUT+'/voc-staff-375.png',fullPage:true});
await p.context().close();
const vocs=await list('mkt-voc');check('mkt-voc 4건 · 전화번호 없음',vocs.length===4&&!JSON.stringify(vocs).includes('3333'));
const urgId='mkt-voc-'+vocs.find(d=>d.fields.type.stringValue==='하자·안전').name.split('/').pop();
check('업무OS 확인할 것: 하자·안전 한 줄 (내용 없음)',await getDoc('pour-os/v2/links/'+urgId).then(f=>f&&f.open.booleanValue===true&&f.title.stringValue==='실리콘 하자·안전'&&!JSON.stringify(f).includes('따갑')));

// 5-3) AI 팀원 결과 (Claude 루틴 도구) → 업무OS AI 승인 (2026-10-12 'AI → 담당 → 리드 → 본부장') · 허브는 진행 상태 + 미리보기 · 최종 승인 뒤에만 맡기기
const today=new Date(Date.now()+9*3600e3).toISOString().slice(0,10); // yday = 위(어제)
// 예전 검토 줄(업무OS 승인 전 방식) 하나 — 그대로 [검토 끝]으로 닫힘
const LEG='mkt-ai-pori-'+yday+'-legacy';
await putDoc('pour-os/v2/links/'+LEG,{src:'mkt',kind:'aiReview',open:true,member:'pori',title:'검토: 포리 예전 원고',sub:'03 작업/예전 원고.md',note:'03 작업/예전 원고.md',date:yday});
await putDoc('pour-os/marketing-hub/mkt-notes/'+LEG,{member:'pori',title:'검토: 포리 예전 원고',note:'03 작업/예전 원고.md',date:yday,body:'# 예전 원고\n\n본문'});
// 볼트 대신 임시 폴더에 노트 하나 (루틴이 쓴 것처럼) → team_link.py 가 업무OS 승인 + 본문을 올림
const VAULT=mkdtempSync(join(tmpdir(),'vault-'));mkdirSync(join(VAULT,'03 작업'));
writeFileSync(join(VAULT,'03 작업',`${today} 블로그 원고 3.md`),'---\n유형: 작업\n상태: 검토대기\n---\n# 시험 원고\n> 사진 자리는 유형 번호\n\n## 요청 내용\n- 주제 2\n\n## 결과물\n\n## 1. 겨울 전 옥상 균열 보수 — POUR스토어 · [[PS-S011 크랙 방수 세트]]\n**제목 A안**: 옥상 균열 보수 이유\n**제목 B안**: 균열 보수 순서\n\n[썸네일: 메인 「옥상 균열, 겨울 전에」 / 서브 「셀프 보수 순서」 / 구도: 금 간 옥상 바닥]\n> \"비 오면 천장에 얼룩이 생겨요.\"\n> \"작은 금도 막아야 하나요?\"\n\n[사진: 유형 02 시공전 — 금이 간 옥상]\n[링크: 크랙 방수 세트 구매하기 → https://www.pourstore.net]\n\n### 이렇게 합니다\n| 제품 | 정가 |\n|---|--:|\n| [[PS-S011 크랙 방수 세트|크랙 세트]] | 226,000 |\n\n- 바탕 정리\n- 균열 메우기 <b>굵게아님</b>\n\n**해시태그**: #옥상균열 #POUR스토어\n\n**썸네일 문구 3안**\n1. 겨울 전 필수\n\n## 2. 카페 — [[GH-P004 미끄럼방지 페인트]]\n> **카페 규정 확인 후 게시**\n**제목**: [정보] 현관 미끄럼 체크\n카페 본문\n> ⚠️ 검토 메모: 광고 표기\n\n## 3. 지식인 — 옥상 균열 질문 답변\n**제목**: 옥상 균열 셀프 보수 가능한가요?\n작은 균열은 셀프로 가능합니다.\n\n## 체크\n- [ ] 확인\n');
const TL=(...a)=>execFileSync('python3',[process.env.TOOLS+'/team_link.py',...a],{env:{...process.env,MKT_VAULT:VAULT}}).toString().trim();
const tlo=TL('open','여름','블로그 원고 3',`03 작업/${today} 블로그 원고 3.md`);log('  ',tlo);
// 사용금지어 (사장님 2026-10-19) — 게시 글(## 결과물 ~ ## 체크)에 걸린 말이 있으면 open 이 안 올림 · 줄 번호 · 바꿔 쓰기 · 요청·체크 칸은 안 봄 · 쓰기 0
writeFileSync(join(VAULT,'03 작업',`${today} 금지어 원고.md`),'---\n유형: 작업\n---\n# 금지어\n## 요청 내용\n- 친환경 페인트 글 (요청 칸은 안 봄)\n\n## 결과물\n\n## 1. 페인트 — POUR스토어\n**제목 A안**: 완벽 방수 페인트\n본문: 무독성이라 안전합니다\n\n## 체크\n- [ ] 최고\n');
let bo='';try{TL('open','여름','금지어 원고',`03 작업/${today} 금지어 원고.md`);}catch(e){bo=String(e.stdout||'')+String(e.stderr||'');}
check('사용금지어: team_link open 이 안 올림 · 줄 번호 · 바꿔 쓰기 · --banned-ok 안내 · 요청·체크 칸은 안 봄',bo.includes('사용금지어 3곳 — 올리지 않았어요')&&bo.includes('완벽 (줄 11) → ')&&bo.includes('무독성 (줄 12)')&&bo.includes('--banned-ok')&&!bo.includes('친환경')&&!bo.includes('최고'));   // 2026-10-14 아침 루틴 = B2C 크루 여름 (하루·포리·에코 쉼)
const AID=(/(ai_yeoreum_\d{8}_[0-9a-f]{8})/.exec(tlo)||[])[1], nid=AID&&(await getDoc('pour-os/v2/aiasks/'+AID)).noteId.stringValue;
check('도구: 업무OS 승인 한 건(담당 미정 · 관리자 누구나) · 검토 줄은 안 만듦',!!nid&&(await getDoc('pour-os/v2/aiasks/'+AID)).to.stringValue===''&&!(await getDoc('pour-os/v2/links/'+nid)));
// 업무OS 에서 담당을 정함(남윤정) → 허브엔 '남윤정 차례' (사람 문서는 그 한 명만 읽음)
await putDoc('pour-os/v2/users/u_yj',{id:'u_yj',name:'남윤정',phone:'010-9999-8888'});
await putDoc('pour-os/v2/aiasks/'+AID,{to:'u_yj',owner:'u_yj'},['to','owner']);
for(const w of [1280,768,375]){
  p=await page(w);await p.goto(BASE+'/index.html?emu=1');
  await p.fill('#lg-email','netformrnd@gmail.com');await p.fill('#lg-pw','ownerpw123');await p.click('#lg-btn');
  await p.waitForSelector('.kpis');await p.waitForTimeout(2500);
  if(w===1280){
    const home=await p.textContent('main');
    check('요약: AI 승인 진행 1 · 예전 검토 줄 1 · 고객의 소리 급함 2',home.includes('AI 승인 진행 1')&&home.includes('예전 검토 줄 1')&&home.includes('급함 2'));
    const vg=await getDoc('pour-os/v2/links/mkt-vocg-'+(await p.evaluate(()=>MktCore.hash('곰팡이젤|불만'))));
    check('업무OS: 같은 이야기 3건 한 줄',vg&&vg.open.booleanValue===true&&vg.title.stringValue==='곰팡이젤 불만 3건');
    const dec=decodeURIComponent(await p.getAttribute('#obsidian-send','href'));
    check('옵시디언 노트에 고객의 소리',dec.includes('## 🗣 고객의 소리 — [[온유]] (최근 7일 4건 · 안 끝난 것 4)')&&dec.includes('바르고 나서 손이 따갑다고 함 (번호)'));
  }
  check(`요약 ${w} 넘침 없음 (AI 팀·고객의 소리 카드)`,await overflow(p)<=0);
  for(const t of ['team','voc']){await p.click(`nav button[data-tab="${t}"]`);await p.waitForTimeout(200);check(`${t} ${w} 넘침 없음`,await overflow(p)<=0);await p.screenshot({path:`${OUT}/${t}-${w}.png`,fullPage:true});}
  if(w===375){
    await p.click('nav button[data-tab="team"]');const tm=await p.textContent('main');
    check('AI 팀: 팀원 15(여름 + 14 · 하루·포리·에코 없음) · 여름 승인 대기(남윤정 차례) · 예전 검토 줄 1',tm.includes('팀원 15')&&tm.includes('가동 1')&&JSON.stringify((await p.$$eval('.team-grid details.tm summary .h > b',x=>x.map(y=>y.textContent))).filter(n=>['여름','하루','포리','에코'].includes(n)))==='["여름"]'&&(await p.$eval('.team-grid details.tm summary .h > b',x=>x.textContent))==='여름'&&tm.includes('여름 · 블로그 원고 3')&&tm.includes('남윤정 차례')&&!tm.includes('9999')&&tm.includes('예전 검토 줄 1')&&!!(await p.$(`main a[href$="os2.html#a-${AID}"]`)));
    // ⏰ 자동 작업 — 카테고리 · 걸어 둔 것/계획 (2026-10-12)
    const ac=await p.textContent('#auto-card');
    check('자동 작업: 동작 중·준비 중·계획 · AI 콘텐츠 아침(여름) · 크루 Aside 10 = 담당 PC 평일 09:00 · 이음 15:00 (2026-10-15 · 10-17)',/동작 중 4 · 준비 중 14 · 계획 \d+/.test(ac)&&ac.includes('AI 콘텐츠 아침 (여름 · B2C 크루)')&&ac.includes('평일 06:50')&&ac.includes('AI 크루 · 가을 (광고·검색 유입 보드)')&&ac.includes('평일 09:00')&&ac.includes('평일 15:00')&&/Aside \(담당 PC\)\s*하늘/.test(ac)&&/Aside \(회사 PC\)/.test(ac));   // 크루 = 담당 PC · 리포트 올리기·임시저장 = 회사 PC 그대로
    await p.click('#auto-card [data-autocat="data"]');await p.waitForTimeout(100);
    const dn=await p.$$eval('#auto-card .row.auto b',a=>a.map(x=>x.textContent));
    check('자동 작업: 숫자·데이터만 (오늘 숫자 · 사용량 · 리포트 올리기 · 별 주간 리포트)',dn.length===4&&dn.includes('오늘 숫자 만들기')&&dn.includes('광고·판매·재고 리포트 올리기')&&dn.includes('AI 크루 · 별 (주간 리포트 보드)'));
    await p.click('#auto-card [data-autocat="customer"]');await p.click('#auto-card [data-autost="set"]');await p.waitForTimeout(100);
    check('자동 작업: 고객 · 걸어 둔 것 = 크루 Aside 겨울·우주·바람·이음 (준비 중) · 세팅 = 업무OS Aside 세팅 (2026-10-19)',JSON.stringify((await p.$$eval('#auto-card .row.auto b',a=>a.map(x=>x.textContent))).sort())===JSON.stringify(['AI 크루 · 겨울 (전환 보드)','AI 크루 · 우주 (재구매 보드)','AI 크루 · 바람 (지인추천 보드)','AI 크루 · 이음 (주문·배송·재고 보드)'].sort())&&(await p.textContent('#auto-card')).includes('업무OS AI 팀원 › Aside 세팅')&&!(await p.textContent('#auto-card')).includes('세팅 카드'));
    await p.click('#auto-card [data-autocat="stock"]');await p.waitForTimeout(100);
    check('자동 작업: 재고·발주 · 걸어 둔 것 = 없음',(await p.textContent('#auto-card')).includes('이 분류엔 없습니다'));
    await p.click('#auto-card [data-autocat="customer"]');await p.click('#auto-card [data-autost="plan"]');await p.waitForTimeout(100);
    check('자동 작업: 고객 계획 = 온유·리아·다온',(await p.$$eval('#auto-card .row.auto b',a=>a.map(x=>x.textContent).join('|'))).match(/온유|리아|다온/g).length>=3);
    check('자동 작업 375 넘침 없음',await overflow(p)<=0);await p.screenshot({path:`${OUT}/team-auto-375.png`,fullPage:true});
    await p.click('#auto-card [data-autocat="all"]');await p.click('#auto-card [data-autost="all"]');
    check('노트 열기 = obsidian://open',(await p.getAttribute('.rows a.obs','href')).startsWith('obsidian://open?file=03%20'));
    // 📄 보기 → 채널 화면처럼 미리보기 · 승인 전엔 맡기기 잠금 · 메모 → 루틴이 읽음 · 업무OS 최종 승인 뒤 [임시저장 맡기기]
    await p.click(`[data-note="${nid}"]`);await p.waitForSelector('#sheet .pv');
    const pvs=await p.$$eval('#sheet .pv',a=>a.map(x=>[x.className,x.querySelector('.pv-title').textContent]));
    check('미리보기: 블로그·카페·지식인 3개 (채널 모양 · 제목 A안)',JSON.stringify(pvs)===JSON.stringify([['pv pv-naver_blog','옥상 균열 보수 이유'],['pv pv-cafe','[정보] 현관 미끄럼 체크'],['pv pv-kin','옥상 균열 셀프 보수 가능한가요?']]));
    check('승인 전: 맡기기·등록 완료 잠금 · 복사는 됨 · 업무OS에서 승인 ›',!(await p.$('[data-pqall]'))&&!(await p.$('#sheet [data-pq]'))&&!(await p.$('#sheet [data-ppub]'))&&(await p.textContent('#pv-1 .pv-st')).includes('최종 승인 뒤 맡기기')&&(await p.textContent('#pv-3 .pv-st')).includes('최종 승인 뒤 등록')&&!!(await p.$('#pv-1 [data-pc="body:1"]'))&&!!(await p.$(`#sheet a[href$="os2.html#a-${AID}"]`))&&(await p.textContent('#sheet .chips2')).includes('남윤정 차례'));
    await p.screenshot({path:OUT+'/note-gate-375.png'});
    const pv1=await p.textContent('#pv-1');
    check('미리보기: 썸네일 시안 · 고객 말 말풍선 2 · 사진 번호 · 구매 링크 카드',(await p.textContent('#pv-1 .pv-thumb-in b'))==='옥상 균열, 겨울 전에'&&(await p.$$('#pv-1 .pv-bub')).length===2&&(await p.textContent('#pv-1 .pv-ph-n')).includes('사진 1')&&!!(await p.$('#pv-1 a.pv-link[href="https://www.pourstore.net"]')));
    check('사용금지어 칸: 걸린 말 없는 글엔 없음 · 있으면 제목·본문·해시태그 (사진 자리 빼고) n곳 + 바꿔 쓰기',!(await p.$('#sheet .pv-ban'))&&(await p.evaluate(()=>{const h=bannedHtml({title:'완벽 방수',body:'친환경 칠 [사진: 유형 02 — 친환경 장면]',tags:['#무독성'],thumbs:[]});return h.includes('사용금지어 ⚠️ 3곳')&&h.includes('친환경</b> → &quot;VOCs 저감을 고려해 설계된&quot;');})));
    check('글 구조 검사: 블로그만 · 해시태그 부족 = 펼쳐 보임',(await p.$eval('#pv-1 .pv-chk',e=>e.open&&e.textContent.includes('해시태그 2개')))&&!(await p.$('#pv-2 .pv-chk')));
    check('미리보기: 사진 자리 칸 · 표 · 태그 · 태그는 글자 · 제목 줄 안 보임',(await p.$('#pv-1 .pv-ph'))&&pv1.includes('#옥상균열')&&(await p.textContent('#pv-1 td[data-l="제품"]'))==='크랙 세트'&&pv1.includes('<b>굵게아님</b>')&&!pv1.includes('제목 A안'));
    check('카페: 규정 안내 · 내부 메모는 본문 밖',(await p.textContent('#pv-2 .pv-notice')).includes('카페 규정')&&!(await p.textContent('#pv-2 .pv-body')).includes('광고 표기'));
    check('작성 근거는 접혀 있음 · 원문 보기',(await p.$('#sheet details.meta:not([open])'))!==null);
    check('보기 375 넘침 없음',await p.evaluate(()=>document.querySelector('#sheet .box').getBoundingClientRect().width<=375&&document.querySelector('#sheet .sb').scrollWidth<=document.querySelector('#sheet .sb').clientWidth+1));
    await p.screenshot({path:OUT+'/note-375.png'});await p.screenshot({path:OUT+'/note-375-full.png',fullPage:false});
    await p.click('[data-nv="raw"]');check('원문 보기',(await p.textContent('#sheet .sb')).includes('요청 내용'));await p.click('[data-nv="pv"]');
    // 업무OS 에서 최종 승인 (본부장) → 허브 시트를 다시 열면 맡기기 풀림
    await putDoc('pour-os/v2/aiasks/'+AID,{state:'ok',to:'',okByName:'허지은',path:['u1','u2']},['state','to','okByName','path']);
    await p.click('#note-close');await p.click(`[data-note="${nid}"]`);await p.waitForSelector('#sheet [data-pq="1"]');
    check('최종 승인 뒤: 모두 맡기기 = 임시저장 되는 2개만 · 지식인은 사람이 직접 등록',(await p.textContent('[data-pqall]')).includes('2개 모두')&&!(await p.$('#pv-3 [data-pq]'))&&(await p.textContent('#pv-3 .pv-st')).includes('사람이 직접 등록')&&(await p.textContent('#sheet .chips2')).includes('최종 승인 · 허지은'));
    await p.click('[data-pq="1"]');await p.waitForSelector('#pv-1 .pill.wait');
    await p.click('[data-pq="2"]');await p.waitForSelector('#pv-2 .pill.wait');
    const pd=await getDoc('pour-os/marketing-hub/mkt-posts/'+nid+'~1');
    await p.fill('#pub-url-3','https://kin.naver.com/qna/detail.naver?d1id=1');await p.click('#pv-3 [data-ppub]');await p.waitForSelector('#pv-3 .pv-st a');
    const kd=await getDoc('pour-os/marketing-hub/mkt-posts/'+nid+'~3');
    check('지식인 등록 완료 → 상태 published · 글 내용 남음 · 업무OS 줄 새로 안 만듦',kd&&kd.status.stringValue==='published'&&kd.channel.stringValue==='kin'&&kd.title.stringValue==='옥상 균열 셀프 보수 가능한가요?'&&!(await getDoc('pour-os/v2/links/mkt-pub-'+nid+'_3')));
    check('임시저장 맡기기 → 게시물 문서 (상태 queued · 편집기용 글)',pd&&pd.status.stringValue==='queued'&&pd.title.stringValue==='옥상 균열 보수 이유'&&pd.plain.stringValue.includes('[사진: 유형 02 시공전')&&!pd.plain.stringValue.includes('**'));
    await p.fill('#note-memo','제목은 질문형으로 · 가격은 끝에 한 번만');await p.click('#note-memo-save');
    await p.waitForFunction(()=>/저장됨/.test(document.querySelector('#sheet .sf').textContent));
    check('메모 저장 → 노트 문서',(await getDoc('pour-os/marketing-hub/mkt-notes/'+nid)).memo.stringValue==='제목은 질문형으로 · 가격은 끝에 한 번만');
    const fb=TL('feedback','14','여름');log('   feedback:',fb.split('\n')[0]);
    check('루틴이 메모를 읽음 (team_link.py feedback 여름)',fb.includes('제목은 질문형으로 · 가격은 끝에 한 번만')&&fb.includes('여름'));
    check('시트: 검토 끝 대신 업무OS에서 승인 ›',!(await p.$('#sheet [data-review]'))&&(await p.textContent('#sheet .sf')).includes('업무OS에서 승인'));
    await p.click('#note-close');
    // 예전 검토 줄은 그대로: 보기 → [검토 끝] → 줄 닫힘 · 팀원 최근 검토
    await p.click(`[data-note="${LEG}"]`);await p.waitForSelector('#sheet [data-review]');
    await p.click('#sheet [data-review]');await p.waitForFunction(()=>/검토 끝:/.test((document.querySelector('.msg')||{}).textContent||''));
    check('예전 검토 줄: 시트에서 검토 끝 → 시트 닫힘 · 줄 닫힘',!(await p.$('#sheet .sheet'))&&(await getDoc('pour-os/v2/links/'+LEG)).open.booleanValue===false);
    check('게시 진행: Aside 대기 2',(await p.textContent('main')).includes('게시 진행 2'));
    // 설정 › 게시 채널 (Aside 글쓰기 주소)
    await p.click('nav button[data-tab="set"]');await p.fill('#ch-naver_blog','https://blog.naver.com/pour?Redirect=Write');
    await p.fill('#ch-cafe','셀프인테리어 카페|https://cafe.naver.com/self/write');await p.click('#ch-save');
    await p.waitForFunction(()=>/게시 채널 주소를 저장/.test((document.querySelector('.msg')||{}).textContent||''));
    check('게시 채널 저장',(await getDoc('pour-os/marketing-hub/mkt-config/channels')).cafe.stringValue.includes('cafe.naver.com/self'));
    await p.click('nav button[data-tab="team"]');
    // Aside: 임시저장 작업대 (375 · 1280)
    for(const dw of [375,1280]){
      const q=await page(dw);await q.goto(BASE+'/drafts.html?emu=1');
      await q.fill('#login-email','aside-upload@example.com');await q.fill('#login-password',pw);await q.click('#login-button');
      await q.waitForSelector('#queue-list .post-row');
      check(`작업대 ${dw} 넘침 없음 · 맡긴 글 2`,await overflow(q)<=0&&(await q.$$('#queue-list .post-row')).length===2);
      await q.screenshot({path:`${OUT}/drafts-${dw}.png`,fullPage:true});
      if(dw===1280){
        await q.click('#open-1');
        check('작업대: 제목·본문(사진 자리 그대로)·태그',(await q.inputValue('#post-title'))==='옥상 균열 보수 이유'&&(await q.inputValue('#post-body')).includes('[사진: 유형 02 시공전 — 금이 간 옥상]')&&(await q.inputValue('#post-tags'))==='#옥상균열 #POUR스토어');
        check('작업대: 블로그 글쓰기 링크 (설정 주소)',(await q.getAttribute('#write-link','href'))==='https://blog.naver.com/pour?Redirect=Write');
        await q.screenshot({path:`${OUT}/drafts-open-1280.png`,fullPage:true});
        await q.click('#mark-draft');await q.waitForFunction(()=>/^완료/.test(document.querySelector('#status-message').textContent));
        check('임시저장 완료 → 상태 draft · 업무OS 발행 한 줄',(await getDoc('pour-os/marketing-hub/mkt-posts/'+nid+'~1')).status.stringValue==='draft'&&(await getDoc('pour-os/v2/links/mkt-pub-'+nid+'_1')).kind.stringValue==='publish');
        check('작업대: 임시저장됨 목록으로',(await q.textContent('#draft-list')).includes('옥상 균열 보수 이유'));
        // 카페 글: 규정 확인 띠 · 카페 글쓰기 링크 → 못 함(이유) → 맡긴 글에서 빠지고 '못 한 글'로 (Aside 가 되풀이하지 않음)
        await q.click('#open-1');
        check('작업대: 카페 규정 띠 · 카페 글쓰기 링크',await q.isVisible('#post-notice')&&(await q.textContent('#post-write-links')).includes('셀프인테리어 카페 글쓰기 열기'));
        await q.click('#mark-failed');check('이유 없이 못 함 → 실패 문구',(await q.textContent('#status-message')).startsWith('실패:'));
        await q.fill('#fail-note','카페 등급 부족');await q.click('#mark-failed');
        await q.waitForFunction(()=>/^완료/.test(document.querySelector('#status-message').textContent));
        check('못 함 → 상태 failed · 맡긴 글 0 · 못 한 글 1',(await getDoc('pour-os/marketing-hub/mkt-posts/'+nid+'~2')).status.stringValue==='failed'&&(await q.$$('#queue-list .post-row')).length===0&&(await q.textContent('#failed-list')).includes('카페 등급 부족'));
      }
      await q.context().close();
    }
    // 사람: 게시 진행 → 보기 → 발행 완료
    await p.reload();await p.waitForSelector('.kpis');await p.waitForTimeout(2500);await p.click('nav button[data-tab="team"]');
    await p.click('main [data-note]');await p.waitForSelector('#pv-1 [data-ppub]');
    await p.fill('#pub-url-1','https://blog.naver.com/pour/1');await p.click('#pv-1 [data-ppub]');await p.waitForSelector('#pv-1 .pv-st a');
    check('카페 글: 임시저장 실패 · 이유 · [다시 맡기기]',(await p.textContent('#pv-2 .pv-st')).includes('카페 등급 부족')&&!!(await p.$('#pv-2 [data-pq="2"]')));
    check('발행 완료 → 상태 published · 주소 · 업무OS 발행 줄 닫힘',(await getDoc('pour-os/marketing-hub/mkt-posts/'+nid+'~1')).url.stringValue==='https://blog.naver.com/pour/1'&&(await getDoc('pour-os/v2/links/mkt-pub-'+nid+'_1')).open.booleanValue===false);
    await p.click('#note-close');
    const ln=(await list('pour-os/v2/links',true)).filter(d=>d.fields.kind&&d.fields.kind.stringValue==='aiReview');
    check('업무OS 검토 줄은 예전 것 1개뿐(닫힘) · 포리 최근 검토 기록',ln.length===1&&ln[0].fields.open.booleanValue===false&&(await getDoc('pour-os/marketing-hub/mkt-team/pori')).lastTitle.stringValue==='포리 예전 원고');
    await p.click('details.tm:nth-child(1) summary');check('팀원 카드(펼침): 여름 맨 앞 · 최근 결과 = 업무OS 승인 상태 · 아침 루틴',(await p.textContent('details.tm[open]')).includes('여름 · 블로그 원고 3 · 최종 승인')&&(await p.textContent('details.tm[open]')).includes('평일 06:50 블로그 주제 3'));
    check('펼친 팀원 375 넘침 없음',await overflow(p)<=0);await p.screenshot({path:OUT+'/team-open-375.png',fullPage:true});
    await p.click('nav button[data-tab="voc"]');const vt=await p.textContent('main');
    check('고객의 소리: 급함 하자·안전 · 많이 나온 이야기 3건',vt.includes('바르고 나서 손이 따갑다고 함')&&/3건\s*곰팡이젤/.test(vt));
    // 쓰다가 다른 메시지로 화면이 다시 그려져도 쓰던 내용은 남음
    await p.fill('#voc-product','방수테이프');await p.fill('#voc-text','쓰는 중');await p.click('#voc-save');
    check('빈 종류 → 실패 · 쓰던 내용 남음',(await p.textContent('.msg')).startsWith('실패: 종류를 고르세요.')&&(await p.inputValue('#voc-text'))==='쓰는 중');
    await p.click(`[data-voc-done="${urgId.replace('mkt-voc-','')}"]`);await p.waitForFunction(()=>/끝남으로 표시/.test((document.querySelector('.msg')||{}).textContent||''));
    check('하자·안전 끝남 → 업무OS 줄 닫힘',(await getDoc('pour-os/v2/links/'+urgId)).open.booleanValue===false);
    await p.click('[data-copy="voc"]').catch(()=>{});
  }
  await p.context().close();
}

// 5-4) Aside: AI 크루 결과 올리기 (crew.html) → 업무OS AI 승인 + 보드 지표 (2026-10-12) — 원가·마진 칸·번호는 안 올라감
await putDoc('pour-os/v2/users/u_sy',{id:'u_sy',name:'김송희'});
await putDoc('pour-os/v2/aimates/gyeoul',{id:'gyeoul',owners:{grohome:'u_sy'},rules:[{id:'r1',text:'쿠폰은 15%를 넘기지 않는다'},{id:'r2',text:'끈 규칙',off:{at:'x'}}],qty:{B:{n:5,at:'2026-10-15T00:00:00.000Z',by:'u_sy',byName:'김송희'}}});
await putDoc('pour-os/v2/aimates/uju',{id:'uju',owners:{_:'u_sy'}});   // 김송희 PC = 겨울 09:00 · 우주 10:00 (2026-10-15 담당마다 자기 PC)
// 겨울 B = 쿠팡 유리블러 가격·구성 (2026-10-17 겨울 A 품절 → 이음 F 로 옮김 · 옛 글자 A 는 다시 안 씀)
const CT='[지표]\ncv_mall\t7.4\nsoldout\t2\n모르는키\t5\n[상태]\nB: 유리블러 옵션안 정리 중\n[B]\n요약: 옵션안 2개 — 1+1 · 키트\n항목\t내용\t근거\t할 일\t마진\n1+1 옵션\t19,900원\t-\t문의 고객 010-1234-5678 회신\t30%\n툴 포함 키트\t29,900원\t쿠팡 동등 11,000원\t상세 구성 안내\t25%\n';
const CAID=`ai_gyeoul_${today.replace(/-/g,'')}_ghconvB`; // crew.js askId(mate, run, 보드id+행동)
for(const cw of [375,768,1280]){
  const q=await page(cw);await q.goto(BASE+'/crew.html?emu=1#gh-conv');
  await q.fill('#login-email','aside-upload@example.com');await q.fill('#login-password',pw);await q.click('#login-button');
  await q.waitForFunction(()=>/김송희/.test(document.querySelector('#crew-who').textContent));
  if(cw===375){
    // Aside 전용 화면 (2026-10-19 사장님 1A) — 사람 세팅 카드·[예약 글 복사]는 업무OS 'Aside 세팅'으로 옮김 · 맨 위 한 줄이 그리로
    check('크루 화면 = Aside 전용 · 사람 세팅 카드 없음 · 업무OS 세팅 안내 한 줄(os2.html#s-aside) · 예약 글 복사 없음',
      (await q.$('#crew-setup'))===null&&(await q.$('#setup-groups'))===null&&(await q.$('#copy-launch'))===null&&(await q.textContent('#crew-human')).includes('Aside(AI 브라우저) 전용')&&(await q.getAttribute('#go-os-setup','href')).endsWith('pourstore-renewal/os2.html#s-aside'));
    await q.screenshot({path:`${OUT}/crew-top-375.png`,fullPage:false});
    const gd=await q.textContent('#crew-guide');
    check('크루 오늘 지시문: 펼침 · 겨울 · 판 · 먼저 할 것 · 이번 몫 = 담당이 정한 수',await q.$eval('#crew-guide-box',e=>e.open)&&/겨울 · 전환 보드 · 판 2026-10-\d\d/.test(await q.textContent('#crew-guide-head'))&&gd.includes('■ 0. 먼저')&&gd.includes('이번 몫: 옵션안 5개 (담당이 정함 · 기본 3개)')&&gd.includes('이번 몫: 진단할 히어로 상품 4개 —')&&(await q.textContent('#crew-last')).includes('없음'));
    check('크루: 겨울 보드 · 담당 김송희 · 켠 규칙만',(await q.inputValue('#crew-board'))==='gh-conv'&&(await q.textContent('#crew-rules')).includes('쿠폰은 15%')&&!(await q.textContent('#crew-rules')).includes('끈 규칙'));
    // 사용금지어 (사장님 2026-10-19) — 미리보기에 할 일마다 경고 (막지 않음) · 근거 번호가 같은 칸에 있으면 안 뜸
    await q.fill('#crew-date',today);await q.fill('#crew-text','[B]\n요약: 친환경 페인트 옵션\n항목\t내용\t근거\t할 일\n무취 옵션\t19,900원\t건설신기술 제1026호\t상세 수정\n');await q.click('#preview-button');
    const bw=await q.textContent('#preview');
    check('크루 미리보기: 사용금지어 경고 (요약·표 칸 · 근거 번호는 안 뜸)',bw.includes('사용금지어 · B')&&bw.includes('친환경 → "VOCs 저감을 고려해 설계된"')&&bw.includes('무취 → ')&&!bw.includes('신기술 →'));
    await q.screenshot({path:`${OUT}/crew-banned-375.png`,fullPage:true});check('크루 미리보기 경고 375 넘침 없음',await overflow(q)<=0);
    await q.fill('#crew-date',today);await q.fill('#crew-text',CT);await q.click('#preview-button');
    const pv=await q.textContent('#preview'), ths=await q.$$eval('#preview th',a=>a.map(x=>x.textContent));
    check('크루 미리보기: 지표 1 · 승인 1 · 모르는 키(품절 soldout 은 2026-10-17 이음 보드로) · 마진 칸 뺌 · 번호 가림',pv.includes('지표 1개 · 승인 요청 1건')&&pv.includes('soldout · 모르는키')&&!ths.includes('마진')&&pv.includes('뺀 칸 마진')&&!pv.includes('30%')&&pv.includes('010-****-****')&&!pv.includes('1234-5678'));
    await q.screenshot({path:`${OUT}/crew-preview-375.png`,fullPage:true});
    await q.click('#save-button');await q.waitForFunction(()=>/올렸어요/.test(document.querySelector('#status-message').textContent));
    const ca=await getDoc('pour-os/v2/aiasks/'+CAID), cb=await getDoc('pour-os/v2/aiboards/gh-conv');
    if(process.env.DBG)log('   ask',JSON.stringify(ca).slice(0,1500),'\n   board',JSON.stringify(cb).slice(0,600),'\n   msg',await q.textContent('#status-message'));
    check('크루 올리기 → 승인 1건(김송희 차례 · b2c · 번호 2 · 실행 한 줄) · 보드 지표',!!ca&&ca.crew.stringValue==='b2c'&&ca.to.stringValue==='u_sy'&&ca.state.stringValue==='wait'&&ca.items.arrayValue.values.length===2&&!JSON.stringify(ca).includes('1234-5678')&&!JSON.stringify(ca.cols).includes('마진')&&!JSON.stringify(ca).includes('30%')&&/담당이/.test(ca.exec.stringValue)&&!!cb&&Number(cb.metrics.mapValue.fields.cv_mall.mapValue.fields.v.doubleValue)===7.4);
    // 담당이 'AI 에게 다시' + 더 만들기 1개 → Aside 화면에 고칠 것 → [이전 판 불러오기] = 날짜 + 그 판의 표 → 줄을 더해 다시 올리면 2번째 판(번호 이어서)
    await putDoc('pour-os/v2/aiasks/'+CAID,{state:'back',to:'',back:{text:'지금 것은 그대로 두고 1개 더 만들어 주세요 · 소진 예상일을 날짜로',byName:'김송희',more:1}},['state','to','back']);
    await q.reload();await q.waitForFunction(()=>/고쳐서 다시 올릴 것 1건/.test(document.querySelector('#crew-redo').textContent));
    check('크루: 고쳐서 다시 올릴 것 · 돌려받은 말 · 더 만들기 1개',(await q.textContent('#crew-redo')).includes('소진 예상일을 날짜로')&&(await q.textContent('#crew-redo')).includes('더 만들기 1개'));
    check('크루: 할 일별 최근 올림 = B 오늘 · AI에게 다시',(await q.textContent('#crew-last')).includes(`B ${today.slice(5).replace('-','/')} · AI에게 다시`));
    await q.fill('#crew-date','2026-01-02');await q.fill('#crew-text','');await q.click('#redo-load-0');
    const lv=await q.inputValue('#crew-text');
    check('크루: [이전 판 불러오기] → 그 건의 날짜 + 그 판의 표(번호 그대로 · 가린 번호 그대로 · 마진 칸 없음)',(await q.inputValue('#crew-date'))===today&&lv.startsWith('[B]\n요약: 옵션안 2개')&&lv.includes('\nB1\t1+1 옵션')&&lv.includes('\nB2\t툴 포함 키트')&&lv.includes('010-****-****')&&!lv.includes('마진')&&!lv.includes('30%')&&(await q.textContent('#redo-load-0'))==='✓ 불러옴');
    await q.screenshot({path:`${OUT}/crew-redo-375.png`,fullPage:true});
    await q.fill('#crew-text',lv.replace('\t-\t','\t경쟁 10/20 확인\t')+'\n\t붓 세트 구성\t9,900원\t-\t상세 확인');await q.click('#save-button');
    await q.waitForFunction(()=>/고쳐서 다시 1건/.test(document.querySelector('#status-message').textContent));
    const c2=await getDoc('pour-os/v2/aiasks/'+CAID), n2=c2.items.arrayValue.values.map(v=>v.mapValue.fields.n.stringValue);
    if(process.env.DBG)log('   redo',JSON.stringify(n2),JSON.stringify(c2.items).slice(0,600));
    check('크루 다시 올림 → 2번째 판 · 김송희 차례 · 기록 ask→redo · 번호 이어서(B1·B2 그대로 + B3)',c2.ver.integerValue==='2'&&c2.state.stringValue==='wait'&&c2.to.stringValue==='u_sy'&&c2.log.arrayValue.values.map(v=>v.mapValue.fields.act.stringValue).join()==='ask,redo'&&JSON.stringify(c2.items).includes('경쟁 10/20 확인')&&JSON.stringify(n2)==='["B1","B2","B3"]'&&JSON.stringify(c2.items).includes('붓 세트 구성'));
    // 위로 올라간 뒤엔 그대로
    await putDoc('pour-os/v2/aiasks/'+CAID,{to:'u_x',step:1},['to','step']);
    await q.click('#save-button');await q.waitForFunction(()=>/그대로 둔 것/.test(document.querySelector('#status-message').textContent));
    check('크루: 위로 올라간 건 그대로 (날짜 바꾸라는 안내)',(await getDoc('pour-os/v2/aiasks/'+CAID)).ver.integerValue==='2'&&(await q.textContent('#status-message')).includes('위로 올라감'));
    // 주소 #보드 → 그 보드 지시문 (Aside 예약 글이 여는 길)
    await q.evaluate(()=>{location.hash='#gh-traffic';});
    await q.waitForFunction(()=>/가을 · 광고·검색 유입 보드/.test(document.querySelector('#crew-guide-head').textContent));
    check('주소 #보드 → 가을 보드 · 지시문 · 고칠 것 없음',(await q.inputValue('#crew-board'))==='gh-traffic'&&(await q.textContent('#crew-guide')).includes('너는 그로홈 · POUR스토어 B2C 크루의 유입마케터 · 퍼포먼스·검색 AI \'가을\'')&&(await q.textContent('#crew-redo'))==='');
  }
  check(`크루 화면 ${cw} 넘침 없음`,await overflow(q)<=0);await q.screenshot({path:`${OUT}/crew-${cw}.png`,fullPage:true});
  await q.context().close();
}
{ // 업로더가 아닌 직원 계정은 못 올림
  const q=await page(375);await q.goto(BASE+'/crew.html?emu=1#gh-conv');
  await q.fill('#login-email','cs@example.com');await q.fill('#login-password',spw);await q.click('#login-button');
  await q.waitForFunction(()=>/올릴 수 없어요/.test(document.querySelector('#status-message').textContent));
  check('크루: 직원 계정은 올리기 막힘',await q.$eval('#save-button',e=>e.disabled));await q.context().close();
}

// 6) 규칙 게시 뒤(잠긴 저장소) — 임시 저장소에서 옮기기
p=await page(375);p.on('dialog',d=>d.accept());await p.goto(BASE+'/index.html?emu=1&mode=secure');
await p.fill('#lg-email','netformrnd@gmail.com');await p.fill('#lg-pw','ownerpw123');await p.click('#lg-btn');
await p.waitForSelector('.kpis');await p.click('nav button[data-tab="set"]');await p.waitForSelector('#migrate-open');
await p.click('#migrate-open');await p.waitForFunction(()=>/옮겼습니다/.test((document.querySelector('.msg')||{}).textContent||''),null,{timeout:20000});
log('   ',await p.textContent('.msg'));
const topAds=(await list('mkt-ads',true)).length, topRoles=(await list('mkt-access',true)).length;
check('옮긴 뒤 잠긴 저장소 ads 3건 · 계정 문서 있음',topAds===3&&topRoles===1);
check('옮긴 뒤 고객의 소리 4건 · AI 팀 기록',(await list('mkt-voc',true)).length===4&&(await list('mkt-team',true)).length===1);
await p.click('nav button[data-tab="ads"]');check('잠긴 저장소에서 키워드 화면',(await p.textContent('main')).includes('옥상방수'));
await p.context().close();
// 7) 업로더는 잠긴 저장소에서도 올리기만
p=await page(375);await p.goto(BASE+'/upload.html?emu=1&mode=secure');
await p.fill('#login-email','aside-upload@example.com');await p.fill('#login-password',pw);await p.click('#login-button');
await p.waitForSelector('#upload-section:not([hidden])');
r=await up('stock',D3,{text:'상품코드,상품명,가용재고\nP001,곰팡이젤,5'});check('잠긴 저장소 업로드 완료(옮긴 계정으로)',r[1]===`완료: ${D3} 재고 1행`);
await p.context().close();
// 8) 직원은 잠긴 저장소에서도 쓰기만 (읽기는 규칙이 막음)
p=await page(375);await p.goto(BASE+'/voc.html?emu=1&mode=secure');
await p.fill('#login-email','cs@example.com');await p.fill('#login-password',spw);await p.click('#login-button');
await p.waitForSelector('#voc-section:not([hidden])');
vr=await voc('방수테이프','요청','큰 용량도 있으면 좋겠다고 함');check('잠긴 저장소 고객의 소리 저장(옮긴 계정으로)',vr==='완료: 방수테이프 요청 저장');
await p.context().close();
await b.close();
if(globalThis.PROD_HITS)fails++;console.log('실제 Firebase 요청:',globalThis.PROD_HITS||0);console.log(fails?`실패 ${fails}`:'전부 통과');process.exit(fails?1:0);
