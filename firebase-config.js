// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

const firebaseConfig = {
  apiKey: "PUT_YOUR_NEW_API_KEY_HERE",
  authDomain: "sharpe-legal.firebaseapp.com",
  projectId: "sharpe-legal",
  storageBucket: "sharpe-legal.firebasestorage.app",
  messagingSenderId: "770027799385",
  appId: "1:770027799385:web:64c3f7bd4b7a140f5c0248",
  measurementId: "G-168BBWG526"
};

const app = initializeApp(firebaseConfig);

export default app;
