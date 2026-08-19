import { auth, db } from "./firebase-config.js";
import {
  collection, query, orderBy, onSnapshot, addDoc, serverTimestamp,
  doc, setDoc, getDoc, updateDoc, limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const PERSONS = {
  her: { email:"her@ourlittlespace.app", displayName:"Her", partnerKey:"him", icon:"♡" },
  him: { email:"him@ourlittlespace.app", displayName:"Him", partnerKey:"her", icon:"♥" }
};

// Optional: add a Tenor API key here to enable live GIF search.
// Without a key, the GIF button still supports sending a direct GIF URL.
const TENOR_API_KEY = "";
const TENOR_CLIENT_KEY = "our-little-space";

let currentUser = null, currentPartner = null;
let replyTo = null, messagesLoaded = false, previousIds = new Set(), typingTimer = null;
const $ = id => document.getElementById(id);
const messagesEl=$("messages"), input=$("message-input"), sendBtn=$("send-btn");
const mediaPanel=$("media-panel"), mediaContent=$("media-content"), panelTitle=$("panel-title");

onAuthStateChanged(auth, async user => {
  if (!user) return location.href="login.html";
  if (user.email === PERSONS.her.email) currentUser="her";
  else if (user.email === PERSONS.him.email) currentUser="him";
  else { await signOut(auth); return location.href="login.html"; }
  currentPartner=PERSONS[currentUser].partnerKey;
  startChat();
});

function startChat() {
  $("partner-name").textContent=PERSONS[currentPartner].displayName;
  $("partner-avatar").textContent=PERSONS[currentPartner].icon;
  $("chat-page").style.display="flex";
  updatePresence(true);
  listenPresence(); listenTyping(); listenMessages(); listenSpotify();
  window.addEventListener("pagehide",()=>updatePresence(false),{once:true});
  document.addEventListener("visibilitychange",()=>updatePresence(!document.hidden));
  input.focus();
}

async function updatePresence(online) {
  await setDoc(doc(db,"presence",currentUser),{online,lastSeen:serverTimestamp()},{merge:true}).catch(()=>{});
}
function listenPresence() {
  onSnapshot(doc(db,"presence",currentPartner), s => {
    const el=$("partner-status"), d=s.data();
    if(d?.online){el.textContent="online";el.classList.add("online");}
    else {el.classList.remove("online"); el.textContent=d?.lastSeen?.toDate ? "last seen "+formatTime(d.lastSeen.toDate()) : "offline";}
  });
}

async function setTyping(v){await setDoc(doc(db,"typing",currentUser),{typing:v,ts:serverTimestamp()},{merge:true}).catch(()=>{});}
function listenTyping(){
  onSnapshot(doc(db,"typing",currentPartner),s=>{
    const active=s.data()?.typing===true;
    const old=document.getElementById("typing-indicator");
    if(active&&!old){const e=document.createElement("div");e.id="typing-indicator";e.className="typing-indicator";e.textContent="typing…";messagesEl.appendChild(e);scrollBottom();}
    if(!active&&old) old.remove();
  });
}
input.addEventListener("input",()=>{setTyping(true);clearTimeout(typingTimer);typingTimer=setTimeout(()=>setTyping(false),1200);});

function listenMessages(){
  const q=query(collection(db,"messages"),orderBy("timestamp","asc"),limit(500));
  onSnapshot(q,s=>{
    const list=s.docs.map(d=>({id:d.id,...d.data()}));
    if(messagesLoaded){
      list.filter(m=>m.sender===currentPartner&&!previousIds.has(m.id)).forEach(m=>notify(m));
    }
    previousIds=new Set(list.map(m=>m.id)); messagesLoaded=true;
    renderMessages(list);
    list.filter(m=>m.sender===currentPartner&&m.seen!==true).forEach(m=>updateDoc(doc(db,"messages",m.id),{delivered:true,seen:true}).catch(()=>{}));
  });
}

function renderMessages(list){
  messagesEl.innerHTML="";
  list.forEach(m=>{
    const wrap=document.createElement("div");
    wrap.className="message-group "+(m.sender===currentUser?"sent":"received");
    if(m.replyTo){
      const r=document.createElement("div"); r.className="reply-quote";
      r.textContent="↩ "+(m.replyTo.text||"Shared media");
      wrap.appendChild(r);
    }
    const bubble=document.createElement("div"); bubble.className="message-bubble";
    if(m.type==="gif"||m.type==="sticker"){
      const img=document.createElement("img"); img.src=m.url; img.alt=m.type; img.className="message-media"; img.loading="lazy";
      img.onerror=()=>bubble.textContent=m.url;
      bubble.appendChild(img);
    } else { bubble.textContent=m.text||""; }
    bubble.addEventListener("contextmenu",e=>{e.preventDefault();startReply(m);});
    bubble.addEventListener("dblclick",()=>startReply(m));
    wrap.appendChild(bubble);
    const meta=document.createElement("div"); meta.className="message-meta";
    meta.textContent=(m.timestamp?.toDate?formatTime(m.timestamp.toDate()):"...")+" · "+statusText(m);
    wrap.appendChild(meta);
    messagesEl.appendChild(wrap);
  });
  updateTyping();
  scrollBottom();
}
function statusText(m){
  if(m.sender!==currentUser)return "";
  if(m.seen===true)return "seen";
  if(m.delivered===true)return "delivered";
  return "sent";
}
function updateTyping(){ /* listener recreates the indicator when necessary */ }
function scrollBottom(){requestAnimationFrame(()=>messagesEl.scrollTop=messagesEl.scrollHeight);}

async function sendMessage(payload={}){
  const text=input.value.trim();
  if(!text && !payload.url) return;
  sendBtn.disabled=true;
  try{
    await addDoc(collection(db,"messages"),{
      sender:currentUser, text:text||"", type:payload.type||"text", url:payload.url||"",
      replyTo:replyTo?{id:replyTo.id,text:replyTo.text||"Shared media",type:replyTo.type||"text"}:null,
      timestamp:serverTimestamp(), delivered:false, seen:false
    });
    input.value=""; clearReply(); setTyping(false);
  }catch(e){showToast("Could not send that message.");}
  finally{sendBtn.disabled=false;input.focus();}
}
$("send-btn").onclick=()=>sendMessage();
input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}});

function startReply(m){
  replyTo=m;
  $("reply-bar").hidden=false;
  $("reply-preview").textContent=(m.text||"Shared media").slice(0,80);
  input.focus();
}
function clearReply(){replyTo=null;$("reply-bar").hidden=true;$("reply-preview").textContent="";}
$("cancel-reply").onclick=clearReply;

const emojis=["😀","😂","🥹","😍","🥰","😘","❤️","🩷","💜","💋","🫶","✨","🌙","🥺","😭","😌","😚","🤍","💫","🌸","🦋","💕","😎","🙈"];
const stickers=["💖","💗","💓","💞","💘","💝","💟","🫶","🥰","😘","😽","🐻‍❄️","🐰","🌷","🌹","✨","🌙","⭐","☁️","🍓"];
function openPanel(title,html){panelTitle.textContent=title;mediaContent.innerHTML=html;mediaPanel.hidden=false;}
$("close-panel").onclick=()=>mediaPanel.hidden=true;
$("emoji-btn").onclick=()=>openPanel("Emoji",`<div class="emoji-grid">${emojis.map(x=>`<button data-emoji="${x}">${x}</button>`).join("")}</div>`);
$("sticker-btn").onclick=()=>openPanel("Stickers",`<div class="emoji-grid sticker-grid">${stickers.map(x=>`<button data-sticker="${x}">${x}</button>`).join("")}</div>`);
mediaContent.addEventListener("click",e=>{
  const b=e.target.closest("button"); if(!b)return;
  if(b.dataset.emoji){input.value+=b.dataset.emoji;input.focus();mediaPanel.hidden=true;}
  if(b.dataset.sticker){sendMessage({type:"sticker",url:"data:text/plain;charset=utf-8,"+encodeURIComponent(b.dataset.sticker)});mediaPanel.hidden=true;}
});

$("media-url").addEventListener("change",()=>{const url=$("media-url").value.trim();if(url){sendMessage({type:"gif",url});$("media-url").value="";}});
$("gif-btn").onclick=async()=>{
  if(!TENOR_API_KEY){
    openPanel("GIF",`<div class="gif-help">Add a Tenor API key in <code>chat.js</code> for search, or paste a direct GIF URL in the 🔗 field.</div>`);
    return;
  }
  openPanel("GIF",`<input id="gif-search" class="input-field" placeholder="Search GIFs…"><div id="gif-results" class="gif-grid"></div>`);
  $("gif-search").focus();
  $("gif-search").oninput=debounce(()=>searchGifs($("gif-search").value),400);
};
async function searchGifs(term){
  if(!term)return;
  const box=$("gif-results"); box.innerHTML="Searching…";
  try{
    const url=`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(term)}&key=${encodeURIComponent(TENOR_API_KEY)}&client_key=${encodeURIComponent(TENOR_CLIENT_KEY)}&limit=12&media_filter=gif,tinygif`;
    const data=await fetch(url).then(r=>r.json());
    box.innerHTML=(data.results||[]).map(g=>`<button class="gif-choice" data-url="${g.media_formats?.tinygif?.url||g.media_formats?.gif?.url||""}"><img src="${g.media_formats?.tinygif?.url||g.media_formats?.gif?.url}" alt="GIF"></button>`).join("");
  }catch{box.textContent="GIF search failed. Use a direct GIF URL."}
}
mediaContent.addEventListener("click",e=>{const b=e.target.closest(".gif-choice");if(b){sendMessage({type:"gif",url:b.dataset.url});mediaPanel.hidden=true;}});

function listenSpotify(){
  onSnapshot(doc(db,"shared","spotify"),s=>{
    const d=s.data()||{};
    $("spotify-title").textContent=d.title||"No song selected";
    $("spotify-sub").textContent=d.artist?d.artist:"Choose one track for both of you";
    $("spotify-art").textContent=d.title?"▶":"♫";
  });
}
// Small Spotify-style picker. No URL pasting is needed.
// Add/edit songs in this array to control the music available in the popup.
const SONGS = [
  {title:"Until I Found You", artist:"Stephen Sanchez", url:"https://open.spotify.com/track/0T5iIrXAih8LX8nS6WFLh0"},
  {title:"Perfect", artist:"Ed Sheeran", url:"https://open.spotify.com/track/0tgVpDi06FyKpA1z0VMD4v"},
  {title:"Yellow", artist:"Coldplay", url:"https://open.spotify.com/track/3AJwUDP919kvQ9QcozQPxg"},
  {title:"Lover", artist:"Taylor Swift", url:"https://open.spotify.com/track/1dGr1c8CrMLDpV6mPbImSI"},
  {title:"Until I Found You", artist:"Stephen Sanchez — Em Beihold", url:"https://open.spotify.com/track/1Y3LN4zO4EdY2vLkWn5lYj"},
  {title:"Dandelions", artist:"Ruth B.", url:"https://open.spotify.com/track/2eAvDnpXP5W0cVtiuDDBN1"},
  {title:"I Like Me Better", artist:"Lauv", url:"https://open.spotify.com/track/1wjzFQodRWrPcQ0AnYnvQe"},
  {title:"Daylight", artist:"David Kushner", url:"https://open.spotify.com/track/1odExI7RdWc4BT515LTAwj"}
];

const spotifyPicker = $("spotify-picker");
const spotifyResults = $("spotify-results");
const spotifySearch = $("spotify-search");

function renderSpotifySongs(filter=""){
  const q=filter.trim().toLowerCase();
  const results=SONGS.filter(s=>!q || `${s.title} ${s.artist}`.toLowerCase().includes(q));
  spotifyResults.innerHTML = results.length ? results.map((s,i)=>`
    <button class="spotify-song" data-song-index="${SONGS.indexOf(s)}">
      <span class="song-art">♫</span>
      <span class="song-copy"><strong>${escapeHtml(s.title)}</strong><small>${escapeHtml(s.artist)}</small></span>
      <span class="song-play">▶</span>
    </button>`).join("") :
    `<div class="no-songs">No songs found.</div>`;
}

function escapeHtml(value){
  return value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

$("spotify-btn").onclick=()=>{
  renderSpotifySongs();
  spotifyPicker.hidden=false;
  setTimeout(()=>spotifySearch.focus(),50);
};

$("close-spotify-picker").onclick=()=>spotifyPicker.hidden=true;
spotifySearch.addEventListener("input",()=>renderSpotifySongs(spotifySearch.value));

spotifyResults.addEventListener("click", async e=>{
  const button=e.target.closest(".spotify-song");
  if(!button)return;
  const song=SONGS[Number(button.dataset.songIndex)];
  await setDoc(doc(db,"shared","spotify"),{
    url:song.url,
    title:song.title,
    artist:song.artist,
    by:currentUser,
    updatedAt:serverTimestamp()
  },{merge:true});
  spotifyPicker.hidden=true;
  showToast(`Now shared: ${song.title} ♡`);
});

document.addEventListener("click", e=>{
  if(!spotifyPicker.hidden && !spotifyPicker.contains(e.target) && e.target!==$("spotify-btn")){
    spotifyPicker.hidden=true;
  }
});

$("logout-btn").onclick=async()=>{
  await updatePresence(false);
  await signOut(auth);
  location.href="login.html";
};

function formatTime(d){let h=d.getHours(),m=String(d.getMinutes()).padStart(2,"0");const ap=h>=12?"PM":"AM";h=h%12||12;return `${h}:${m} ${ap}`;}
function debounce(fn,wait){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),wait);};}
function notify(m){showToast((m.sender===currentPartner?PERSONS[currentPartner].displayName:"")+": "+(m.text||"sent media"));}
function showToast(text){const t=document.createElement("div");t.className="toast";t.textContent=text;$("toast-root").appendChild(t);setTimeout(()=>t.remove(),3000);}
