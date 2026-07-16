<template>
  <main role="main" class="container py-3">

    <!-- ヘッダー -->
    <header class="sticky-top bg-white mb-2 py-2 border-bottom">
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <button class="btn btn-link p-0 text-center" @click="router.push({ name: 'mainMenu' })">
            <i class="fas fa-arrow-circle-left fa-2x"></i>
            <div class="small">戻る</div>
          </button>
        </div>
        <div class="text-center flex-grow-1">
          <p class="mb-0">[ユーザー名]<br />{{ authStore.userName }}<br />({{ authStore.userGroup }})</p>
        </div>
        <div>
          <button class="btn btn-link p-0 text-center" @click="router.push({ name: 'mainMenu' })">
            <i class="fas fa-home fa-2x"></i>
            <div class="small">ホーム</div>
          </button>
        </div>
      </div>
    </header>

    <div class="text-center my-4">
      <h2><i class="fas fa-tools"></i> 設定</h2>
    </div>

    <div class="row">
      <div class="col-sm-2"></div>
      <div class="col-sm-8">
        <button class="btn alert-primary col-12 text-left mb-3" @click="router.push({ name: 'editCardList' })">
          <h5 class="mb-0"><i class="far fa-list-alt"></i> 区域カード情報の編集</h5>
        </button>
        <button class="btn alert-primary col-12 text-left mb-3" @click="router.push({ name: 'editChildList' })">
          <h5 class="mb-0"><i class="far fa-list-alt"></i> 子カード情報の編集</h5>
        </button>
        <button class="btn alert-primary col-12 text-left mb-3" @click="router.push({ name: 'settingsEditDetail' })">
          <h5 class="mb-0"><i class="fas fa-list-ol"></i> 住居リストの編集</h5>
        </button>
        <button class="btn alert-secondary col-12 text-left mb-3" @click="router.push({ name: 'importKibanCSV' })">
          <h5 class="mb-0"><i class="fas fa-file-csv"></i> 住居表示住所CSVインポート</h5>
        </button>
        <button class="btn alert-secondary col-12 text-left mb-3" @click="router.push({ name: 'editAnnouncementList' })">
          <h5 class="mb-0"><i class="far fa-newspaper"></i> お知らせの投稿</h5>
        </button>
      </div>
      <div class="col-sm-2"></div>
    </div>

  </main>
</template>

<script setup>
import { useRouter } from "vue-router";
import { useAuthStore } from "@/store/authStore.js";

const router    = useRouter();
const authStore = useAuthStore();
</script>
