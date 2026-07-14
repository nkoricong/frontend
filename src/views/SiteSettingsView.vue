<template>
  <main role="main" class="container py-3">

    <!-- ヘッダー -->
    <header class="sticky-top bg-white mb-2 py-2 border-bottom">
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <button class="btn btn-link p-0 text-center" @click="router.push({ name: 'admins' })">
            <i class="fas fa-arrow-circle-left fa-2x"></i>
            <div class="small">戻る</div>
          </button>
        </div>
        <div class="text-center flex-grow-1" style="font-size:22px; font-weight:700;">サイト設定</div>
        <div>
          <button class="btn btn-link p-0 text-center" @click="router.push({ name: 'mainMenu' })">
            <i class="fas fa-home fa-2x"></i>
            <div class="small">ホーム</div>
          </button>
        </div>
      </div>
    </header>

    <div v-if="!authorized" class="alert alert-danger mt-3">このページを表示する権限がありません。</div>

    <div v-else class="row mt-3">
      <div class="col-sm-2"></div>
      <div class="col-sm-8">
        <div class="card shadow-sm">
          <div class="card-body">
            <h5 class="card-title">ログイン画面のアクセスコード</h5>
            <p class="text-muted small">
              ログイン画面を開いたとき、全ユーザーの氏名やメールアドレスの一覧が
              誰にでも見えてしまわないよう、最初にこのコードの入力を求めます。
            </p>

            <div v-if="loading" class="text-center text-muted py-3">
              <i class="fas fa-spinner fa-spin"></i> 読み込み中...
            </div>

            <template v-else>
              <label class="form-label">現在のコード</label>
              <input type="text" class="form-control mb-3" :value="currentCode" disabled />

              <label class="form-label">新しいコード（半角数字）</label>
              <input
                type="text"
                class="form-control"
                v-model="newCode"
                inputmode="numeric"
                placeholder="半角数字を入力"
              />

              <p v-if="message" class="small mt-2" :class="isError ? 'text-danger' : 'text-success'">{{ message }}</p>

              <button class="btn btn-primary mt-3" @click="save" :disabled="saving">
                {{ saving ? "保存中..." : "変更する" }}
              </button>
            </template>
          </div>
        </div>
      </div>
      <div class="col-sm-2"></div>
    </div>

  </main>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/store/authStore.js";
import { getSiteAccessCode, updateSiteAccessCode } from "@/services/api.js";

const router    = useRouter();
const authStore = useAuthStore();

const authorized = computed(() => authStore.userRole >= 9001);

const loading     = ref(false);
const saving      = ref(false);
const currentCode = ref("");
const newCode     = ref("");
const message     = ref("");
const isError     = ref(false);

async function fetchCode() {
  loading.value = true;
  try {
    const res = await getSiteAccessCode();
    if (res.status === "success") {
      currentCode.value = res.code;
      newCode.value     = res.code;
    } else {
      message.value = res.message || "取得に失敗しました";
      isError.value = true;
    }
  } catch (e) {
    message.value = e.message;
    isError.value = true;
  } finally {
    loading.value = false;
  }
}

async function save() {
  message.value = "";
  isError.value = false;

  if (!/^[0-9]+$/.test(newCode.value)) {
    message.value = "半角数字のみ入力してください";
    isError.value = true;
    return;
  }

  saving.value = true;
  try {
    const res = await updateSiteAccessCode(newCode.value);
    if (res.status === "success") {
      currentCode.value = res.code;
      message.value     = "アクセスコードを変更しました";
      isError.value      = false;
    } else {
      message.value = res.message || "変更に失敗しました";
      isError.value = true;
    }
  } catch (e) {
    message.value = e.message;
    isError.value = true;
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  if (authorized.value) fetchCode();
});
</script>
