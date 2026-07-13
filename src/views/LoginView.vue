<template>
  <div class="wrap">
    <header>
      <div>
        <h1>e区域ログインページ</h1>
        <div class="meta">区域管理＆地図アプリ</div>
      </div>
    </header>

    <section class="card" id="mainCard">
      <p>登録されたメールアドレスとパスワードを入力してログインしてください</p>
      <p class="status-msg">{{ statusMsg }}</p>
      <p class="error-msg">{{ errorMsg }}</p>

      <!-- Email / Password -->
      <input type="email" id="email" v-model="email" placeholder="メールアドレス" />

      <div class="pw-wrap">
        <input
          :type="showPassword ? 'text' : 'password'"
          id="password"
          v-model="password"
          placeholder="パスワード"
        />
        <button class="pw-toggle" @click="showPassword = !showPassword" type="button">
          <i :class="showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
        </button>
      </div>

      <button id="loginBtn" @click="loginEmail" :disabled="loading">
        入力されたメールアドレスでログイン
      </button>

      <button class="oauth-btn" id="passkeyBtn" @click="loginPasskey" :disabled="loading">
        <i class="fas fa-fingerprint"></i>
        パスキーでログイン
      </button>

      <hr />

      <!-- OAuth -->
      <button class="oauth-btn" id="googleBtn" @click="loginGoogle" :disabled="loading">
        <img src="https://www.google.com/favicon.ico" width="18" alt="Google" />
        Googleアカウントでログイン
      </button>
    </section>

    <footer class="small">このページは e区域 の区域管理アプリです</footer>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { startAuthentication } from "@simplewebauthn/browser";
import { useAuthStore } from "@/store/authStore.js";
import {
  loginWithEmail,
  loginWithGoogle,
  loginWithCustomToken,
} from "@/services/auth.js";
import {
  getLoginUserInformation,
  getWebauthnAuthenticationOptions,
  verifyWebauthnAuthentication,
} from "@/services/api.js";

const router    = useRouter();
const authStore = useAuthStore();

const email        = ref("");
const password     = ref("");
const showPassword = ref(false);
const loading      = ref(false);
const statusMsg    = ref("");
const errorMsg     = ref("");

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

async function loginEmail() {
  errorMsg.value  = "";
  statusMsg.value = "認証中...";
  loading.value   = true;
  try {
    await loginWithEmail(email.value, password.value);
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
  if (!email.value) {
    errorMsg.value = "パスキーでログインするには、まずメールアドレスを入力してください";
    return;
  }

  loading.value   = true;
  statusMsg.value = "パスキーを確認しています...";
  try {
    const optionsRes = await getWebauthnAuthenticationOptions(email.value);
    if (optionsRes.status !== "success") {
      throw new Error(optionsRes.message || "パスキーの取得に失敗しました");
    }

    const credential = await startAuthentication({ optionsJSON: optionsRes.options });

    const verifyRes = await verifyWebauthnAuthentication(email.value, credential);
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

input {
  width: 100%;
  padding: 10px;
  margin-top: 8px;
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
  padding: 10px;
  margin-top: 10px;
  border-radius: 8px;
  border: 0;
  background: var(--accent, #0f62fe);
  color: #fff;
  cursor: pointer;
  font-size: 15px;
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

.status-msg { color: #0f62fe; font-size: 14px; min-height: 20px; margin-top: 8px; }

.error-msg { color: red; font-size: 14px; min-height: 20px; }

.small { font-size: 13px; color: var(--muted); margin-top: 12px; text-align: center; }

hr { margin: 20px 0; }
</style>
