import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/* =========================================================================
   AUTH STRATEGY
   -------------------------------------------------------------------------
   Each person has a fixed email. The "secret answer" they type IS their
   Firebase Auth password. So:

     • The answers are NEVER stored in frontend code.
     • Firebase Auth does the verification — not our JS.
     • Firestore security rules check the signed-in email, so even if
       someone reads the email in the source, they cannot read or write
       the chat without the password (the secret answer).

   When you set up Firebase Auth, you create these two users:
       her@ourlittlespace.app   → password = HER's secret answer
       him@ourlittlespace.app   → password = HIM's secret answer

   NOTE: Disable public sign-up in Firebase Auth so nobody can register
         these emails themselves. Only sign-in should be allowed.
   ========================================================================= */

const PERSONS = {
  her: {
    email: "her@ourlittlespace.app",
    question: "What is our secret word?",
    label: "For HER ♡"
  },
  him: {
    email: "him@ourlittlespace.app",
    question: "What was the first thing we talked about?",
    label: "For HIM ♥"
  }
};

// DOM
const choosePage   = document.getElementById('choose-page');
const unlockPage   = document.getElementById('unlock-page');
const successPage  = document.getElementById('success-page');
const eyebrow      = document.getElementById('unlock-eyebrow');
const questionText = document.getElementById('question-text');
const answerInput  = document.getElementById('answer-input');
const errorMsg     = document.getElementById('error-msg');
const unlockBtn    = document.getElementById('unlock-btn');
const backLink     = document.getElementById('back-link');

let selectedPerson = null;

// If already signed in, jump straight to chat
onAuthStateChanged(auth, (user) => {
  if (!user) return;
  const email = user.email;
  if (email === PERSONS.her.email || email === PERSONS.him.email) {
    window.location.href = 'chat.html';
  }
});

// Inject shake animation rule
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-8px); }
  40% { transform: translateX(8px); }
  60% { transform: translateX(-6px); }
  80% { transform: translateX(6px); }
}`;
document.head.appendChild(shakeStyle);

// Generate stars on this page too
(() => {
  const c = document.getElementById('stars');
  if (!c) return;
  const n = window.innerWidth < 640 ? 50 : 90;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    s.style.left = Math.random() * 100 + '%';
    s.style.top = Math.random() * 100 + '%';
    s.style.animationDelay = Math.random() * 4 + 's';
    s.style.animationDuration = (3 + Math.random() * 4) + 's';
    c.appendChild(s);
  }
})();

// Choose person
document.querySelectorAll('.person-card').forEach(card => {
  card.addEventListener('click', () => {
    selectedPerson = card.dataset.person;
    const p = PERSONS[selectedPerson];
    eyebrow.textContent = p.label;
    questionText.textContent = p.question;
    choosePage.classList.add('exiting');
    setTimeout(() => {
      choosePage.style.display = 'none';
      unlockPage.style.display = 'flex';
      unlockPage.classList.remove('exiting');
      setTimeout(() => answerInput.focus(), 50);
    }, 480);
  });
});

// Back
backLink.addEventListener('click', (e) => {
  e.preventDefault();
  unlockPage.classList.add('exiting');
  setTimeout(() => {
    unlockPage.style.display = 'none';
    choosePage.style.display = 'flex';
    choosePage.classList.remove('exiting');
    answerInput.value = '';
    errorMsg.textContent = '';
    selectedPerson = null;
  }, 480);
});

// Attempt unlock
async function attemptUnlock() {
  if (!selectedPerson) return;
  const answer = answerInput.value;
  if (!answer.trim()) {
    errorMsg.textContent = 'Please type your answer.';
    answerInput.focus();
    return;
  }

  errorMsg.textContent = '';
  unlockBtn.disabled = true;
  unlockBtn.innerHTML = '<span class="spinner"></span> Unlocking...';

  try {
    const person = PERSONS[selectedPerson];
    // The answer IS the password — Firebase verifies it.
    await signInWithEmailAndPassword(auth, person.email, answer);

    unlockBtn.innerHTML = '✓ Unlocked';
    unlockPage.classList.add('exiting');
    setTimeout(() => {
      unlockPage.style.display = 'none';
      successPage.style.display = 'flex';
      setTimeout(() => { window.location.href = 'chat.html'; }, 1400);
    }, 500);

  } catch (err) {
    console.error(err.code);
    let msg = 'Something went wrong. Try again.';
    if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
      msg = "That's not quite right. Try again? ♡";
    } else if (err.code === 'auth/too-many-requests') {
      msg = 'Too many attempts. Try again in a moment.';
    } else if (err.code === 'auth/network-request-failed') {
      msg = 'Network issue — check your connection.';
    } else if (err.code === 'auth/user-not-found') {
      msg = 'This account has not been set up yet. See the README.';
    }
    errorMsg.textContent = msg;
    unlockBtn.innerHTML = 'Unlock';
    unlockBtn.disabled = false;
    answerInput.style.animation = 'shake 0.4s';
    setTimeout(() => answerInput.style.animation = '', 420);
    answerInput.focus();
  }
}

unlockBtn.addEventListener('click', attemptUnlock);
answerInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); attemptUnlock(); }
});