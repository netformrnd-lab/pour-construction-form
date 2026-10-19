// 가짜 Firebase compat — crew.html 시험(tests/crew-split.e2e.mjs) 전용 · 메모리 · window.__DB {경로: 문서} · window.__WRITES 쓰기 기록 · window.__USER 로그인
// 가짜 Firebase compat (crew.html 시험 · 메모리 · 실제 Firestore 안 씀)
(function(){
const DB=window.__DB||(window.__DB={}); window.__WRITES=[];
const clone=(x)=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
const isAU=(v)=>v&&typeof v==='object'&&Array.isArray(v.__au);
const isObj=(v)=>v&&typeof v==='object'&&!Array.isArray(v)&&!isAU(v);
function merge(a,o){const out=isObj(a)?{...a}:{};Object.entries(o).forEach(([k,v])=>{if(isAU(v)){const cur=Array.isArray(out[k])?out[k]:[];out[k]=[...cur,...v.__au.filter(x=>!cur.some(c=>JSON.stringify(c)===JSON.stringify(x)))];}else if(isObj(v)&&isObj(out[k]))out[k]=merge(out[k],v);else out[k]=isObj(v)?merge({},v):clone(v);});return out;}
function write(path,o,m){window.__WRITES.push({path,o:clone(o),m:!!m});DB[path]=m?merge(DB[path]||{},o):merge({},o);}
function snap(path){const d=DB[path];return {id:path.split('/').pop(),exists:!!d,data:()=>clone(d),ref:docRef(path)};}
function docRef(path){return {id:path.split('/').pop(),path,collection:(n)=>colRef(path+'/'+n),get:async()=>snap(path),set:async(o,opt)=>write(path,o,opt&&opt.merge),update:async(o)=>write(path,o,true)};}
function colRef(path,fs=[]){return {doc:(id)=>docRef(path+'/'+(id||('auto'+Math.random().toString(36).slice(2)))),where:(f,op,v)=>colRef(path,[...fs,[f,op,v]]),
  get:async()=>{const pre=path+'/';const docs=Object.keys(DB).filter(k=>k.startsWith(pre)&&!k.slice(pre.length).includes('/')).map(snap).filter(s=>fs.every(([f,op,v])=>{const x=s.data()[f];return op==='=='?x===v:op==='in'?v.includes(x):op==='array-contains'?Array.isArray(x)&&x.includes(v):op==='>='?x>=v:true;}));return {docs,size:docs.length,empty:!docs.length};},
  add:async(o)=>{const r=docRef(path+'/auto'+Math.random().toString(36).slice(2));await r.set(o);return r;}};}
const fs={collection:(n)=>colRef(n),useEmulator(){},runTransaction:async(fn)=>fn({get:(r)=>r.get(),set:(r,o,opt)=>write(r.path,o,opt&&opt.merge),update:(r,o)=>write(r.path,o,true)})};
const user=window.__USER||null;
const auth={currentUser:user,setPersistence:async()=>{},onAuthStateChanged:(cb)=>setTimeout(()=>cb(user),0),signOut:async()=>{},useEmulator(){},signInWithEmailAndPassword:async()=>{}};
const firestore=()=>fs; firestore.FieldValue={arrayUnion:(...v)=>({__au:v}),serverTimestamp:()=>new Date().toISOString(),increment:(n)=>n};
const authF=()=>auth; authF.Auth={Persistence:{LOCAL:'local'}};
window.firebase={initializeApp(){},firestore,auth:authF};
})();
