<template>
  <div class="wrap">
    <header>
      <div>
        <h1>e区域ログインページ</h1>
        <div class="meta">区域管理＆地図アプリ</div>
      </div>
    </header>

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
      <p>認証方法を選んでください</p>
      <p class="status-msg">{{ statusMsg }}</p>
      <p class="error-msg">{{ errorMsg }}</p>

      <!-- 認証方式セレクタ -->
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
          <span>ID・パスワード</span>
        </button>
        <button
          type="button"
          class="method-tab"
          :class="{ active: authMethod === 'google' }"
          @click="selectMethod('google')"
        >
          <i class="fab fa-google"></i>
          <span>Google</span>
        </button>
      </div>

      <!-- ユーザー選択（パスキー・ID/パスワードの両方で共通） -->
      <div v-if="authMethod === 'passkey' || authMethod === 'password'">
        <label class="field-label">頭文字の行を選択</label>
        <div class="gyou-row">
          <button
            v-for="g in gyouList"
            :key="g"
            type="button"
            class="gyou-btn"
            :class="{ active: selectedGyou === g }"
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
            @click="selectedUserId = u.id"
          >
            <span class="user-name">{{ u.name }}</span>
            <span class="user-email">{{ u.maskedEmail }}</span>
          </button>
          <p v-if="filteredUsers.length === 0" class="hint">この行に該当するユーザーがいません</p>
        </div>
        <p v-else class="hint">行を選ぶとユーザーの一覧が表示されます</p>
      </div>

      <!-- パスキー -->
      <template v-if="authMethod === 'passkey'">
        <button v-if="hasPasskeyFlag" id="passkeyLoginBtn" @click="loginPasskey" :disabled="loading">
          <i class="fas fa-fingerprint"></i>
          パスキーでログインする
        </button>
        <template v-else>
          <button id="passkeyRegisterBtn" class="oauth-btn" @click="openRegisterDialog" :disabled="loading">
            <i class="fas fa-plus"></i>
            パスキーを登録する
          </button>
          <p class="hint">初期パスワードの確認後に登録します</p>
        </template>
      </template>

      <!-- ID / パスワード -->
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

      <!-- Google -->
      <template v-if="authMethod === 'google'">
        <button class="oauth-btn" id="googleBtn" @click="loginGoogle" :disabled="loading">
          <img src="https://www.google.com/favicon.ico" width="18" alt="Google" />
          Googleアカウントでログイン
        </button>
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
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { useAuthStore } from "@/store/authStore.js";
import {
  loginWithEmail,
  loginWithGoogle,
  loginWithCustomToken,
} from "@/services/auth.js";
import {
  getLoginUserInformation,
  verifySiteAccessCode,
  getLoginUserOptions,
  resolveLoginEmail,
  getWebauthnAuthenticationOptions,
  verifyWebauthnAuthentication,
  getWebauthnRegistrationOptions,
  verifyWebauthnRegistration,
} from "@/services/api.js";

const HAS_PASSKEY_KEY   = "ekuiki_has_passkey";
const GATE_UNLOCKED_KEY = "ekuiki_gate_unlocked";

const router    = useRouter();
const authStore = useAuthStore();

const storedCode   = sessionStorage.getItem(GATE_UNLOCKED_KEY) || "";
const unlocked     = ref(!!storedCode);
const accessCode   = ref(storedCode);
const gateError    = ref("");
const checkingCode = ref(false);

const authMethod    = ref("passkey");
const users          = ref([]);
const selectedUserId = ref(null);

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

const filteredUsers = computed(() => {
  if (!selectedGyou.value) return [];
  return users.value.filter(u => firstLetterToGyou(u.kana) === selectedGyou.value);
});

function selectGyou(g) {
  selectedGyou.value = selectedGyou.value === g ? "" : g;
  selectedUserId.value = null;
}

const password     = ref("");
const showPassword = ref(false);
const loading      = ref(false);
const statusMsg    = ref("");
const errorMsg     = ref("");

const hasPasskeyFlag = ref(localStorage.getItem(HAS_PASSKEY_KEY) === "1");

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
  } catch (e) {
    gateError.value = e.message;
  } finally {
    checkingCode.value = false;
  }
}

function selectMethod(method) {
  authMethod.value = method;
  errorMsg.value   = "";
  selectedGyou.value   = "";
  selectedUserId.value  = null;
}

async function fetchUserOptions() {
  try {
    const res = await getLoginUserOptions(accessCode.value);
    if (res.status === "success") users.value = res.users || [];
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

async function loginGoogle() {
  errorMsg.value = "";
  loading.value  = true;
  try {
    await loginWithGoogle();
    await afterLogin();
  } catch (e) {
    errorMsg.value = e.message;
    loading.value  = false;
  }
}

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

    localStorage.setItem(HAS_PASSKEY_KEY, "1");
    hasPasskeyFlag.value = true;

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

    localStorage.setItem(HAS_PASSKEY_KEY, "1");
    hasPasskeyFlag.value = true;
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
  if (unlocked.value) fetchUserOptions();
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

.method-tabs {
  display: flex;
  border: 1px solid #d1d5db;
  border-radius: var(--radius);
  overflow: hidden;
  margin: 12px 0 16px;
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
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
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
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  background: #fff;
  color: #0b1220;
  border: 1px solid #d1d5db;
  text-align: left;
  font-size: 14px;
}

.user-item .user-name { font-weight: 600; }

.user-item .user-email { font-size: 12px; color: var(--muted); }

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

.status-msg { color: #0f62fe; font-size: 14px; min-height: 20px; margin-top: 8px; }

.error-msg { color: red; font-size: 14px; min-height: 20px; }

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
