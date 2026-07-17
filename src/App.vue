<template>
  <div>
    <!-- 認証状態ロード中はスピナーを表示 -->
    <div v-if="authStore.loading" class="d-flex justify-content-center align-items-center" style="height: 100vh">
      <div class="text-center">
        <div class="spinner-border text-primary" role="status"></div>
        <p class="mt-3">読み込み中...</p>
      </div>
    </div>

    <!-- ロード完了後はルーターアウトレットを表示 -->
    <router-view v-else />
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from "vue";
import { useAuthStore } from "@/store/authStore.js";

const authStore = useAuthStore();

// リロード／タブを閉じると再ログインが必要になる場合があるため、
// オンライン・オフラインを問わず常にブラウザ標準の確認ダイアログで警告する。
function confirmBeforeUnload(e) {
  e.preventDefault();
  e.returnValue = "";
}

onMounted(() => {
  window.addEventListener("beforeunload", confirmBeforeUnload);
});
onUnmounted(() => {
  window.removeEventListener("beforeunload", confirmBeforeUnload);
});
</script>
