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
import { watch } from "vue";
import { useAuthStore } from "@/store/authStore.js";
import { useOnlineStatus } from "@/services/offline.js";

const authStore = useAuthStore();

// オフライン中は、誤ってリロード／タブを閉じてしまうと画面がそのまま
// 使えなくなる恐れがあるため、ブラウザ標準の確認ダイアログで警告する。
function confirmBeforeUnload(e) {
  e.preventDefault();
  e.returnValue = "";
}

const online = useOnlineStatus();
watch(online, (isOnline) => {
  if (isOnline) {
    window.removeEventListener("beforeunload", confirmBeforeUnload);
  } else {
    window.addEventListener("beforeunload", confirmBeforeUnload);
  }
}, { immediate: true });
</script>
