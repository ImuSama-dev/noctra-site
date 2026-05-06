import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const auth = getAuth();
const db = getFirestore();

const chatList = document.getElementById("chat-list");
const chatInput = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");
const emojiBtn = document.getElementById("emoji-btn");
const uploadBtn = document.getElementById("upload-btn");
const chatFile = document.getElementById("chat-file");

const params = new URLSearchParams(location.search);
const id = params.get("id");
const cap = params.get("cap");

let currentUser = null;

if(emojiBtn && chatInput){
  const emojis = ["😀","😎","🔥","💜","🤍","😈","🥳","😱"];

  emojiBtn.onclick = ()=>{
    const menu = document.createElement("div");
    menu.style.position = "absolute";
    menu.style.bottom = "60px";
    menu.style.right = "10px";
    menu.style.background = "#1c1c2a";
    menu.style.padding = "8px";
    menu.style.borderRadius = "10px";
    menu.style.display = "flex";
    menu.style.flexWrap = "wrap";
    menu.style.gap = "5px";

    emojis.forEach(emoji=>{
      const btn = document.createElement("span");
      btn.innerText = emoji;
      btn.style.cursor = "pointer";
      btn.onclick = ()=>{
        chatInput.value += emoji;
        document.body.removeChild(menu);
      };
      menu.appendChild(btn);
    });

    document.body.appendChild(menu);
  };
}

if(uploadBtn && chatFile){
  uploadBtn.onclick = ()=>chatFile.click();

  chatFile.onchange = async()=>{
    if(!currentUser) return alert("Faça login para enviar imagens");

    const file = chatFile.files[0];
    if(!file) return;

    const reader = new FileReader();

    reader.onload = async event=>{
      const msg = {
        id:Date.now().toString(),
        uid:currentUser.uid,
        user:currentUser.displayName || "Usuario",
        text:"",
        img:event.target.result,
        likes:[],
        dislikes:[]
      };

      await setDoc(doc(db,"chat",`${id}_cap_${cap}`),{
        messages:arrayUnion(msg)
      },{merge:true});

      chatFile.value = "";
      loadChat();
    };

    reader.readAsDataURL(file);
  };
}

onAuthStateChanged(auth,user=>{
  currentUser = user;
  loadChat();
});

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
