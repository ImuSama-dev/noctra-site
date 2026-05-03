// 🔥 chat.js - Gerencia chat no reader.html

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, arrayUnion, collection } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// 🔥 CONFIGURAÇÃO FIREBASE - MESMA DO SEU INDEX/READER
const firebaseConfig = {
  apiKey: "AIzaSyC_2cJLezTKJy4WqUh-2DBVEHdLnjiFjE0",
  authDomain: "noctra-core.firebaseapp.com",
  projectId: "noctra-core",
  storageBucket: "noctra-core.firebasestorage.app",
  messagingSenderId: "506534658543",
  appId: "1:506534658543:web:14bd38c377336619e2f61a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// PEGAR CAPÍTULO E OBRAS DO READER
const params = new URLSearchParams(location.search);
const id = params.get("id");
const cap = params.get("cap");

// CRIAR ELEMENTO DE CHAT NO FINAL DO READER
const reader = document.getElementById("reader");

const chatContainer = document.createElement("div");
chatContainer.id = "chat-container";
chatContainer.innerHTML = `
  <h2 style="margin-top:30px;color:#c084fc;">Comentários</h2>
  <div id="chat-list" style="max-height:400px;overflow-y:auto;padding:10px;background:#14141c;border-radius:10px;margin-bottom:10px;"></div>
  <div style="display:flex;gap:10px;margin-bottom:30px;">
    <input type="text" id="chat-input" placeholder="Digite seu comentário..." style="flex:1;padding:10px;border-radius:8px;border:none;background:#1c1c2a;color:white;">
    <input type="file" id="chat-file" style="display:none;">
    <button id="upload-btn" style="padding:10px 14px;border-radius:8px;background:#a855f7;color:white;cursor:pointer;">📎</button>
    <button id="send-btn" style="padding:10px 14px;border-radius:8px;background:#9333ea;color:white;cursor:pointer;">Enviar</button>
  </div>
`;

reader.insertAdjacentElement("afterend", chatContainer);

const chatList = document.getElementById("chat-list");
const chatInput = document.getElementById("chat-input");
const chatFile = document.getElementById("chat-file");
const sendBtn = document.getElementById("send-btn");
const uploadBtn = document.getElementById("upload-btn");

// ABRIR SELEÇÃO DE ARQUIVO
uploadBtn.addEventListener("click", () => chatFile.click());

// CARREGAR CHAT DO FIRESTORE
async function loadChat() {
  chatList.innerHTML = "";
  const docRef = doc(db, "chat", `${id}_cap_${cap}`);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return;

  const messages = snap.data().messages || [];
  messages.forEach(msg => {
    const div = document.createElement("div");
    div.style.marginBottom = "10px";
    div.style.background = "#1c1c2a";
    div.style.padding = "8px 10px";
    div.style.borderRadius = "8px";

    let content = `<strong style="color:#c084fc;">${msg.user}:</strong> ${msg.text || ""}`;
    if(msg.img) content += `<br><img src="${msg.img}" style="max-width:100px;border-radius:6px;margin-top:5px;">`;

    div.innerHTML = content;
    chatList.appendChild(div);
  });

  chatList.scrollTop = chatList.scrollHeight;
}

// ENVIAR MENSAGEM
sendBtn.addEventListener("click", async () => {
  const text = chatInput.value.trim();
  const user = auth.currentUser;

  if (!user) return alert("Faça login para comentar!");
  if (!text && !chatFile.files[0]) return;

  let imgUrl = null;

  if(chatFile.files[0]){
    const fileRef = ref(storage, `chat/${id}_cap_${cap}/${Date.now()}_${chatFile.files[0].name}`);
    await uploadBytes(fileRef, chatFile.files[0]);
    imgUrl = await getDownloadURL(fileRef);
  }

  const docRef = doc(db, "chat", `${id}_cap_${cap}`);
  await setDoc(docRef, {
    messages: arrayUnion({
      user: user.displayName,
      text: text,
      img: imgUrl || null,
      timestamp: Date.now()
    })
  }, { merge:true });

  chatInput.value = "";
  chatFile.value = "";
  loadChat();
});

// CARREGAR CHAT AO ENTRAR
onAuthStateChanged(auth, () => loadChat());
window.addEventListener("load", loadChat);
