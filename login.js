import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserSessionPersistence,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const PERSONS = {
  her: { email: "her@ourlittlespace.app", question: "What is our secret word?", label: "For HER ♡" },
  him: { email: "him@ourlittlespace.app", question: "What was the first thing we talked about?", label: "For HIM ♥" }
};

const choosePage = document.getElementById("choose-page");
const unlockPage = document.getElementById("unlock-page");
const successPage = document.getElementById("success-page");
const eyebrow = document.getElementById("unlock-eyebrow");
const questionText = document.getElementById("question-text");
const answerInput = document.getElementById("answer-input");
const errorMsg = document.getElementById("error-msg");
const unlockBtn = document.getElementById("unlock-btn");
const backLink = document.getElementById("back-link");
let selectedPerson = null;

setPersistence(auth, browserSessionPersistence).catch(console.error);

// Always start the login page signed out.
// This makes the question appear every time the login page is opened,
// while the session remains available after successful login -> chat.html.
await signOut(auth).catch(() => {});

document.querySelectorAll(".person-card").forEach(card => {
  card.addEventListener("click", () => {
    selectedPerson = card.dataset.person;
    const p = PERSONS[selectedPerson];
    eyebrow.textContent = p.label;
    questionText.textContent = p.question;
    choosePage.classList.add("exiting");
    setTimeout(() => {
      choosePage.style.display = "none";
      unlockPage.style.display = "flex";
      unlockPage.classList.remove("exiting");
      answerInput.focus();
    }, 350);
  });
});

backLink.addEventListener("click", e => {
  e.preventDefault();
  unlockPage.classList.add("exiting");
  setTimeout(() => {
    unlockPage.style.display = "none";
    choosePage.style.display = "flex";
    choosePage.classList.remove("exiting");
    answerInput.value = "";
    errorMsg.textContent = "";
    selectedPerson = null;
  }, 350);
});

async function attemptUnlock() {
  if (!selectedPerson) return;
  const answer = answerInput.value.trim();
  if (!answer) {
    errorMsg.textContent = "Please type your answer.";
    return;
  }

  unlockBtn.disabled = true;
  unlockBtn.textContent = "Unlocking...";
  errorMsg.textContent = "";

  try {
    await setPersistence(auth, browserSessionPersistence);
    await signInWithEmailAndPassword(auth, PERSONS[selectedPerson].email, answer);
    unlockBtn.textContent = "✓ Unlocked";
    unlockPage.classList.add("exiting");
    setTimeout(() => {
      unlockPage.style.display = "none";
      successPage.style.display = "flex";
      setTimeout(() => location.href = "chat.html", 900);
    }, 350);
  } catch (err) {
    const map = {
      "auth/wrong-password": "That's not quite right. Try again? ♡",
      "auth/invalid-credential": "That's not quite right. Try again? ♡",
      "auth/too-many-requests": "Too many attempts. Try again later.",
      "auth/network-request-failed": "Network issue — check your connection."
    };
    errorMsg.textContent = map[err.code] || "Unable to unlock this space.";
    unlockBtn.textContent = "Unlock";
    unlockBtn.disabled = false;
    answerInput.focus();
  }
}

unlockBtn.addEventListener("click", attemptUnlock);
answerInput.addEventListener("keydown", e => {
  if (e.key === "Enter") attemptUnlock();
});
