// chat.js
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const auth = getAuth();
const db = getFirestore();

// Elementos do HTML
const chatContainer = document.getElementById("chat-container");
const chatList = document.getElementById("chat-list");
const chatInput = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");
const emojiBtn = document.getElementById("emoji-btn");
const uploadBtn = document.getElementById("upload-btn");
const chatFile = document.getElementById("chat-file");

// Obra e capítulo (passados via reader.html)
const params = new URLSearchParams(location.search);
const id = params.get("id"); // obra
const cap = params.get("cap"); // capítulo

let currentUser = null;

// 💜 Gerenciar emoji simples
const emojis = ["😀","😎","🔥","💜","🤍","😈","🥳","😱"];
emojiBtn.onclick = () => {
  const emojiMenu = document.createElement("div");
  emojiMenu.style.position = "absolute";
  emojiMenu.style.bottom = "60px";
  emojiMenu.style.right = "10px";
  emojiMenu.style.background = "#1c1c2a";
  emojiMenu.style.padding = "8px";
  emojiMenu.style.borderRadius = "10px";
  emojiMenu.style.display = "flex";
  emojiMenu.style.flexWrap = "wrap";
  emojiMenu.style.gap = "5px";
  emojis.forEach(e=>{
    const btn = document.createElement("span");
    btn.innerText = e;
    btn.style.cursor = "pointer";
    btn.onclick = ()=> { chatInput.value += e; document.body.removeChild(emojiMenu); };
    emojiMenu.appendChild(btn);
  });
  document.body.appendChild(emojiMenu);
};

// Upload
uploadBtn.onclick = () => chatFile.click();
chatFile.onchange = () => {
  const file = chatFile.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => chatInput.value += `[img]${e.target.result}[/img]`;
  reader.readAsDataURL(file);
};

// 🔥 Monitorar login
onAuthStateChanged(auth, user=>{
  currentUser = user;
  loadChat(); // Atualiza chat sempre que usuário muda
});

// Render mensagem
function renderMessage(msg){
  const div = document.createElement("div");
  div.style.marginBottom = "10px";
  div.style.padding = "8px 12px";
  div.style.borderRadius = "10px";
  div.style.maxWidth = "90%";
  div.style.wordBreak = "break-word";
  div.style.display = "flex";
  div.style.flexDirection = "column";
  div.style.gap = "5px";
  div.style.background = currentUser && currentUser.uid === msg.uid ? "#9333ea" : "#1c1c2a";
  div.style.alignSelf = currentUser && currentUser.uid === msg.uid ? "flex-end" : "flex-start";

  let content = `<strong style="color:#c084fc">${msg.user}</strong>: ${msg.text || ""}`;
  if(msg.img) content += `<br><img src="${msg.img}" style="max-width:150px;border-radius:8px;margin-top:5px;">`;

  // Likes / dislikes
  content += `
    <div style="margin-top:5px;display:flex;gap:5px;font-size:12px;">
      <span style="cursor:pointer;" onclick="likeMsg('${msg.id}')">👍 ${msg.likes?.length || 0}</span>
      <span style="cursor:pointer;" onclick="dislikeMsg('${msg.id}')">👎 ${msg.dislikes?.length || 0}</span>
    </div>
  `;

  div.innerHTML = content;
  return div;
}

// Renderizar todas mensagens
async function loadChat(){
  if(!id || !cap) return;
  chatList.innerHTML = "";
  const snap = await getDoc(doc(db,"chat",`${id}_cap_${cap}`));
  if(!snap.exists()) return;
  const messages = snap.data().messages || [];
  messages.forEach(msg => {
    const div = renderMessage(msg);
    chatList.appendChild(div);
  });
  chatList.scrollTop = chatList.scrollHeight;
}

// Enviar mensagem
sendBtn.onclick = async () => {
  if(!currentUser) return alert("Faça login para comentar");
  if(!chatInput.value.trim()) return;

  const msg = {
    id: Date.now().toString(),
    uid: currentUser.uid,
    user: currentUser.displayName,
    text: chatInput.value,
    img: chatInput.value.match(/\[img\](.*?)\[\/img\]/)?.[1] || null,
    likes: [],
    dislikes: []
  };

  const ref = doc(db,"chat",`${id}_cap_${cap}`);
  await setDoc(ref,{messages: arrayUnion(msg)}, {merge:true});
  chatInput.value = "";
  loadChat();
};

// Likes e dislikes
window.likeMsg = async (msgId)=>{
  if(!currentUser) return alert("Faça login para curtir");
  const ref = doc(db,"chat",`${id}_cap_${cap}`);
  const snap = await getDoc(ref);
  if(!snap.exists()) return;
  const messages = snap.data().messages;
  const idx = messages.findIndex(m=>m.id===msgId);
  if(idx===-1) return;
  const m = messages[idx];

  // Evita múltiplos likes/dislikes do mesmo usuário
  if(m.likes.includes(currentUser.uid)) return;
  m.likes.push(currentUser.uid);
  m.dislikes = m.dislikes.filter(u=>u!==currentUser.uid);
  messages[idx] = m;
  await setDoc(ref,{messages},{merge:true});
  loadChat();
};

window.dislikeMsg = async (msgId)=>{
  if(!currentUser) return alert("Faça login para não gostar");
  const ref = doc(db,"chat",`${id}_cap_${cap}`);
  const snap = await getDoc(ref);
  if(!snap.exists()) return;
  const messages = snap.data().messages;
  const idx = messages.findIndex(m=>m.id===msgId);
  if(idx===-1) return;
  const m = messages[idx];

  if(m.dislikes.includes(currentUser.uid)) return;
  m.dislikes.push(currentUser.uid);
  m.likes = m.likes.filter(u=>u!==currentUser.uid);
  messages[idx] = m;
  await setDoc(ref,{messages},{merge:true});
  loadChat();
};
