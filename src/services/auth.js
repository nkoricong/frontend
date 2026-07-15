// src/services/auth.js
// Firebase Authentication ラッパー

import { initializeApp }          from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  signInWithRedirect,
  getRedirectResult,
  signInWithCustomToken,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

// Firebase 設定は Worker の getFirebaseConfig から動的取得、または .env で管理
// ここでは Vite の環境変数（.env）から読み込む
const firebaseConfig = {
  apiKey:    import.meta.env.VITE_FIREBASE_APIKEY    || "AIzaSyBCib4rAXfXO_6nAiEO-VutN-FytgdnuvA",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "ekuikidev.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID  || "ekuikidev",
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);

/** 現在のユーザーの ID Token を取得する */
export async function getIdToken() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return user.getIdToken();
}

/** Email / Password でログイン */
export async function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

/**
 * Google ログイン。
 * signInWithPopup は Google のログインポップアップ側が送出する
 * Cross-Origin-Opener-Policy によって window.close() がブロックされ
 * コンソールエラーになるため、signInWithRedirect を使う（ページ遷移で戻り、
 * getGoogleRedirectResult() で結果を受け取る）。
 */
export async function loginWithGoogle() {
  return signInWithRedirect(auth, new GoogleAuthProvider());
}

/** signInWithRedirect でのGoogleログイン後、リダイレクト結果を取得する */
export async function getGoogleRedirectResult() {
  return getRedirectResult(auth);
}

/** パスキー認証成功後に発行された Firebase カスタムトークンでログインする */
export async function loginWithCustomToken(token) {
  return signInWithCustomToken(auth, token);
}

/** ログアウト */
export async function logout() {
  return signOut(auth);
}

/**
 * 認証状態の変化を監視する
 * @param {Function} callback - (user | null) => void
 */
export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

export { auth };
