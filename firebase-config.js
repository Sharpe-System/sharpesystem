import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyA1NzDz4eBT_zI3P2mDboOb4Hpwvyadlmo",
  authDomain: "sharpe-legal.firebaseapp.com",
  projectId: "sharpe-legal",
  storageBucket: "sharpe-legal.firebasestorage.app",
  messagingSenderId: "770027799385",
  appId: "1:770027799385:web:64c3f7bd4b7a140f5c0248",
  measurementId: "G-168BBWG526"
};

const app = initializeApp(firebaseConfig);

export default app;
