// ============================================================
//  Firebase configuration
//  Replace EVERY value below with your own project's config.
//  Firebase Console → Project Settings → General → Your apps
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyBvVv5fMDUoIYnyNXevbdWPIUEGPSN0ia4",
  authDomain:        "chatingg-1407e.firebaseapp.com",
  projectId: "chatingg-1407e",
  storageBucket: "chatingg-1407e.firebasestorage.app",
  messagingSenderId: "1039126800144",
  appId: "1:1039126800144:web:2119f56b85f78d7c086795",
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

export { app, auth, db };