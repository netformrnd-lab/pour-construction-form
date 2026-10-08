// 마케팅 허브 E2E 시험 — 에뮬레이터(auth·firestore)에서 업로더 계정 만들기 → 5종 업로드 → 관리자 정리 → 재업로드 중복 없음 · 375/768/1280 넘침
// 실행(rules.test.mjs 와 같은 폴더 준비 + cdn/ 에 firebase 10.12.0 compat 3개 + naver-euckr.csv·naver-v2.csv):
//   marketing-hub 를 127.0.0.1:5500 으로 띄우고 OUT=<스크린샷 폴더> npx firebase emulators:exec --only auth,firestore --project pour-app-new "node e2e.mjs"
// 실제 Firebase(googleapis 등) 요청은 막고 0건인지 검사한다.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';
async function route(p){await p.route(/gstatic\.com\/firebasejs\/10\.12\.0\/(firebase-[a-z]+-compat\.js)/,(r)=>{const n=r.request().url().match(/(firebase-[a-z]+-compat\.js)/)[1];r.fulfill({contentType:'application/javascript',body:readFileSync('cdn/'+n)});});
  await p.route(/^https?:\/\/[^/]*(googleapis\.com|firebaseio\.com|firebaseapp\.com)/,(r)=>{console.log('  ✗ 실제 Firebase 요청 차단:',r.request().url().slice(0,90));globalThis.PROD_HITS=(globalThis.PROD_HITS||0)+1;r.abort();});
  await p.route(/cdn\.jsdelivr\.net/,(r)=>r.fulfill({contentType:'text/css',body:''}));}
const BASE='http://127.0.0.1:5500', OUT=process.env.OUT;
const signUp=(email,pw)=>fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=x',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password:pw,returnSecureToken:true})}).then(r=>r.json());
const list=async(c)=>{const r=await fetch(`http://127.0.0.1:8080/v1/projects/pour-app-new/databases/(default)/documents/${c}?pageSize=300`,{headers:{Authorization:'Bearer owner'}});const j=await r.json();return (j.documents||[]);};
await signUp('netformrnd@gmail.com','ownerpw123');
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--ignore-certificate-errors']});
const log=(...a)=>console.log(...a);
let fails=0; const check=(n,c)=>{log(c?'  ✓':'  ✗',n);if(!c)fails++;};
async function page(w){const ctx=await b.newContext({viewport:{width:w,height:900},ignoreHTTPSErrors:true});const p=await ctx.newPage();await route(p);p.on('pageerror',e=>log('  [pageerror]',e.message));p.on('console',m=>{if(m.type()==='error')log('  [console]',m.text().slice(0,300));});return p;}
const overflow=(p)=>p.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);

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
check('날짜 기본값 = 어제',(await p.inputValue('#report-date'))==='2026-10-07');
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
let r=await up('cafe24','2026-10-06',{text:'상품코드,상품명,옵션,판매수량,판매합계\nP001,곰팡이젤,단품,10,"159,000"\nP002,방수테이프,,1,"10,000"'});log('  ',r);check('카페24 10-06 완료',r[1]==='완료: 2026-10-06 카페24 판매 2행');
r=await up('cafe24','2026-10-07',{text:'상품코드\t상품명\t옵션\t판매수량\t판매합계\nP001\t곰팡이젤\t단품\t14\t"222,600"\nP001\t곰팡이젤\t2개세트\t2\t"51,600"'});log('  ',r);check('카페24 10-07 (탭 붙여넣기) 완료',r[1]==='완료: 2026-10-07 카페24 판매 2행');
r=await up('naver_ads','2026-10-07',{file:'naver-euckr.csv'});log('  ',r);check('네이버 EUC-KR 파일 완료',r[1]==='완료: 2026-10-07 네이버 광고 3행');
r=await up('coupang_ads','2026-10-07',{text:'캠페인명\t키워드\t노출수\t클릭수\t광고비\t총 전환매출액(14일)\n자동\t실리콘곰팡이\t900\t40\t20,000\t120,000'});log('  ',r);check('쿠팡 완료',r[1].startsWith('완료: 2026-10-07 쿠팡 광고 1행'));
r=await up('stock','2026-10-07',{text:'상품코드,상품명,가용재고\nP001,곰팡이젤,20\nP002,방수테이프,50'});log('  ',r);check('재고 완료',r[1]==='완료: 2026-10-07 재고 2행');
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
r=await up('naver_ads','2026-10-07',{file:'naver-v2.csv'});check('재업로드 완료',r[1]==='완료: 2026-10-07 네이버 광고 2행');
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
check('옵시디언 링크 = 오늘 숫자 덮어쓰기',href.startsWith('obsidian://new?vault=')&&href.endsWith('&overwrite=true')&&dec.includes('file=05 오늘 숫자'));
check('노트에 발주 필요·끌 키워드',dec.includes('| P001 | 곰팡이젤 |')&&dec.includes('**옥상방수**'));
log('   링크 길이',href.length);
check('요약 375 넘침 없음(옵시디언 카드)',await overflow(p)<=0);
await p.screenshot({path:OUT+'/home-obs-375.png',fullPage:true});
await p.click('nav button[data-tab="set"]');await p.waitForTimeout(200);
const hub=await p.getAttribute('#obs-hub','href');check('허브 연결 = append',hub.includes('append=true')&&decodeURIComponent(hub).includes('![[05 오늘 숫자]]'));
check('설정 375 넘침 없음',await overflow(p)<=0);
await p.screenshot({path:OUT+'/set-375.png',fullPage:true});
await p.context().close();
await b.close();
if(globalThis.PROD_HITS)fails++;console.log('실제 Firebase 요청:',globalThis.PROD_HITS||0);console.log(fails?`실패 ${fails}`:'전부 통과');process.exit(fails?1:0);
