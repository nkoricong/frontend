// src/services/auth.js
// Firebase Authentication ラッパー

import { initializeApp }          from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  signInWithCredential,
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

// Google Identity Services (GIS) のWebクライアントID。
// FirebaseがGoogleログインプロバイダ向けに自動生成するOAuth 2.0クライアントID
// （Firebase Console→Authentication→Sign-in method→Google→ウェブSDK構成 で確認できる）。
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
  || "896828437660-0vbpc2r5h2b3ion3o0rkrjvqcbct2e38.apps.googleusercontent.com";

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

// ------------------------------------------------------------------
// Google ログイン（Google Identity Services + signInWithCredential）
// ------------------------------------------------------------------
//
// 以前は signInWithPopup → （COOPでwindow.close()がブロックされる問題のため）
// signInWithRedirect と切り替えてきたが、いずれもFirebaseの認証ドメイン
// （authDomain＝ekuikidev.firebaseapp.com）上の隠しiframe/ストレージへの
// クロスオリジンアクセスに依存しており、Edgeの「トラッキング防止」など
// ブラウザのサードパーティストレージ制限機能に阻まれてリダイレクト結果を
// 受け取れず、ログインが完了しなくなっていた（#65）。
// Google Identity Services（GIS）でIDトークンを直接取得し、
// signInWithCredentialでFirebaseにサインインすることで、authDomainの
// iframe/ストレージに一切依存しないようにする。

let gisScriptPromise = null;

/** Google Identity Services のスクリプトを一度だけ読み込む */
function loadGoogleIdentityScript() {
  if (gisScriptPromise) return gisScriptPromise;
  gisScriptPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src   = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload  = () => resolve();
    script.onerror = () => reject(new Error("Google Identity Servicesの読み込みに失敗しました"));
    document.head.appendChild(script);
  });
  return gisScriptPromise;
}

/**
 * GoogleのIDトークンからFirebase認証情報を作成してサインインする。
 * @param {string} idToken - GISのcallbackで受け取る response.credential
 */
export async function loginWithGoogleCredential(idToken) {
  const credential = GoogleAuthProvider.credential(idToken);
  return signInWithCredential(auth, credential);
}

/**
 * Google公式のサインインボタンを指定コンテナへ描画する。
 * ボタンがクリックされてユーザーがGoogleアカウントを選択すると、
 * onCredential(idToken) が呼ばれる。
 * @param {HTMLElement} container
 * @param {(idToken: string) => void} onCredential
 * @param {(error: Error) => void} onError
 */
export async function renderGoogleSignInButton(container, onCredential, onError) {
  try {
    await loadGoogleIdentityScript();
  } catch (e) {
    onError?.(e);
    return;
  }
  if (!container) return;

  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback:  (response) => onCredential(response.credential),
  });

  container.innerHTML = "";
  window.google.accounts.id.renderButton(container, {
    theme:  "outline",
    size:   "large",
    shape:  "rectangular",
    text:   "signin_with",
    width:  300,
  });
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
