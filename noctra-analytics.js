import {getApps,initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getFirestore,doc,setDoc,serverTimestamp,collection,onSnapshot,query,where} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig={
  apiKey:"AIzaSyC_2cJLezTKJy4WqUh-2DBVEHdLnjiFjE0",
  authDomain:"noctra-core.firebaseapp.com",
  projectId:"noctra-core",
  storageBucket:"noctra-core.firebasestorage.app",
  messagingSenderId:"506534658543",
  appId:"1:506534658543:web:14bd38c377336619e2f61a"
};

const app=getApps()[0]||initializeApp(firebaseConfig);
const db=getFirestore(app);
const SESSION_KEY="noctra_visitor_session";
let sessionId=localStorage.getItem(SESSION_KEY);

if(!sessionId){
  sessionId=crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(SESSION_KEY,sessionId);
}

function hash(text){
  let value=2166136261;
  for(let i=0;i<text.length;i++){
    value^=text.charCodeAt(i);
    value=Math.imul(value,16777619);
  }
  return (value>>>0).toString(36);
}

function currentPage(){
  const page=location.pathname.split("/").pop()||"index.html";
  if(page==="obra")return "obra.html";
  if(page==="reader")return "reader.html";
  return page;
}

function pageData(){
  const params=new URLSearchParams(location.search);
  return {
    sessionId,
    path:currentPage(),
    title:document.title.slice(0,100),
    workId:(params.get("id")||"").slice(0,80),
    chapter:(params.get("cap")||"").slice(0,20),
    lastSeen:serverTimestamp()
  };
}

async function heartbeat(){
  try{
    await setDoc(doc(db,"sitePresence",sessionId),pageData(),{merge:true});
  }catch(error){
    console.warn("Noctra analytics: presença indisponível.",error.code||error);
  }
}

async function recordPageView(){
  const day=new Date().toISOString().slice(0,10);
  const data=pageData();
  const eventId=hash(`${sessionId}|${data.path}|${day}`);
  const storageKey=`noctra_page_view_${eventId}`;
  if(localStorage.getItem(storageKey))return;
  try{
    await setDoc(doc(db,"pageViewEvents",eventId),{
      sessionId,
      path:data.path,
      title:data.title,
      visitedAt:serverTimestamp(),
      day
    });
    localStorage.setItem(storageKey,"1");
  }catch(error){
    console.warn("Noctra analytics: visita indisponivel.",error.code||error);
  }
}

async function recordChapterView(){
  const params=new URLSearchParams(location.search);
  const workId=(params.get("id")||"").slice(0,80);
  const chapter=(params.get("cap")||"").slice(0,20);
  if(!workId||!chapter)return;
  const eventId=hash(`${sessionId}|${workId}|${chapter}`);
  const storageKey=`noctra_chapter_view_${eventId}`;
  if(localStorage.getItem(storageKey))return;
  try{
    await setDoc(doc(db,"chapterViewEvents",eventId),{
      sessionId,
      workId,
      chapter,
      openedAt:serverTimestamp()
    });
    localStorage.setItem(storageKey,"1");
  }catch(error){
    console.warn("Noctra analytics: capitulo indisponivel.",error.code||error);
  }
}

function addOnlineBadge(){
  const style=document.createElement("style");
  style.textContent=`
    .noctra-online-badge{position:fixed;right:12px;bottom:12px;z-index:1100;display:flex;align-items:center;gap:7px;padding:7px 10px;border:1px solid #303038;border-radius:999px;background:rgba(13,13,17,.92);color:#d8d8de;font:600 11px Poppins,Arial,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35);backdrop-filter:blur(10px)}
    .noctra-online-dot{width:8px;height:8px;border-radius:50%;background:#35d06f;box-shadow:0 0 9px rgba(53,208,111,.85)}
    @media(max-width:700px){.noctra-online-badge{right:8px;bottom:8px;padding:6px 9px;font-size:10px}}
  `;
  document.head.appendChild(style);
  const badge=document.createElement("div");
  badge.className="noctra-online-badge";
  badge.innerHTML='<span class="noctra-online-dot"></span><span id="noctraOnlineCount">0 online</span>';
  document.body.appendChild(badge);
  return badge.querySelector("#noctraOnlineCount");
}

const onlineCount=addOnlineBadge();
let presence=[];
function renderOnline(){
  const limit=Date.now()-90000;
  const total=presence.filter(item=>item.lastSeen?.toMillis?.()>=limit).length;
  onlineCount.textContent=`${total} online`;
}

onSnapshot(collection(db,"sitePresence"),snapshot=>{
  presence=snapshot.docs.map(item=>item.data());
  renderOnline();
},()=>{onlineCount.textContent="online"});

let chapterViews=[];
function renderChapterViews(){
  document.querySelectorAll("[data-chapter-views]").forEach(element=>{
    const workId=element.dataset.workId;
    const chapter=element.dataset.chapter;
    const total=chapterViews.filter(item=>item.workId===workId&&String(item.chapter)===String(chapter)).length;
    element.textContent=`${total} ${total===1?"visualização":"visualizações"}`;
  });
}

if(currentPage()==="obra.html"){
  const workId=new URLSearchParams(location.search).get("id")||"";
  const chapterQuery=query(collection(db,"chapterViewEvents"),where("workId","==",workId));
  onSnapshot(chapterQuery,snapshot=>{
    chapterViews=snapshot.docs.map(item=>item.data());
    renderChapterViews();
  },error=>console.warn("Noctra analytics: visualizacoes indisponiveis.",error.code||error));
  new MutationObserver(renderChapterViews).observe(document.body,{childList:true,subtree:true});
}

heartbeat();
recordPageView();
if(currentPage()==="reader.html")recordChapterView();

const heartbeatTimer=setInterval(heartbeat,30000);
const onlineTimer=setInterval(renderOnline,15000);
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible")heartbeat();
});
window.addEventListener("pagehide",()=>{
  clearInterval(heartbeatTimer);
  clearInterval(onlineTimer);
},{once:true});
