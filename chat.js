import { auth, db } from "./firebase-config.js";
import {
  collection, query, orderBy, onSnapshot, addDoc, serverTimestamp,
  doc, setDoc, deleteDoc, getDocs, updateDoc, limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Mirror of login config — only emails used here for auth checks
const PERSONS = {
  her: { email: "her@ourlittlespace.app", displayName: "Her", partnerKey: "him", icon: "♡" },
  him: { email: "him@ourlittlespace.app", displayName: "Him", partnerKey: "her", icon: "♥" }
};

let currentUser = null;   // 'her' or 'him'
let currentPartner = null;

// DOM
const loadingPage   = document.getElementById('loading-page');
const chatPage      = document.getElementById('chat-page');
const messagesEl    = document.getElementById('messages');
const messageInput  = document.getElementById('message-input');
const sendBtn       = document.getElementById('send-btn');
const partnerAvatar = document.getElementById('partner-avatar');
const partnerName   = document.getElementById('partner-name');
const partnerStatus = document.getElementById('partner-status');
const logoutBtn     = document.getElementById('logout-btn');
const clearBtn      = document.getElementById('clear-btn');

let partnerIsTyping = false;
let messagesLoaded  = false;
let previousCount   = 0;
let typingTimeout  = null;
let pendingSeen   = [];

// ===== Auth gate =====
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'login.html'; return; }

  if (user.email === PERSONS.her.email)      currentUser = 'her';
  else if (user.email === PERSONS.him.email) currentUser = 'him';
  else { await signOut(auth); window.location.href = 'login.html'; return; }

  currentPartner = PERSONS[currentUser].partnerKey;
  startChat();
});

function startChat() {
  // Header
  partnerName.textContent   = PERSONS[currentPartner].displayName;
  partnerAvatar.textContent = PERSONS[currentPartner].icon;

  // Reveal chat
  loadingPage.style.display = 'none';
  chatPage.style.display   = 'flex';

  // Presence + listeners
  updatePresence(true);
  window.addEventListener('beforeunload', () => updatePresence(false));
  document.addEventListener('visibilitychange', () => {
    updatePresence(!document.hidden);
  });

  listenPresence();
  listenTyping();
  listenMessages();

  // Notifications permission
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }

  messageInput.focus();
}

// ===== Presence =====
async function updatePresence(online) {
  try {
    await setDoc(doc(db, 'presence', currentUser), {
      online: online,
      lastSeen: serverTimestamp()
    }, { merge: true });
  } catch (e) { console.error('presence', e); }
}

function listenPresence() {
  onSnapshot(doc(db, 'presence', currentPartner), (snap) => {
    if (!snap.exists()) {
      partnerStatus.textContent = 'offline';
      partnerStatus.classList.remove('online');
      return;
    }
    const d = snap.data();
    if (d.online) {
      partnerStatus.textContent = 'online';
      partnerStatus.classList.add('online');
    } else {
      partnerStatus.classList.remove('online');
      const ls = d.lastSeen && d.lastSeen.toDate ? d.lastSeen.toDate() : null;
      partnerStatus.textContent = ls ? ('last seen ' + formatTime(ls)) : 'offline';
    }
  });
}

// ===== Typing =====
async function setTyping(isTyping) {
  try {
    await setDoc(doc(db, 'typing', currentUser), {
      typing: isTyping, ts: serverTimestamp()
    }, { merge: true });
  } catch (e) { console.error('typing', e); }
}

function listenTyping() {
  onSnapshot(doc(db, 'typing', currentPartner), (snap) => {
    partnerIsTyping = snap.exists() && snap.data().typing === true;
    updateTypingIndicator();
  });
}

function updateTypingIndicator() {
  const existing = document.getElementById('typing-indicator');
  if (partnerIsTyping && !existing) {
    const el = document.createElement('div');
    el.className = 'typing-indicator';
    el.id = 'typing-indicator';
    el.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
    messagesEl.appendChild(el);
    scrollToBottom();
  } else if (!partnerIsTyping && existing) {
    existing.remove();
  }
}

messageInput.addEventListener('input', () => {
  setTyping(true);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => setTyping(false), 1400);
});

// ===== Messages =====
function listenMessages() {
  const q = query(collection(db, 'messages'), orderBy('timestamp', 'asc'), limit(500));
  onSnapshot(q, (snap) => {
    const messages = [];
    snap.forEach(d => messages.push({ id: d.id, ...d.data() }));

    // Detect new ones from partner for notifications
    if (messagesLoaded && messages.length > previousCount) {
      for (let i = previousCount; i < messages.length; i++) {
        const m = messages[i];
        if (m.sender === currentPartner && m.text) {
          showNotification(PERSONS[currentPartner].displayName + ': ' + m.text);
        }
      }
    }
    previousCount = messages.length;
    messagesLoaded = true;

    renderMessages(messages);
    markSeenForReceived(messages);
  });
}

function renderMessages(messages) {
  messagesEl.innerHTML = '';

  // Find index of last sent message (for "seen" indicator)
  let lastSentIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sender === currentUser) { lastSentIdx = i; break; }
  }

  let currentGroup = null;

  messages.forEach((msg, i) => {
    const isSent = msg.sender === currentUser;
    const next = messages[i + 1];
    const isLastInGroup = !next || next.sender !== msg.sender;

    if (!currentGroup || currentGroup.sender !== msg.sender) {
      currentGroup = { sender: msg.sender, el: document.createElement('div') };
      currentGroup.el.className = 'message-group ' + (isSent ? 'sent' : 'received');
      messagesEl.appendChild(currentGroup.el);
    }

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = msg.text || '';
    currentGroup.el.appendChild(bubble);

    if (isLastInGroup) {
      const time = document.createElement('div');
      time.className = 'message-time';
      time.textContent = msg.timestamp && msg.timestamp.toDate
        ? formatTime(msg.timestamp.toDate())
        : '...';
      currentGroup.el.appendChild(time);

      // "seen" only on the very last sent message
      if (isSent && i === lastSentIdx && msg.seen === true) {
        const seen = document.createElement('div');
        seen.className = 'seen-indicator';
        seen.textContent = 'seen';
        currentGroup.el.appendChild(seen);
      }
    }
  });

  // Re-attach typing indicator if needed
  updateTypingIndicator();
  scrollToBottom();
}

function markSeenForReceived(messages) {
  messages.forEach(m => {
    if (m.sender === currentPartner && m.seen !== true) {
      updateDoc(doc(db, 'messages', m.id), { seen: true }).catch(() => {});
    }
  });
}

async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;
  sendBtn.disabled = true;
  try {
    await addDoc(collection(db, 'messages'), {
      sender: currentUser,
      text: text,
      timestamp: serverTimestamp(),
      seen: false
    });
    messageInput.value = '';
    setTyping(false);
  } catch (e) {
    console.error(e);
    showToast('Failed to send. Tap to retry.');
  } finally {
    sendBtn.disabled = false;
    messageInput.focus();
  }
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

// ===== Logout =====
logoutBtn.addEventListener('click', () => {
  showModal({
    title: 'Leave this space?',
    message: "You'll need to unlock again to come back.",
    confirmLabel: 'Leave',
    danger: true,
    onConfirm: async () => {
      await updatePresence(false);
      await signOut(auth);
      window.location.href = 'login.html';
    }
  });
});

// ===== Clear chat =====
clearBtn.addEventListener('click', () => {
  showModal({
    title: 'Clear all messages?',
    message: 'This permanently deletes every message in your shared space. This cannot be undone.',
    confirmLabel: 'Clear everything',
    danger: true,
    onConfirm: async () => {
      const snap = await getDocs(collection(db, 'messages'));
      const dels = [];
      snap.forEach(d => dels.push(deleteDoc(d.ref)));
      await Promise.all(dels);
      showToast('Chat cleared.');
    }
  });
});

// ===== Helpers =====
function formatTime(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : date.toDate();
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}

function showNotification(text) {
  // Browser notification
  if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
    try { new Notification('Our Little Space', { body: text, silent: false }); } catch (e) {}
  }
  // In-app toast
  showToast(text);
}

function showToast(text) {
  const t = document.createElement('div');
  t.className = 'notification';
  t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => t.remove(), 300);
  }, 3200);
}

function showModal({ title, message, confirmLabel, danger, onConfirm }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <h3>${title}</h3>
      <p>${message}</p>
      <div class="modal-actions">
        <button class="btn-cancel" type="button">Cancel</button>
        <button class="${danger ? 'btn-confirm' : 'btn-primary'}" type="button">${confirmLabel || 'Confirm'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('.btn-cancel').onclick = close;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector(danger ? '.btn-confirm' : '.btn-primary').onclick = async () => {
    close();
    await onConfirm();
  };
}