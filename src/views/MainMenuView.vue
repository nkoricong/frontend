<template>
  <div id="app" class="container">

    <!-- ローディング -->
    <div v-if="loading" class="text-center mt-5">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="mt-3">ユーザー情報を取得しています...</p>
    </div>

    <!-- メイン -->
    <div v-else>

      <!-- 上部ユーザー情報バー -->
      <div class="row bg-light mt-3 p-3 align-items-center rounded shadow-sm top-user-bar">
        <div class="col-8">
          <p class="mb-0">
            <strong>{{ authStore.userName }}</strong><br />
            {{ authStore.userEmail }}（{{ authStore.userGroup }}）
          </p>
        </div>
        <div class="col-4 d-flex justify-content-end">
          <button class="btn btn-link text-danger" @click="logout">
            <i class="fas fa-2x fa-door-open"></i><br />終了
          </button>
        </div>
      </div>

      <div class="text-end mt-1">
        <button class="btn btn-sm btn-outline-secondary" @click="registerPasskey" :disabled="registeringPasskey">
          <i class="fas fa-fingerprint"></i>
          <span v-if="registeringPasskey">登録中...</span>
          <span v-else>このデバイスにパスキーを登録</span>
        </button>
        <p v-if="passkeyMsg" class="small mt-1" :class="passkeyError ? 'text-danger' : 'text-success'">{{ passkeyMsg }}</p>
      </div>

      <br />

      <!-- タイトル -->
      <div class="text-center mb-4">
        <h2><i class="fas fa-home"></i> ホーム</h2>
      </div>

      <!-- メニュー -->
      <div class="row">
        <div class="col-12 col-md-10 col-lg-8 mx-auto">

          <button
            v-if="authStore.userRole >= 1100"
            class="btn btn-info col-12 mb-3 menu-button"
            @click="go('cardlist')"
          >
            <i class="fas fa-2x fa-tasks"></i>
            <h6>区域リスト</h6>
          </button>

          <button
            v-if="authStore.userRole >= 1010"
            class="btn btn-info col-12 mb-3 menu-button"
            @click="go('childlist')"
          >
            <i class="fas fa-2x fa-users"></i>
            <h6>グループページ</h6>
          </button>

          <button
            class="btn btn-primary col-12 mb-3 menu-button"
            @click="router.push({ name: 'assignmentList' })"
          >
            <i class="fas fa-2x fa-street-view"></i>
            <h6>マイページ</h6>
          </button>

          <button
            v-if="authStore.userRole >= 1001"
            class="btn btn-light col-12 mb-3 menu-button"
            @click="go('settings')"
          >
            <i class="fas fa-2x fa-tools"></i>
            <h6>設定</h6>
          </button>

          <button
            v-if="authStore.userRole >= 9001"
            class="btn btn-light col-12 mb-3 menu-button"
            @click="go('admin')"
          >
            <i class="fas fa-2x fa-user-cog"></i>
            <h6>管理者設定</h6>
          </button>

        </div>
      </div>

      <br />

      <!-- お知らせ -->
      <div class="row">
        <div class="col-12 col-md-10 col-lg-8 mx-auto">
          <h5><b>お知らせ</b></h5>
          <h6><b>2023/04/05</b></h6>
          <p class="text-danger"><b>マイページの貸出中カードに残件数を表示するよう変更しました。</b></p>
          <p>・一旦、全ての住戸の件数が表示されています。</p>
          <p class="text-primary"><b>・カードを開いて表示すると件数が更新されます。</b></p>
          <p>・残件数とは、訪問済や留守宅、訪問拒否を除いた、訪問可能な件数です。</p>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { startRegistration } from "@simplewebauthn/browser";
import { useAuthStore } from "@/store/authStore.js";
import { getWebauthnRegistrationOptions, verifyWebauthnRegistration } from "@/services/api.js";

const router    = useRouter();
const authStore = useAuthStore();
const loading   = ref(false);

const registeringPasskey = ref(false);
const passkeyMsg         = ref("");
const passkeyError       = ref(false);

async function logout() {
  await authStore.logout();
  router.push({ name: "login" });
}

// このデバイス（生体認証・セキュリティキー等）をログイン中のアカウントにパスキーとして登録する
async function registerPasskey() {
  passkeyMsg.value   = "";
  passkeyError.value = false;
  registeringPasskey.value = true;
  try {
    const optionsRes = await getWebauthnRegistrationOptions();
    if (optionsRes.status !== "success") {
      throw new Error(optionsRes.message || "パスキー登録の準備に失敗しました");
    }

    const credential = await startRegistration({ optionsJSON: optionsRes.options });

    const verifyRes = await verifyWebauthnRegistration(credential);
    if (verifyRes.status !== "success") {
      throw new Error(verifyRes.message || "パスキーの登録に失敗しました");
    }

    passkeyMsg.value = "パスキーを登録しました。次回からパスキーでログインできます。";
  } catch (e) {
    passkeyError.value = true;
    passkeyMsg.value   = e.name === "NotAllowedError" ? "パスキーの登録がキャンセルされました" : e.message;
  } finally {
    registeringPasskey.value = false;
  }
}

const PAGE_ROUTES = {
  cardlist:  "cardList",
  childlist: "childList",
  settings:  "settings",
  admin:     "admins",
};

function go(page) {
  const name = PAGE_ROUTES[page];
  if (name) router.push({ name });
}
</script>

<style scoped>
#app {
  max-width: 900px;
  margin: auto;
  padding: 1rem;
}

.menu-button {
  padding-top: 0.6rem !important;
  padding-bottom: 0.6rem !important;
  font-size: 1.1rem;
}

.top-user-bar {
  padding-top: 0.6rem !important;
  padding-bottom: 0.6rem !important;
}

@media (max-width: 512px) {
  body { font-size: 21px; }

  .menu-button {
    padding-top: 1.0rem !important;
    padding-bottom: 1.0rem !important;
    font-size: 1.0rem;
  }

  .top-user-bar {
    padding-top: 1.0rem !important;
    padding-bottom: 1.0rem !important;
  }
}
</style>
