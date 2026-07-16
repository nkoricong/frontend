<template>
  <div class="wrap">
    <header>
      <div>
        <h1>e区域ログインページ</h1>
        <div class="meta">区域管理＆地図アプリ</div>
      </div>
    </header>

    <!-- オフライン利用案内（ネット未接続かつオフライン保存済みの子カードがある場合） -->
    <section v-if="!online && hasOffline" class="card offline-card">
      <p class="small mb-2">
        <i class="fas fa-plane"></i>
        ネット接続がありません。この端末に保存済みの子カードだけを、ログインなしで閲覧・結果登録できます。
      </p>
      <button type="button" @click="router.push({ name: 'offlineHome' })">
        <i class="fas fa-plane"></i> オフラインで利用する
      </button>
    </section>

    <!-- アクセスコード確認（未確認の間はログイン操作を一切表示しない） -->
    <section v-if="!unlocked" class="card" id="gateCard">
      <p>アクセスコードを入力してください</p>
      <p class="error-msg">{{ gateError }}</p>
      <label class="field-label" for="accessCode">アクセスコード</label>
      <input
        type="text"
        id="accessCode"
        v-model="accessCode"
        inputmode="numeric"
        placeholder="半角数字"
        @keyup.enter="submitAccessCode"
      />
      <button @click="submitAccessCode" :disabled="checkingCode">
        {{ checkingCode ? "確認中..." : "確認する" }}
      </button>
    </section>

    <section v-else class="card" id="mainCard">
      <p v-if="statusMsg" class="status-msg">{{ statusMsg }}</p>
      <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

      <!-- (1) ユーザー選択 -->
      <p class="section-title">ログインするユーザーを選択してください</p>

      <div v-if="!showUserPicker && selectedUser" class="selected-user-summary">
        <div class="selected-user-info">
          <div class="user-name">{{ selectedUser.name }}</div>
          <div class="user-email">{{ selectedUser.email }}</div>
        </div>
        <button type="button" class="change-user-btn" @click="showUserPicker = true">変更</button>
      </div>
      <template v-else>
        <label class="field-label">ユーザー氏名の頭文字の行を選択</label>
        <div class="gyou-row">
          <button
            v-for="g in gyouList"
            :key="g"
            type="button"
            class="gyou-btn"
            :class="{ active: selectedGyou === g }"
            :disabled="!gyouHasUsers(g)"
            @click="selectGyou(g)"
          >{{ g }}</button>
        </div>

        <div v-if="selectedGyou" class="user-list">
          <button
            v-for="u in filteredUsers"
            :key="u.id"
            type="button"
            class="user-item"
            :class="{ active: selectedUserId === u.id }"
            @click="selectUser(u)"
          >
            <span class="user-name">{{ u.name }}</span>
            <span class="user-email">{{ u.email }}</span>
          </button>
          <p v-if="filteredUsers.length === 0" class="hint">この行に該当するユーザーがいません</p>
        </div>
        <p v-else class="hint">行を選ぶとユーザーの一覧が表示されます</p>
      </template>

      <!-- (2) 認証方式 -->
      <p class="section-title section-title-spaced">認証方法を選んでください</p>
      <div class="method-tabs">
        <button
          type="button"
          class="method-tab"
          :class="{ active: authMethod === 'passkey' }"
          @click="selectMethod('passkey')"
        >
          <i class="fas fa-fingerprint"></i>
          <span>パスキー</span>
        </button>
        <button
          type="button"
          class="method-tab"
          :class="{ active: authMethod === 'password' }"
          @click="selectMethod('password')"
        >
          <i class="fas fa-key"></i>
          <span>パスワード認証</span>
        </button>
        <button
          type="button"
          class="method-tab"
          :class="{ active: authMethod === 'google' }"
          @click="selectMethod('google')"
        >
          <i class="fab fa-google"></i>
          <span>Google連携</span>
        </button>
      </div>

      <!-- (3) パスキー / パスワード / Google -->
      <template v-if="authMethod === 'passkey'">
        <p v-if="checkingPasskey" class="hint">確認中...</p>
        <template v-else-if="hasPasskeyForSelectedUser">
          <button id="passkeyLoginBtn" @click="loginPasskey" :disabled="loading">
            <i class="fas fa-fingerprint"></i>
            パスキーでログインする
          </button>
        </template>
        <template v-else>
          <button id="passkeyRegisterBtn" class="oauth-btn" @click="openRegisterDialog" :disabled="loading">
            <i class="fas fa-plus"></i>
            パスキーを登録する
          </button>
          <p class="hint">初期パスワードの確認後に登録します</p>
        </template>
      </template>

      <template v-if="authMethod === 'password'">
        <label class="field-label" for="password">パスワード</label>
        <div class="pw-wrap">
          <input
            :type="showPassword ? 'text' : 'password'"
            id="password"
            v-model="password"
            placeholder="パスワードを入力"
          />
          <button class="pw-toggle" @click="showPassword = !showPassword" type="button">
            <i :class="showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
          </button>
        </div>
        <button id="loginBtn" @click="loginPassword" :disabled="loading">
          ログインする
        </button>
      </template>

      <template v-if="authMethod === 'google'">
        <p v-if="isInAppBrowserUA" class="hint in-app-warning">
          <i class="fas fa-exclamation-triangle"></i>
          LINEなどのアプリ内ブラウザではGoogleログインを利用できません。Safari／Chromeなど標準のブラウザで開き直してください。
        </p>
        <div v-show="!isInAppBrowserUA" ref="googleButtonEl" class="google-btn-container"></div>
        <p v-if="googleButtonError" class="error-msg">{{ googleButtonError }}</p>
      </template>
    </section>

    <footer class="small">このページは e区域 の区域管理アプリです</footer>

    <!-- パスキー登録：初期パスワード確認ダイアログ -->
    <div v-if="showRegisterDialog" class="dialog-overlay" @click.self="closeRegisterDialog">
      <div class="dialog">
        <h2>パスキーの登録</h2>
        <p class="dialog-desc">初期パスワードを入力してください。確認できたらこの端末にパスキーを登録します。</p>
        <label class="field-label" for="registerPassword">パスワード</label>
        <input
          type="password"
          id="registerPassword"
          v-model="registerPassword"
          placeholder="パスワードを入力"
        />
        <p v-if="registerError" class="error-msg">{{ registerError }}</p>
        <div class="dialog-actions">
          <button class="dialog-secondary" @click="closeRegisterDialog" :disabled="registering">キャンセル</button>
          <button @click="submitRegisterPasskey" :disabled="registering">
            {{ registering ? "確認中..." : "確認して登録" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from "vue";
import { useRouter } from "vue-router";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { useAuthStore } from "@/store/authStore.js";
import { useOnlineStatus, hasOfflineData } from "@/services/offline.js";
import {
  loginWithEmail,
  loginWithGoogleCredential,
  renderGoogleSignInButton,
  loginWithCustomToken,
} from "@/services/auth.js";
import {
  getLoginUserInformation,
  verifySiteAccessCode,
  getLoginUserOptions,
  resolveLoginEmail,
  hasPasskeyForEmail,
  getWebauthnAuthenticationOptions,
  verifyWebauthnAuthentication,
  getWebauthnRegistrationOptions,
  verifyWebauthnRegistration,
} from "@/services/api.js";

const GATE_UNLOCKED_KEY = "ekuiki_gate_unlocked";
const LAST_METHOD_KEY   = "ekuiki_last_auth_method";
const LAST_GYOU_KEY     = "ekuiki_last_gyou";
const LAST_USER_KEY     = "ekuiki_last_user_id";

const router    = useRouter();
const authStore = useAuthStore();

const online     = useOnlineStatus();
const hasOffline = ref(hasOfflineData());

const storedCode   = sessionStorage.getItem(GATE_UNLOCKED_KEY) || "";
const unlocked     = ref(!!storedCode);
const accessCode   = ref(storedCode);
const gateError    = ref("");
const checkingCode = ref(false);

// 認証方法は端末ごとに直前の選択を記憶し、初期値として復元する
const authMethod    = ref(localStorage.getItem(LAST_METHOD_KEY) || "passkey");
const users          = ref([]);
const selectedUserId = ref(null);

// ユーザー選択欄：前回選択したユーザーが今回も見つかった場合は折り畳んで表示する
const showUserPicker = ref(true);
const selectedUser = computed(() => users.value.find(u => u.id === selectedUserId.value) ?? null);

// 選択中ユーザーのパスキー登録有無はサーバーに問い合わせて判定する（#64）。
// 以前は端末のlocalStorageで判定していたが、iOSでは通常のSafariタブと
// ホーム画面追加（スタンドアロン）でストレージが分離されるため、登録済みの
// 組み合わせでも「登録する」側が誤表示されることがあった。
const hasPasskeyForSelectedUser = ref(false);
const checkingPasskey           = ref(false);

watch(() => selectedUser.value?.email, async (email) => {
  hasPasskeyForSelectedUser.value = false;
  if (!email) return;
  checkingPasskey.value = true;
  try {
    const res = await hasPasskeyForEmail(email);
    hasPasskeyForSelectedUser.value = res.status === "success" && !!res.hasPasskey;
  } catch {
    hasPasskeyForSelectedUser.value = false;
  } finally {
    checkingPasskey.value = false;
  }
}, { immediate: true });

// LINE等のアプリ内ブラウザではGoogleがOAuthログインをブロックし、サインイン画面が
// 表示しきる前に自動的にアプリへ戻されてしまう（Googleの仕様によるもので、当アプリ側
// では回避できない）。事前に検出し、標準ブラウザで開き直すよう案内する。
function detectInAppBrowser() {
  const ua = navigator.userAgent || "";
  return /Line\/|FBAN|FBAV|Instagram|Twitter|MicroMessenger|KAKAOTALK|NAVER\(|; wv\)/i.test(ua);
}
const isInAppBrowserUA = ref(detectInAppBrowser());

// 氏名かな（UserKana、ローマ字表記）の頭文字から五十音の行へ振り分ける
const GYOU_LIST = ["あ", "か", "さ", "た", "な", "は", "ま", "や", "ら", "わ"];
const gyouList     = GYOU_LIST;
const selectedGyou = ref("");

function firstLetterToGyou(kana) {
  const c = String(kana || "").charAt(0).toUpperCase();
  if ("AIUEO".includes(c)) return "あ";
  if ("KG".includes(c))    return "か";
  if ("SZJ".includes(c))   return "さ";
  if ("TDC".includes(c))   return "た";
  if (c === "N")           return "な";
  if ("HBPF".includes(c))  return "は";
  if (c === "M")           return "ま";
  if (c === "Y")           return "や";
  if (c === "R")           return "ら";
  if (c === "W")           return "わ";
  return "";
}

function usersInGyou(g) {
  return users.value.filter(u => firstLetterToGyou(u.kana) === g);
}

function gyouHasUsers(g) {
  return usersInGyou(g).length > 0;
}

const filteredUsers = computed(() => {
  if (!selectedGyou.value) return [];
  return usersInGyou(selectedGyou.value);
});

function selectGyou(g) {
  selectedGyou.value = selectedGyou.value === g ? "" : g;
  selectedUserId.value = null;
  if (selectedGyou.value) localStorage.setItem(LAST_GYOU_KEY, selectedGyou.value);
}

function selectUser(u) {
  selectedUserId.value = u.id;
  localStorage.setItem(LAST_USER_KEY, u.id);
  showUserPicker.value = false;
}

// 記憶された行・ユーザーを復元する。記憶が無い/該当ユーザーが既に居ない場合は
// 「あ」行とその先頭ユーザーをデフォルトとして選択する。
// 前回の選択が今回も見つかった場合のみ、選択欄を折り畳んで表示する。
function restoreGyouAndUser() {
  const rememberedGyou = localStorage.getItem(LAST_GYOU_KEY);
  let gyou = rememberedGyou && gyouHasUsers(rememberedGyou) ? rememberedGyou : null;
  if (!gyou) gyou = gyouList.find(g => gyouHasUsers(g)) || "";
  selectedGyou.value = gyou;

  const candidates     = usersInGyou(gyou);
  const rememberedUser = localStorage.getItem(LAST_USER_KEY);
  const matched         = candidates.find(u => u.id === rememberedUser);
  selectedUserId.value  = matched ? matched.id : (candidates[0]?.id ?? null);
  showUserPicker.value  = !matched;
}

const password     = ref("");
const showPassword = ref(false);
const loading      = ref(false);
const statusMsg    = ref("");
const errorMsg     = ref("");

const showRegisterDialog = ref(false);
const registerPassword   = ref("");
const registerError      = ref("");
const registering        = ref(false);

async function submitAccessCode() {
  gateError.value = "";
  if (!accessCode.value) {
    gateError.value = "アクセスコードを入力してください";
    return;
  }
  checkingCode.value = true;
  try {
    const res = await verifySiteAccessCode(accessCode.value);
    if (res.status !== "success") {
      gateError.value = res.message || "コードが一致しません";
      return;
    }
    sessionStorage.setItem(GATE_UNLOCKED_KEY, accessCode.value);
    unlocked.value = true;
    await fetchUserOptions();
    if (authMethod.value === "google") ensureGoogleButton();
  } catch (e) {
    gateError.value = e.message;
  } finally {
    checkingCode.value = false;
  }
}

// 認証方法の切替はユーザー選択欄と独立しているため、選択済みユーザーは維持する
function selectMethod(method) {
  authMethod.value = method;
  errorMsg.value   = "";
  localStorage.setItem(LAST_METHOD_KEY, method);
}

async function fetchUserOptions() {
  try {
    const res = await getLoginUserOptions(accessCode.value);
    if (res.status === "success") {
      users.value = res.users || [];
      restoreGyouAndUser();
    }
  } catch (e) {
    console.error(e);
  }
}

async function resolveSelectedEmail() {
  const res = await resolveLoginEmail(selectedUserId.value, accessCode.value);
  if (res.status !== "success") throw new Error(res.message || "メールアドレスの解決に失敗しました");
  return res.email;
}

async function afterLogin() {
  statusMsg.value = "ユーザー情報を取得中...";
  try {
    const info = await getLoginUserInformation();
    if (info.status === "success") {
      authStore.setUserInfo(info);
      router.push({ name: "mainMenu" });
    } else {
      errorMsg.value = "ユーザーが見つかりませんでした。管理者にお問い合わせください。";
    }
  } catch (e) {
    errorMsg.value = e.message;
  } finally {
    statusMsg.value = "";
    loading.value   = false;
  }
}

async function loginPassword() {
  errorMsg.value = "";
  if (!selectedUserId.value) {
    errorMsg.value = "ユーザーを選択してください";
    return;
  }
  if (!password.value) {
    errorMsg.value = "パスワードを入力してください";
    return;
  }

  loading.value   = true;
  statusMsg.value = "認証中...";
  try {
    const email = await resolveSelectedEmail();
    await loginWithEmail(email, password.value);
    await afterLogin();
  } catch (e) {
    errorMsg.value  = e.message;
    statusMsg.value = "";
    loading.value   = false;
  }
}

// Firebase Authのエラーコードを分かりやすい日本語メッセージに変換する
function mapAuthError(e) {
  switch (e?.code) {
    case "auth/web-storage-unsupported":
    case "auth/operation-not-supported-in-this-environment":
      return "この端末・ブラウザではサードパーティCookieがブロックされているため、Google連携ログインを利用できません。ブラウザの設定を確認するか、他の認証方法をお試しください。";
    case "auth/unauthorized-domain":
      return "このサイトのドメインがGoogleログインの許可リストに登録されていません。管理者にお問い合わせください。";
    case "auth/network-request-failed":
      return "ネットワークエラーが発生しました。接続を確認して再度お試しください。";
    case "auth/popup-blocked":
    case "auth/redirect-cancelled-by-user":
      return "Googleログインが中断されました。もう一度お試しください。";
    default:
      return e?.message || "認証中にエラーが発生しました";
  }
}

// ---- Google連携（Google Identity Services） ----
const googleButtonEl    = ref(null);
const googleButtonError = ref("");
let googleButtonRendered = false;

async function ensureGoogleButton() {
  if (isInAppBrowserUA.value || googleButtonRendered) return;
  await nextTick();
  if (!googleButtonEl.value) return;
  googleButtonRendered = true;
  await renderGoogleSignInButton(
    googleButtonEl.value,
    handleGoogleCredential,
    (e) => { googleButtonError.value = e.message; },
  );
}

async function handleGoogleCredential(idToken) {
  errorMsg.value = "";
  loading.value  = true;
  try {
    await loginWithGoogleCredential(idToken);
    await afterLogin();
  } catch (e) {
    errorMsg.value = mapAuthError(e);
    loading.value  = false;
  }
}

watch(authMethod, (m) => {
  if (m === "google") ensureGoogleButton();
});

async function loginPasskey() {
  errorMsg.value = "";
  if (!selectedUserId.value) {
    errorMsg.value = "ユーザーを選択してください";
    return;
  }

  loading.value   = true;
  statusMsg.value = "パスキーを確認しています...";
  try {
    const email = await resolveSelectedEmail();

    const optionsRes = await getWebauthnAuthenticationOptions(email);
    if (optionsRes.status !== "success") {
      throw new Error(optionsRes.message || "パスキーの取得に失敗しました");
    }

    const credential = await startAuthentication({ optionsJSON: optionsRes.options });

    const verifyRes = await verifyWebauthnAuthentication(email, credential);
    if (verifyRes.status !== "success") {
      throw new Error(verifyRes.message || "パスキーの検証に失敗しました");
    }

    await loginWithCustomToken(verifyRes.token);
    await afterLogin();
  } catch (e) {
    errorMsg.value  = e.name === "NotAllowedError" ? "パスキーの操作がキャンセルされました" : e.message;
    statusMsg.value = "";
    loading.value   = false;
  }
}

function openRegisterDialog() {
  errorMsg.value = "";
  if (!selectedUserId.value) {
    errorMsg.value = "ユーザーを選択してください";
    return;
  }
  registerPassword.value = "";
  registerError.value    = "";
  showRegisterDialog.value = true;
}

function closeRegisterDialog() {
  if (registering.value) return;
  showRegisterDialog.value = false;
}

async function submitRegisterPasskey() {
  if (!registerPassword.value) {
    registerError.value = "パスワードを入力してください";
    return;
  }

  registering.value   = true;
  registerError.value = "";
  try {
    const email = await resolveSelectedEmail();

    // 初期パスワードでログインし、本人確認とする
    await loginWithEmail(email, registerPassword.value);

    const optionsRes = await getWebauthnRegistrationOptions();
    if (optionsRes.status !== "success") {
      throw new Error(optionsRes.message || "パスキー登録の準備に失敗しました");
    }

    const credential = await startRegistration({ optionsJSON: optionsRes.options });

    const verifyRes = await verifyWebauthnRegistration(credential);
    if (verifyRes.status !== "success") {
      throw new Error(verifyRes.message || "パスキーの登録に失敗しました");
    }

    hasPasskeyForSelectedUser.value = true;
    showRegisterDialog.value = false;

    // 既にパスワードでログイン済みなので、そのままアプリへ進む
    loading.value = true;
    await afterLogin();
  } catch (e) {
    registerError.value = e.name === "NotAllowedError" ? "パスキーの登録がキャンセルされました" : e.message;
  } finally {
    registering.value = false;
  }
}

onMounted(() => {
  if (unlocked.value) {
    fetchUserOptions();
    if (authMethod.value === "google") ensureGoogleButton();
  }
});
</script>

<style scoped>
:root {
  --bg: #f4f6fb;
  --card: #ffffff;
  --muted: #6b7280;
  --accent: #0f62fe;
  --radius: 10px;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}

body { margin: 0; background: var(--bg); color: #0b1220; padding: 20px; }

.wrap { max-width: 480px; margin: 40px auto; padding: 0 16px; }

header { margin-bottom: 16px; }

h1 { font-size: 20px; margin: 0; }

.meta { color: var(--muted); font-size: 13px; margin-top: 4px; }

.card {
  background: #fff;
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 6px 18px rgba(16,24,40,0.06);
}

.section-title {
  margin: 0 0 4px;
}

.section-title-spaced {
  margin-top: 20px;
}

.selected-user-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #e8f0fe;
}

.selected-user-info {
  overflow: hidden;
}

.selected-user-info .user-name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-user-info .user-email {
  font-size: 12px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.change-user-btn {
  width: auto;
  flex-shrink: 0;
  margin-top: 0;
  padding: 6px 14px;
  font-size: 13px;
  background: #fff;
  color: var(--accent, #0f62fe);
  border: 1px solid var(--accent, #0f62fe);
}

.in-app-warning {
  color: #b45309;
}

.google-btn-container {
  margin-top: 16px;
  display: flex;
  justify-content: center;
}

.offline-card {
  margin-bottom: 16px;
  background: #fff8e6;
}

.offline-card button {
  margin-top: 4px;
  background: #6f42c1;
}

.method-tabs {
  display: flex;
  border: 1px solid #d1d5db;
  border-radius: var(--radius);
  overflow: hidden;
  margin: 0 0 16px;
}

.method-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 4px;
  margin: 0;
  border: 0;
  border-left: 1px solid #d1d5db;
  background: #fff;
  color: var(--muted);
  font-size: 13px;
  cursor: pointer;
}

.method-tab:first-child { border-left: 0; }

.method-tab i { font-size: 18px; }

.method-tab.active {
  background: #e8f0fe;
  color: var(--accent);
  font-weight: 600;
}

.field-label {
  display: block;
  font-size: 13px;
  color: var(--muted);
  margin-top: 12px;
  margin-bottom: 4px;
}

select {
  width: 100%;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  box-sizing: border-box;
  background: #fff;
}

.gyou-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}

.gyou-btn {
  width: auto;
  margin-top: 0;
  padding: 10px 0;
  font-size: 16px;
  font-weight: 500;
  background: #fff;
  color: #0b1220;
  border: 1px solid #d1d5db;
}

.gyou-btn.active {
  background: #e8f0fe;
  color: var(--accent, #0f62fe);
  border-color: var(--accent, #0f62fe);
  font-weight: 600;
}

.user-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
  max-height: 260px;
  overflow-y: auto;
}

.user-item {
  width: auto;
  margin-top: 0;
  padding: 6px 12px;
  display: flex;
  flex-direction: row;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  background: #fff;
  color: #0b1220;
  border: 1px solid #d1d5db;
  text-align: left;
  font-size: 14px;
}

.user-item .user-name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-item .user-email {
  font-size: 12px;
  color: var(--muted);
  flex-shrink: 0;
}

.user-item.active {
  background: #e8f0fe;
  border-color: var(--accent);
}

input {
  width: 100%;
  padding: 10px;
  margin-top: 0;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  box-sizing: border-box;
}

.pw-wrap { position: relative; }

.pw-wrap input { padding-right: 44px; }

.pw-toggle {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: auto;
  height: auto;
  margin: 0;
  background: none;
  border: none;
  cursor: pointer;
  color: #6b7280;
  padding: 4px;
  line-height: 1;
}

button {
  width: 100%;
  padding: 12px;
  margin-top: 16px;
  border-radius: 8px;
  border: 0;
  background: var(--accent, #0f62fe);
  color: #fff;
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
}

button:disabled { opacity: 0.5; cursor: not-allowed; }

.oauth-btn {
  background: #fff;
  color: #0b1220;
  border: 1px solid #d1d5db;
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: center;
}

.oauth-btn:hover { background: #eef2ff; }

.hint { font-size: 12px; color: var(--muted); text-align: center; margin: 8px 0 0; }

.status-msg { color: #0f62fe; font-size: 14px; margin: 4px 0; }

.error-msg { color: red; font-size: 14px; margin: 4px 0; }

.small { font-size: 13px; color: var(--muted); margin-top: 12px; text-align: center; }

.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.dialog {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  width: 100%;
  max-width: 360px;
  box-sizing: border-box;
}

.dialog h2 { font-size: 17px; margin: 0 0 8px; }

.dialog-desc { font-size: 13px; color: var(--muted); margin: 0 0 4px; }

.dialog-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.dialog-actions button { margin-top: 0; }

.dialog-secondary {
  background: #fff;
  color: #0b1220;
  border: 1px solid #d1d5db;
}
</style>
