<template>
  <main role="main" class="container py-3">

    <!-- ヘッダー -->
    <header class="sticky-top bg-white mb-2 py-2 border-bottom">
      <div class="d-flex justify-content-between align-items-center">
        <div class="text-center flex-grow-1" style="font-size:22px; font-weight:700;">
          <i class="fas fa-plane"></i> オフライン専用ページ
        </div>
        <div>
          <button class="btn btn-link p-0 text-center" @click="router.push({ name: 'login' })">
            <i class="fas fa-sign-in-alt fa-2x"></i>
            <div class="small">ログイン</div>
          </button>
        </div>
      </div>
    </header>

    <div v-if="offlineUserInfo" class="offline-user-info small text-muted mb-2">
      <i class="fas fa-user"></i>
      {{ offlineUserInfo.userName || "-" }}（UserID: {{ offlineUserInfo.userId ?? "-" }}）
      ／ グループ：{{ offlineUserInfo.userGroup || "-" }}
    </div>

    <div class="alert" :class="online ? 'alert-success' : 'alert-warning'">
      <i class="fas" :class="online ? 'fa-wifi' : 'fa-plane'"></i>
      <span v-if="online">
        ネット接続を確認しました。ログイン画面から通常どおりログインできます。
      </span>
      <span v-else>
        ネット接続がありません。この端末に保存済みの子カードのみ、ログインなしで閲覧・結果登録できます。
      </span>
    </div>

    <p class="text-muted small">
      「マイページ」の一覧画面で「オフラインで使用」を設定した子カードが、ここに表示されます。
    </p>

    <div class="row g-3">
      <div class="col-12 col-sm-6" v-for="child in offlineChilds" :key="child.CHILDID">
        <div class="card shadow-sm h-100" :style="{ borderLeft: `6px solid ${colorBg(child.COLOR)}` }">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-1">
              <h5 class="card-title mb-0">
                <span class="cardno-badge" :style="{ backgroundColor: colorBg(child.COLOR), borderColor: colorBg(child.COLOR) }">{{ child.CARDNO }}-{{ child.CHILDNO }}</span>
                {{ child.CHILDBLOCK }}
              </h5>
              <span class="badge rounded-pill offline-pill">
                <i class="fas fa-plane"></i> オフライン中
              </span>
            </div>

            <p class="mb-1 small text-muted">
              {{ child.CHILDHOUSES }}件 ／ 訪問済：{{ child.VISITED ?? 0 }}件
            </p>
            <p v-if="child.DESCRIPTION" class="mb-1 small">{{ child.DESCRIPTION }}</p>

            <div class="d-flex justify-content-between align-items-center mt-2">
              <small class="text-muted">
                貸出: {{ child.CHILDCHECKOUTDATE ?? "-" }} ／
                期限: {{ child.CHILDLIMITDATE ?? "-" }}
              </small>
              <button class="btn btn-sm btn-outline-primary" @click="openChildMap(child)">
                <i class="fas fa-map-marked-alt"></i> 開く
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="offlineChilds.length === 0" class="text-center text-muted mt-5">
      <i class="fas fa-inbox fa-3x mb-3"></i>
      <p>オフライン保存済みの子カードがありません</p>
      <p class="small">ネット接続時にマイページを開き、子カードの「オフラインで使用」を設定してください。</p>
    </div>

  </main>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { getOfflineChildRows, getOfflineUserInfo, useOnlineStatus } from "@/services/offline.js";

const router = useRouter();
const online = useOnlineStatus();

const offlineChilds  = ref([]);
const offlineUserInfo = ref(null);

function refresh() {
  offlineChilds.value  = getOfflineChildRows();
  offlineUserInfo.value = getOfflineUserInfo();
}

function openChildMap(child) {
  router.push({ name: "childMap", params: { cardNo: child.CARDNO, childNo: child.CHILDNO } });
}

// カードの色ラベル（赤/青/黄/緑/白/★）をCSS色に変換する（マイページ画面と同一の配色）
const COLOR_MAP = { 赤: "#ffb6c1", 青: "#87cefa", 黄: "#ffd700", 緑: "#00FF00", "★": "#00FF00" };
function colorBg(color) {
  return COLOR_MAP[color] || "#e0e0e0";
}

onMounted(refresh);
</script>

<style scoped>
.cardno-badge {
  border: 2px solid #007bff;
  border-radius: 8px;
  padding: 2px 8px;
  font-weight: bold;
  margin-right: 6px;
  font-size: 14px;
  color: #212529;
}

.offline-pill {
  background-color: #6f42c1;
  color: #fff;
  font-size: 12px;
}
</style>
