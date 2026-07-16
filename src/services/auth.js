// src/services/auth.js
// Firebase Authentication ラッパー

import { initializeApp }          from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
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

// ブラウザのリロード／再訪問でもログイン状態が保持されるよう、
// 明示的に永続化方式（IndexedDB/localStorageベース）を指定する。
// 既定値でも同じ設定になるはずだが、暗黙の既定挙動に依存せず明示することで、
// 「リロードするとログイン画面に戻される」事象の原因切り分け・再発防止とする。
const persistenceReady = setPersistence(auth, browserLocalPersistence);

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
 * 認証状態の変化を監視する。永続化方式の設定完了を待ってから購読することで、
 * リロード直後に一瞬だけ未ログイン扱いになってしまうような競合を避ける。
 * @param {Function} callback - (user | null) => void
 * @returns {Function} 監視を解除する関数
 */
export function watchAuthState(callback) {
  let unsubscribe = () => {};
  let cancelled   = false;

  persistenceReady
    .catch(() => {}) // 永続化設定に失敗しても認証状態の監視自体は続行する
    .then(() => {
      if (!cancelled) unsubscribe = onAuthStateChanged(auth, callback);
    });

  return () => {
    cancelled = true;
    unsubscribe();
  };
}

export { auth };
