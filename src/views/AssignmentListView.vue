<template>
  <!-- ローディング -->
  <div v-if="loading" class="loading">
    <i class="fas fa-spinner fa-4x fa-spin"></i>
  </div>

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
        <div class="text-center flex-grow-1" style="font-size:22px; font-weight:700;">マイページ</div>
        <div>
          <button class="btn btn-link p-0 text-center" @click="router.push({ name: 'mainMenu' })">
            <i class="fas fa-home fa-2x"></i>
            <div class="small">ホーム</div>
          </button>
        </div>
      </div>
    </header>

    <!-- ユーザー情報 -->
    <div class="alert alert-secondary py-2 mb-3">
      <strong>{{ authStore.userName }}</strong>（{{ authStore.userEmail }}）
      ／ グループ：{{ authStore.userGroup }} ／ 権限：{{ authStore.userRole }}
    </div>

    <!-- オフラインキャッシュ利用中の案内 -->
    <div v-if="usingOfflineData" class="alert alert-warning py-2 px-2 small mb-3">
      <i class="fas fa-plane"></i>
      オフラインで保存したデータを表示しています。一覧の更新・返却・共有・QRコード読取はネット接続時のみ利用できます。
    </div>

    <!-- 絞込 + 並替 + QRコード読取 + 更新ボタン -->
    <div class="d-flex flex-wrap justify-content-between align-items-center mb-2 gap-2">
      <div class="d-flex flex-wrap gap-2">
        <button class="btn btn-outline-secondary" @click="showFilterPanel = !showFilterPanel">
          <i class="fas fa-filter"></i> 絞込
        </button>
        <button class="btn btn-outline-secondary" @click="showSortPanel = !showSortPanel">
          <i class="fas fa-sort"></i> 並替
        </button>
        <button v-if="!usingOfflineData" class="btn btn-outline-secondary" @click="openScanDialog">
          <i class="fas fa-qrcode"></i> QRコード読取
        </button>
      </div>
      <button class="btn btn-primary" @click="refresh" :disabled="isUpdating">
        <i class="fas fa-sync-alt"></i> 最新情報に更新
      </button>
    </div>

    <!-- 絞込パネル -->
    <div v-if="showFilterPanel" class="card card-body shadow-sm mb-3">
      <div class="row g-3">
        <div class="col-12">
          <label class="form-label small mb-1">状態</label>
          <div class="d-flex flex-wrap">
            <div class="form-check form-check-inline">
              <input class="form-check-input" type="radio" id="filter-all" value="all" v-model="filterMode">
              <label class="form-check-label" for="filter-all">全件表示</label>
            </div>
            <div class="form-check form-check-inline">
              <input class="form-check-input" type="radio" id="filter-lent" value="lent" v-model="filterMode">
              <label class="form-check-label" for="filter-lent">貸出中のみ</label>
            </div>
            <div class="form-check form-check-inline">
              <input class="form-check-input" type="radio" id="filter-focus" value="focus" v-model="filterMode">
              <label class="form-check-label" for="filter-focus">重点のみ</label>
            </div>
            <div class="form-check form-check-inline">
              <input class="form-check-input" type="radio" id="filter-nonfocus" value="nonfocus" v-model="filterMode">
              <label class="form-check-label" for="filter-nonfocus">重点以外</label>
            </div>
          </div>
        </div>
        <div class="col-6 col-sm-4">
          <label class="form-label small mb-1">エリア</label>
          <select class="form-select form-select-sm" v-model="filterArea">
            <option value="">すべて</option>
            <option v-for="a in areaOptions" :key="a" :value="a">{{ a }}</option>
          </select>
        </div>
        <div class="col-6 col-sm-4">
          <label class="form-label small mb-1">カードの色</label>
          <select class="form-select form-select-sm" v-model="filterColor">
            <option value="">すべて</option>
            <option v-for="c in colorOptions" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div class="col-12 col-sm-4 d-flex align-items-end">
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="filter-remaining10" v-model="filterRemaining10">
            <label class="form-check-label" for="filter-remaining10">残件数10件以上のみ</label>
          </div>
        </div>
      </div>
    </div>

    <!-- 並替パネル -->
    <div v-if="showSortPanel" class="card card-body shadow-sm mb-3">
      <div class="row g-3">
        <div class="col-8 col-sm-6">
          <label class="form-label small mb-1">並び替え項目</label>
          <select class="form-select form-select-sm" v-model="sortKey">
            <option value="">指定なし</option>
            <option value="area">エリア</option>
            <option value="color">カードの色</option>
            <option value="cardNo">カード番号</option>
            <option value="remaining">残件数</option>
            <option value="checkoutDate">貸出日</option>
            <option value="startDate">使用開始日</option>
            <option value="limitDate">使用期限日</option>
          </select>
        </div>
        <div class="col-4 col-sm-6">
          <label class="form-label small mb-1">順序</label>
          <div class="d-flex">
            <div class="form-check form-check-inline">
              <input class="form-check-input" type="radio" id="sort-asc" value="asc" v-model="sortOrder">
              <label class="form-check-label" for="sort-asc">昇順</label>
            </div>
            <div class="form-check form-check-inline">
              <input class="form-check-input" type="radio" id="sort-desc" value="desc" v-model="sortOrder">
              <label class="form-check-label" for="sort-desc">降順</label>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- カード一覧 -->
    <div class="row g-3">
      <div
        class="col-12 col-sm-6"
        v-for="child in filteredChilds"
        :key="child.CHILDID"
      >
        <div
          class="card shadow-sm h-100"
          :style="{ borderLeft: `6px solid ${child.COLOR || '#ccc'}` }"
        >
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-1">
              <h5 class="card-title mb-0">
                <span class="cardno-badge">{{ child.CARDNO }}-{{ child.CHILDNO }}</span>
                {{ child.CHILDBLOCK }}
              </h5>
              <div class="d-flex flex-column align-items-end gap-1">
                <span
                  class="badge rounded-pill"
                  :class="{ 'pill-clickable': child.CHILDSTATUS === '返却済' && !child.SHARED }"
                  :style="statusPillStyle(child.CHILDSTATUS)"
                  @click="child.CHILDSTATUS === '返却済' && !child.SHARED && cancelReturn(child)"
                >
                  {{ child.CHILDSTATUS }}
                </span>
                <span
                  v-if="isOfflineChild(child)"
                  class="badge rounded-pill offline-pill pill-clickable"
                  @click="openOfflineDialog(child)"
                >
                  <i class="fas fa-plane"></i> オフライン中
                </span>
              </div>
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
              <div class="d-flex flex-wrap gap-2 justify-content-end">
                <button
                  v-if="!usingOfflineData && !child.SHARED"
                  class="btn btn-sm btn-outline-danger"
                  @click="returnCard(child)"
                >
                  <i class="fas fa-undo"></i> 返却
                </button>
                <button
                  v-else-if="!usingOfflineData"
                  class="btn btn-sm btn-outline-warning"
                  @click="endShare(child)"
                >
                  <i class="fas fa-share-alt"></i> 共有終了
                </button>
                <button
                  v-if="!usingOfflineData && !isOfflineChild(child)"
                  class="btn btn-sm btn-outline-secondary"
                  @click="enableOffline(child)"
                >
                  <i class="fas fa-cloud-download-alt"></i> オフラインで使用
                </button>
                <button
                  class="btn btn-sm btn-outline-primary"
                  @click="openChildMap(child)"
                >
                  <i class="fas fa-map-marked-alt"></i> 開く
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="filteredChilds.length === 0 && !loading" class="text-center text-muted mt-5">
      <i class="fas fa-inbox fa-3x mb-3"></i>
      <p>表示するカードがありません</p>
    </div>

  </main>

  <!-- QRコード読取ダイアログ -->
  <div
    class="modal fade"
    :class="{ show: showScanModal }"
    :style="showScanModal ? 'display:block' : 'display:none'"
    tabindex="-1"
    role="dialog"
    @click.self="closeScanModal"
  >
    <div class="modal-dialog" role="document">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">QRコード読取</h5>
          <button type="button" class="btn-close" @click="closeScanModal"></button>
        </div>
        <div class="modal-body text-center">
          <video ref="scanVideo" class="w-100" playsinline muted></video>
          <p v-if="scanError" class="text-danger small mt-2">{{ scanError }}</p>
          <p v-else class="small text-muted mt-2">共有元のQRコードを画面内に写してください</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeScanModal">閉じる</button>
        </div>
      </div>
    </div>
  </div>
  <div v-if="showScanModal" class="modal-backdrop fade show"></div>

  <!-- オフライン同期ダイアログ -->
  <OfflineSyncDialog
    v-model="showOfflineDialog"
    :child-id="offlineDialogChild?.CHILDID"
    :card-no="offlineDialogChild?.CARDNO"
    :child-no="offlineDialogChild?.CHILDNO"
    :child-block="offlineDialogChild?.CHILDBLOCK"
    @released="handleOfflineReleased"
  />
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";
import { useRouter, useRoute } from "vue-router";
import jsQR from "jsqr";
import { useAuthStore } from "@/store/authStore.js";
import {
  getFilteredChildCardbyUser, returnChildCard, cancelChildReturn,
  claimChildShare, endChildShare, getChildDetail,
} from "@/services/api.js";
import { isChildOffline, saveOfflineChild, isOnline, getOfflineChildRows } from "@/services/offline.js";
import OfflineSyncDialog from "@/components/OfflineSyncDialog.vue";

const router    = useRouter();
const route     = useRoute();
const authStore = useAuthStore();

const childs     = ref([]);
const filterMode = ref("all");
const loading    = ref(false);
const isUpdating = ref(false);
const usingOfflineData = ref(false);

// 絞込パネル
const showFilterPanel   = ref(false);
const filterArea        = ref("");
const filterColor       = ref("");
const filterRemaining10 = ref(false);

// 並替パネル
const showSortPanel = ref(false);
const sortKey        = ref("");
const sortOrder      = ref("asc");

const areaOptions  = computed(() => [...new Set(childs.value.map(c => c.AREA).filter(Boolean))].sort());
const colorOptions = computed(() => [...new Set(childs.value.map(c => c.COLOR).filter(Boolean))].sort());

function remainingOf(child) {
  return (child.CHILDHOUSES ?? 0) - (child.VISITED ?? 0);
}

const SORT_FIELDS = {
  area:         c => c.AREA ?? "",
  color:        c => c.COLOR ?? "",
  cardNo:       c => Number(c.CARDNO) * 1000 + Number(c.CHILDNO ?? 0),
  remaining:    c => remainingOf(c),
  checkoutDate: c => c.CHILDCHECKOUTDATE ?? "",
  startDate:    c => c.CHILDSTARTDATE ?? "",
  limitDate:    c => c.CHILDLIMITDATE ?? "",
};

// フィルタ・並替済み一覧
const filteredChilds = computed(() => {
  let list = childs.value;

  if (filterMode.value === "lent")     list = list.filter(c => c.CHILDSTATUS === "貸出中");
  if (filterMode.value === "focus")    list = list.filter(c => c.CHILDSTATUS === "重点");
  if (filterMode.value === "nonfocus") list = list.filter(c => c.CHILDSTATUS !== "重点");

  if (filterArea.value)  list = list.filter(c => c.AREA === filterArea.value);
  if (filterColor.value) list = list.filter(c => c.COLOR === filterColor.value);
  if (filterRemaining10.value) list = list.filter(c => remainingOf(c) >= 10);

  if (sortKey.value) {
    const getter = SORT_FIELDS[sortKey.value];
    const dir    = sortOrder.value === "desc" ? -1 : 1;
    list = [...list].sort((a, b) => {
      const va = getter(a);
      const vb = getter(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return  1 * dir;
      return 0;
    });
  }

  return list;
});

async function fetchData() {
  loading.value = true;
  try {
    if (!isOnline()) throw new Error("offline");
    const res = await getFilteredChildCardbyUser();
    if (res.status === "success") {
      childs.value = res.cards || [];
      usingOfflineData.value = false;
    } else {
      throw new Error(res.message || "取得に失敗しました");
    }
  } catch (e) {
    // ネットワーク不可／取得失敗時は、オフライン保存済みの子カードがあればそちらを一覧表示する
    const offlineRows = getOfflineChildRows();
    if (offlineRows.length > 0) {
      childs.value = offlineRows;
      usingOfflineData.value = true;
    } else {
      usingOfflineData.value = false;
      console.error(e);
    }
  } finally {
    loading.value = false;
  }
}

async function refresh() {
  isUpdating.value = true;
  await fetchData();
  isUpdating.value = false;
}

function openChildMap(child) {
  router.push({
    name:   "childMap",
    params: { cardNo: child.CARDNO, childNo: child.CHILDNO },
  });
}

// 返却
async function returnCard(child) {
  if (!confirm(`${child.CARDNO}-${child.CHILDNO} ${child.CHILDBLOCK}を返却します。よろしいですか？`)) return;
  try {
    const res = await returnChildCard(child.CHILDID);
    if (res.status === "success") {
      const idx = childs.value.findIndex(c => c.CHILDID === child.CHILDID);
      if (idx !== -1) {
        childs.value[idx].CHILDSTATUS       = res.child?.CHILDSTATUS ?? "返却済";
        childs.value[idx].CHILDCHECKOUTDATE = res.child?.CHILDCHECKOUTDATE ?? childs.value[idx].CHILDCHECKOUTDATE;
      }
    } else {
      alert(res.message || "返却に失敗しました");
    }
  } catch (e) {
    alert(e.message);
  }
}

// 返却取消（返却済ピルのクリック）
async function cancelReturn(child) {
  if (!confirm(`返却済みの${child.CARDNO}-${child.CHILDNO} ${child.CHILDBLOCK}の返却操作を取り消します。よろしいですか？`)) return;
  try {
    const res = await cancelChildReturn(child.CHILDID);
    if (res.status === "success") {
      const idx = childs.value.findIndex(c => c.CHILDID === child.CHILDID);
      if (idx !== -1) childs.value[idx].CHILDSTATUS = res.child?.CHILDSTATUS ?? "貸出中";
    } else {
      alert(res.message || "返却取消に失敗しました");
    }
  } catch (e) {
    alert(e.message);
  }
}

// 共有終了
async function endShare(child) {
  if (!confirm(`共有された${child.CARDNO}-${child.CHILDNO} ${child.CHILDBLOCK}の共有を終了します。よろしいですか？`)) return;
  try {
    const res = await endChildShare(child.SHAREID);
    if (res.status === "success") {
      childs.value = childs.value.filter(c => c.CHILDID !== child.CHILDID || !c.SHARED);
    } else {
      alert(res.message || "共有終了に失敗しました");
    }
  } catch (e) {
    alert(e.message);
  }
}

// ---- QRコード読取（共有の受け取り） ----
const showScanModal = ref(false);
const scanVideo      = ref(null);
const scanError      = ref("");
let scanStream = null;
let scanRAF    = null;
const scanCanvas = document.createElement("canvas");

async function openScanDialog() {
  scanError.value      = "";
  showScanModal.value  = true;
  await nextTick();
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    scanVideo.value.srcObject = scanStream;
    await scanVideo.value.play();
    scanRAF = requestAnimationFrame(scanFrame);
  } catch (e) {
    scanError.value = "カメラを起動できませんでした：" + e.message;
  }
}

function scanFrame() {
  if (!showScanModal.value || !scanVideo.value) return;
  const video = scanVideo.value;
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    scanCanvas.width  = video.videoWidth;
    scanCanvas.height = video.videoHeight;
    const ctx = scanCanvas.getContext("2d");
    ctx.drawImage(video, 0, 0, scanCanvas.width, scanCanvas.height);
    const imageData = ctx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code?.data) {
      const text = code.data;
      closeScanModal();
      handleScanResult(text);
      return;
    }
  }
  scanRAF = requestAnimationFrame(scanFrame);
}

function closeScanModal() {
  showScanModal.value = false;
  if (scanRAF) cancelAnimationFrame(scanRAF);
  scanRAF = null;
  if (scanStream) {
    scanStream.getTracks().forEach(t => t.stop());
    scanStream = null;
  }
}

function extractShareToken(text) {
  try {
    const url = new URL(text);
    const query = url.hash.includes("?") ? url.hash.split("?")[1] : url.search.replace(/^\?/, "");
    return new URLSearchParams(query).get("share");
  } catch {
    return text || null; // 生のトークン文字列がそのまま読み取られた場合
  }
}

async function handleScanResult(text) {
  const token = extractShareToken(text);
  if (!token) {
    alert("有効な共有QRコードではありません");
    return;
  }
  await claimShare(token);
}

async function claimShare(token) {
  try {
    const res = await claimChildShare(token);
    if (res.status === "success") {
      alert("子カードの共有を受け取りました");
      await fetchData();
    } else {
      alert(res.message || "共有の受け取りに失敗しました");
    }
  } catch (e) {
    alert(e.message);
  }
}

// ---- オフラインで使用 ----
const offlineVersion    = ref(0); // isOfflineChild()の再評価をVueに気づかせるための依存
const showOfflineDialog = ref(false);
const offlineDialogChild = ref(null);

function isOfflineChild(child) {
  void offlineVersion.value;
  return isChildOffline(child.CHILDID);
}

async function enableOffline(child) {
  if (!confirm("オフラインでも区域カードを使用できるようにしますか。")) return;
  try {
    const res = await getChildDetail(child.CARDNO, child.CHILDNO);
    if (res.status !== "success") {
      alert("データの取得に失敗しました");
      return;
    }
    await saveOfflineChild(child.CHILDID, child.CARDNO, child.CHILDNO, {
      cardInfo:  res.cardInfo,
      childInfo: res.childInfo,
      houses:    res.houses,
    });
    offlineVersion.value++;
  } catch (e) {
    alert(e.message);
  }
}

function openOfflineDialog(child) {
  offlineDialogChild.value = child;
  showOfflineDialog.value  = true;
}

function handleOfflineReleased() {
  offlineVersion.value++;
}

// オリジナル版のBootstrap4配色をhex直指定で踏襲（区域リスト画面と同一）
const STATUS_COLORS = {
  "貸出中": { bg: "#ffc107", color: "#212529" },
  "返却済": { bg: "#17a2b8", color: "#fff" },
  "整備中": { bg: "#6c757d", color: "#fff" },
  "完了":   { bg: "#28a745", color: "#fff" },
  "重点":   { bg: "#dc3545", color: "#fff" },
};

function statusPillStyle(status) {
  const c = STATUS_COLORS[status] || STATUS_COLORS["整備中"];
  return { backgroundColor: c.bg, color: c.color };
}

onMounted(async () => {
  await fetchData();

  // 共有用URLを直接開いた場合（URLの share パラメータ）は自動で受け取り処理を行う
  const shareToken = route.query.share;
  if (shareToken) {
    router.replace({ query: {} });
    await claimShare(String(shareToken));
  }
});

onUnmounted(() => {
  closeScanModal();
});
</script>

<style scoped>
.loading {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(255,255,255,0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.cardno-badge {
  border: 2px solid #007bff;
  border-radius: 8px;
  padding: 2px 8px;
  font-weight: bold;
  margin-right: 6px;
  font-size: 14px;
}

.pill-clickable {
  cursor: pointer;
}

.offline-pill {
  background-color: #6f42c1;
  color: #fff;
  font-size: 12px;
}
</style>
