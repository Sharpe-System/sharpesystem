// firebase-config.js (CDN modular version for static sites)

import { initializeApp, getApps, getApp } 
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import { getAuth } 
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA1NzDz4eBT_zI3P2mDboOb4Hpwvyadlmo",
  authDomain: "sharpe-legal.firebaseapp.com",
  projectId: "sharpe-legal",
  storageBucket: "sharpe-legal.firebasestorage.app",
  messagingSenderId: "770027799385",
  appId: "1:770027799385:web:64c3f7bd4b7a140f5c0248",
  measurementId: "G-168BBWG526"
};

// Prevent duplicate initialization
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

// Expose globally so all modules (gate, RFO, dashboard) can access
window.firebaseApp = app;
window.firebaseAuth = auth;
window.firebaseDB = db;

// Firestore helpers for rfo-state.js
window.firebaseDoc = doc;
window.firebaseGetDoc = getDoc;
window.firebaseSetDoc = setDoc;

export { app, auth, db };
