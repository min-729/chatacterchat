// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // ⭐ Storage 도구 추가

// 네가 제공한 웹 앱의 Firebase 설정 (Config)
const firebaseConfig = {
    apiKey: "AIzaSyAuds6LtJHwGE9JtbYNrFdSlZ9pGE0CYoE",
    authDomain: "eyld-29e57.firebaseapp.com",
    projectId: "eyld-29e57",
    storageBucket: "eyld-29e57.firebasestorage.app",
    messagingSenderId: "67626836190",
    appId: "1:67626836190:web:ad7e99c9a6eba0cc72224f",
    measurementId: "G-F5F136LNC2"
};

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig);

// 데이터베이스(Firestore) 초기화 및 내보내기
export const db = getFirestore(app);

// ⭐ Storage 초기화 및 내보내기 (이 부분이 없어서 에러가 났던 거야)
export const storage = getStorage(app);