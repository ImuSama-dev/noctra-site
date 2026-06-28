import {getApps,initializeApp} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {getFirestore,doc,setDoc,serverTimestamp,collection,getDocs,query,where} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
let sessionId=null;

try{
  sessionId=localStorage.getItem(SESSION_KEY);
}catch(error){
  console.warn("Noctra analytics: armazenamento indisponivel.",error);
}

if(!sessionId){
  sessionId=crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try{
    localStorage.setItem(SESSION_KEY,sessionId);
  }catch(error){
    console.warn("Noctra analytics: sessao temporaria.",error);
  }
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

function currentWorkId(){
  const params=new URLSearchParams(location.search);
  const id=(params.get("id")||"").slice(0,80);
  if(id)return id;
  try{
    return (localStorage.getItem("noctra_last_work_id")||"").slice(0,80);
  }catch{
    return "";
  }
}

function pageData(){
  const params=new URLSearchParams(location.search);
  return {
    sessionId,
    path:currentPage(),
    title:document.title.slice(0,100),
    workId:currentWorkId(),
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
  try{
    if(localStorage.getItem(storageKey))return;
  }catch{}
  try{
    await setDoc(doc(db,"pageViewEvents",eventId),{
      sessionId,
      path:data.path,
      title:data.title,
      visitedAt:serverTimestamp(),
      day
    });
    try{
      localStorage.setItem(storageKey,"1");
    }catch{}
  }catch(error){
    console.warn("Noctra analytics: visita indisponivel.",error.code||error);
  }
}

async function recordChapterView(){
  const params=new URLSearchParams(location.search);
  const workId=currentWorkId();
  const chapter=(params.get("cap")||"").slice(0,20);
  if(!workId||!chapter)return;
  const eventId=hash(`${sessionId}|${workId}|${chapter}`);
  const storageKey=`noctra_chapter_view_${eventId}`;
  try{
    if(localStorage.getItem(storageKey))return;
  }catch{}
  try{
    await setDoc(doc(db,"chapterViewEvents",eventId),{
      sessionId,
      workId,
      chapter,
      openedAt:serverTimestamp()
    });
    try{
      localStorage.setItem(storageKey,"1");
    }catch{}
  }catch(error){
    console.warn("Noctra analytics: capitulo indisponivel.",error.code||error);
  }
}

function addOnlineBadge(){
  const style=document.createElement("style");
  style.textContent=`
    .noctra-online-badge{position:fixed;right:12px;bottom:12px;z-index:1100;display:flex;align-items:center;gap:7px;padding:7px 10px;border:1px solid #303038;border-radius:999px;background:rgba(13,13,17,.92);color:#d8d8de;font:600 11px Poppins,Arial,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35);backdrop-filter:blur(10px);pointer-events:none}
    .noctra-online-badge.is-reader{left:12px;top:88px;right:auto;bottom:auto}
    .noctra-online-dot{width:8px;height:8px;border-radius:50%;background:#35d06f;box-shadow:0 0 9px rgba(53,208,111,.85)}
    @media(max-width:700px){.noctra-online-badge{right:8px;bottom:8px;padding:6px 9px;font-size:10px}.noctra-online-badge.is-reader{left:8px;top:8px;right:auto;bottom:auto}}
  `;
  document.head.appendChild(style);
  const badge=document.createElement("div");
  badge.className="noctra-online-badge";
  if(currentPage()==="reader.html")badge.classList.add("is-reader");
  badge.innerHTML='<span class="noctra-online-dot"></span><span id="noctraOnlineCount">0 online</span>';
  document.body.appendChild(badge);
  return badge.querySelector("#noctraOnlineCount");
}

const onlineCount=addOnlineBadge();
let presence=[];
function mesmaPagina(item,data){
  return item.path===data.path
    && (item.workId||"")===(data.workId||"")
    && (item.chapter||"")===(data.chapter||"");
}

function renderOnline(){
  const limit=Date.now()-90000;
  const data=pageData();
  const total=presence.filter(item=>mesmaPagina(item,data)&&item.lastSeen?.toMillis?.()>=limit).length;
  onlineCount.textContent=`${total} online`;
}

async function carregarOnline(){
  try{
    const data=pageData();
    const presenceQuery=query(collection(db,"sitePresence"),where("path","==",data.path));
    const snapshot=await getDocs(presenceQuery);
    presence=snapshot.docs.map(item=>item.data());
    renderOnline();
  }catch(error){
    console.warn("Noctra analytics: online indisponivel.",error.code||error);
    onlineCount.textContent="online";
  }
}

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
  const workId=currentWorkId();
  async function carregarChapterViews(){
    if(!workId)return;
    try{
      const chapterQuery=query(collection(db,"chapterViewEvents"),where("workId","==",workId));
      const snapshot=await getDocs(chapterQuery);
      chapterViews=snapshot.docs.map(item=>item.data());
      renderChapterViews();
    }catch(error){
      console.warn("Noctra analytics: visualizacoes indisponiveis.",error.code||error);
    }
  }
  carregarChapterViews();
  var chapterViewsTimer=setInterval(carregarChapterViews,60000);
  new MutationObserver(renderChapterViews).observe(document.body,{childList:true,subtree:true});
}

heartbeat();
recordPageView();
if(currentPage()==="reader.html")recordChapterView();
carregarOnline();

const heartbeatTimer=setInterval(heartbeat,30000);
const onlineTimer=setInterval(carregarOnline,30000);
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible")heartbeat();
});
window.addEventListener("pagehide",()=>{
  clearInterval(heartbeatTimer);
  clearInterval(onlineTimer);
  if(typeof chapterViewsTimer!=="undefined")clearInterval(chapterViewsTimer);
},{once:true});
