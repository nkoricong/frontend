<template>
  <!-- ローディング -->
  <div v-if="loading" class="loading-overlay">
    <div class="text-center">
      <div class="spinner-border text-primary" style="width:3rem;height:3rem;" role="status"></div>
      <p class="mt-3">区域データを読み込み中...</p>
    </div>
  </div>

  <main class="container-fluid py-2">

    <!-- ヘッダー -->
    <header class="sticky-top bg-white mb-2 py-2 border-bottom">
      <div class="d-flex justify-content-between align-items-center px-2">
        <button class="btn btn-link p-0 text-center" @click="router.back()">
          <i class="fas fa-arrow-circle-left fa-2x"></i>
          <div class="small">戻る</div>
        </button>

        <div class="text-center flex-grow-1">
          <div style="font-size:18px;font-weight:700;">
            {{ childInfo?.ChildBlock ?? "区域カード" }}
            <span
              v-if="isOfflineCard"
              class="badge rounded-pill offline-pill ms-1"
              style="font-size:11px;cursor:pointer;"
              @click="showOfflineDialog = true"
            >
              <i class="fas fa-plane"></i> オフライン中
            </span>
          </div>
          <div class="small text-muted">
            {{ cardInfo?.CardNo }}-{{ childInfo?.ChildNo }}
            ／ {{ childInfo?.ChildHouses }}件
          </div>
        </div>

        <div class="d-flex align-items-center gap-2">
          <button class="btn btn-link p-0 text-center" @click="openShareDialog">
            <i class="fas fa-share-alt fa-2x"></i>
            <div class="small">共有</div>
          </button>
          <button class="btn btn-link p-0 text-center" @click="router.push({ name: 'mainMenu' })">
            <i class="fas fa-home fa-2x"></i>
            <div class="small">ホーム</div>
          </button>
        </div>
      </div>
    </header>

    <!-- オフラインキャッシュ利用中の案内 -->
    <div v-if="usingCachedData" class="alert alert-warning py-1 px-2 small mb-2 mx-2">
      <i class="fas fa-plane"></i> オフラインで保存したデータを表示しています
    </div>
    <div v-if="usingCachedData && cachedOfflineUser" class="small text-muted px-2 mb-2 text-start">
      <i class="fas fa-user"></i>
      {{ cachedOfflineUser.userName || "-" }}（UserID: {{ cachedOfflineUser.userId ?? "-" }}）
      ／ グループ：{{ cachedOfflineUser.userGroup || "-" }}
    </div>
    <div v-if="loadError" class="alert alert-danger m-2">{{ loadError }}</div>

    <!-- 地図（オフライン時は保存済みの静止画像を表示） -->
    <template v-if="!usingCachedData">
      <div class="d-flex justify-content-end px-2 mb-1">
        <button class="btn btn-sm btn-outline-secondary" @click="toggleMap">
          <i class="fas" :class="mapVisible ? 'fa-eye-slash' : 'fa-eye'"></i>
          {{ mapVisible ? "地図を隠す" : "地図を表示" }}
        </button>
      </div>
      <div id="mapContainer" ref="mapContainer" v-show="mapVisible"></div>
    </template>
    <div v-else-if="cachedMapImage" class="px-2 mb-2">
      <img :src="cachedMapImage" alt="保存済みの地図画像" class="img-fluid rounded border" />
    </div>

    <!-- 住戸一覧 -->
    <div class="mt-3 px-2">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <h6 class="mb-0">住戸一覧（{{ houses.length }}件）</h6>
        <select class="form-select form-select-sm w-auto" v-model="statusFilter">
          <option value="">全件</option>
          <option>未訪問</option>
          <option>不在</option>
          <option>済</option>
          <option>訪問不可</option>
        </select>
      </div>

      <!-- テーブル形式（PC） -->
      <div class="d-none d-md-block">
        <table class="table table-sm table-hover table-bordered align-middle">
          <thead class="table-light">
            <tr>
              <th class="col-id">#</th>
              <th class="col-name">氏名・建物</th>
              <th class="col-address">住所</th>
              <th class="col-status">ステータス</th>
              <th class="col-result">最新結果</th>
              <th class="col-history">履歴</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="h in filteredHouses"
              :key="h.DetailID"
              :class="{ 'table-warning': focusedHousing === h.HousingNo }"
              @click="focusHouse(h)"
              style="cursor:pointer"
            >
              <td class="text-center fw-bold">{{ h.HousingNo }}</td>
              <td>
                <div>{{ h.FamilyName }}</div>
                <div class="small text-muted">{{ h.BuildingName }} {{ h.RoomNo }}</div>
              </td>
              <td>
                <div class="small">{{ houseAddress(h) }}</div>
              </td>
              <td class="text-center">
                <span :class="statusPillClass(h.VisitStatus)">{{ h.VisitStatus || "未訪問" }}</span>
              </td>
              <td class="text-center small">
                {{ latestResult(h) }}
                <button class="btn btn-sm btn-outline-primary ms-1" @click.stop="openAddModal(h)">結果入力</button>
              </td>
              <td class="text-center">
                <button class="btn btn-sm btn-outline-secondary" @click.stop="openHistoryModal(h)">
                  <i class="fas fa-plus"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- カード形式（スマホ） -->
      <div class="d-md-none">
        <div
          v-for="h in filteredHouses"
          :key="h.DetailID"
          class="card card-house mb-2"
          :class="{ 'focused-house': focusedHousing === h.HousingNo }"
          @click="focusHouse(h)"
        >
          <div class="card-body py-2 px-3">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <span class="fw-bold me-2">#{{ h.HousingNo }}</span>
                {{ h.FamilyName }}
                <div class="small text-muted">{{ h.BuildingName }} {{ h.RoomNo }}</div>
              </div>
              <div class="d-flex align-items-center gap-2">
                <span :class="statusPillClass(h.VisitStatus)" style="font-size:14px;">
                  {{ h.VisitStatus || "未訪問" }}
                </span>
                <button class="btn btn-sm btn-outline-primary" @click.stop="openAddModal(h)">結果入力</button>
                <button class="btn btn-sm btn-outline-secondary" @click.stop="openHistoryModal(h)">
                  <i class="fas fa-plus"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </main>

  <!-- 訪問記録モーダル（結果入力=add / 履歴=history） -->
  <VisitModal
    v-model="showModal"
    :house="selectedHouse"
    :mode="modalMode"
    :child-id="childInfo?.ChildID"
    :offline-user="usingCachedData ? cachedOfflineUser : null"
    @saved="onRecordSaved"
    @deleted="onRecordDeleted"
  />

  <!-- 共有用QRコードダイアログ -->
  <div
    class="modal fade"
    :class="{ show: showShareModal }"
    :style="showShareModal ? 'display:block' : 'display:none'"
    tabindex="-1"
    role="dialog"
    @click.self="closeShareModal"
  >
    <div class="modal-dialog" role="document">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">子カードを共有</h5>
          <button type="button" class="btn-close" @click="closeShareModal"></button>
        </div>
        <div class="modal-body text-center">
          <p v-if="!shareError" class="small text-muted">
            このQRコードを共有相手に読み取ってもらってください（読み取りから3時間有効です）
          </p>
          <div v-if="shareLoading" class="py-4">
            <i class="fas fa-spinner fa-spin fa-2x"></i>
          </div>
          <img v-else-if="shareQrDataUrl" :src="shareQrDataUrl" alt="共有QRコード" class="img-fluid" />
          <p v-if="shareError" class="text-danger small mt-2">{{ shareError }}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeShareModal">閉じる</button>
        </div>
      </div>
    </div>
  </div>
  <div v-if="showShareModal" class="modal-backdrop fade show"></div>

  <!-- オフライン同期ダイアログ -->
  <OfflineSyncDialog
    v-model="showOfflineDialog"
    :child-id="childInfo?.ChildID"
    :card-no="cardInfo?.CardNo"
    :child-no="childInfo?.ChildNo"
    :child-block="childInfo?.ChildBlock"
    @released="handleOfflineReleased"
  />
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";
import { useRouter } from "vue-router";
import QRCode from "qrcode";
import { useAuthStore } from "@/store/authStore.js";
import { getChildDetail, getKmlUrl, createChildShare } from "@/services/api.js";
import { loadGoogleMaps, createMap, addMarker, addKmlLayer } from "@/services/maps.js";
import { isChildOffline, getOfflineChild, findOfflineEntryByCard, isOnline } from "@/services/offline.js";
import VisitModal from "@/components/VisitModal.vue";
import OfflineSyncDialog from "@/components/OfflineSyncDialog.vue";

const props = defineProps({
  cardNo:  { type: Number, required: true },
  childNo: { type: Number, required: true },
});

const router    = useRouter();
const authStore = useAuthStore();

const loading        = ref(true);
const cardInfo       = ref(null);
const childInfo      = ref(null);
const houses         = ref([]);
const statusFilter   = ref("");
const focusedHousing = ref(null);
const mapContainer   = ref(null);
const mapVisible     = ref(true);
const showModal      = ref(false);
const selectedHouse  = ref(null);
const modalMode      = ref("add"); // 'add' | 'history'

const showShareModal = ref(false);
const shareLoading   = ref(false);
const shareQrDataUrl = ref("");
const shareError     = ref("");

const usingCachedData  = ref(false);
const cachedMapImage   = ref("");
const cachedOfflineUser = ref(null);
const loadError        = ref("");
const showOfflineDialog = ref(false);
const offlineVersion    = ref(0);

const isOfflineCard = computed(() => {
  void offlineVersion.value;
  return childInfo.value?.ChildID ? isChildOffline(childInfo.value.ChildID) : false;
});

// オフラインモード解除後：キャッシュ表示中だった場合はネットワークから最新データを取り直す
async function handleOfflineReleased() {
  offlineVersion.value++;
  if (!usingCachedData.value) return;

  usingCachedData.value = false;
  loading.value = true;
  try {
    const res = await getChildDetail(props.cardNo, props.childNo);
    if (res.status === "success") {
      cardInfo.value  = res.cardInfo;
      childInfo.value = res.childInfo;
      houses.value    = res.houses;
    }
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
  await initMap();
}

let mapInstance = null;
let kmlLayer    = null;
const markers   = [];

// フィルタ済み住戸
const filteredHouses = computed(() => {
  if (!statusFilter.value) return houses.value;
  return houses.value.filter(h => (h.VisitStatus || "未訪問") === statusFilter.value);
});

// ステータスの pill スタイル
function statusPillClass(status) {
  const map = {
    "済":      "badge bg-success",
    "不在":    "badge bg-warning text-dark",
    "訪問不可": "badge bg-danger",
    "未訪問":  "badge bg-secondary",
  };
  return map[status] || "badge bg-light text-dark";
}

// 最新の訪問結果を返す
function latestResult(h) {
  if (!h.VRecord || h.VRecord.length === 0) return "-";
  const sorted = [...h.VRecord].sort((a, b) =>
    b.VisitDate?.localeCompare(a.VisitDate) ?? 0
  );
  return sorted[0]?.Result || "-";
}

// 住戸フォーカス（地図マーカーへスクロール）
function focusHouse(h) {
  focusedHousing.value = h.HousingNo;
  if (mapInstance && h.CSVLat && h.CSVLng) {
    mapInstance.panTo({ lat: h.CSVLat, lng: h.CSVLng });
    mapInstance.setZoom(18);
  }
}

// 「結果入力」：訪問記録の追加専用モーダルを開く
function openAddModal(h) {
  selectedHouse.value = h;
  modalMode.value     = "add";
  showModal.value     = true;
}

// 「履歴」：訪問履歴専用モーダルを開く
function openHistoryModal(h) {
  selectedHouse.value = h;
  modalMode.value     = "history";
  showModal.value     = true;
}

// 子カードの一時共有：ワンタイムURLを発行し、QRコード化してダイアログに表示する
async function openShareDialog() {
  shareError.value     = "";
  shareQrDataUrl.value = "";
  shareLoading.value   = true;
  showShareModal.value = true;
  try {
    const res = await createChildShare(childInfo.value.ChildID);
    if (res.status === "success") {
      const shareUrl = `${window.location.origin}${window.location.pathname}#/mypage?share=${res.token}`;
      shareQrDataUrl.value = await QRCode.toDataURL(shareUrl, { width: 240, margin: 1 });
    } else {
      shareError.value = res.message || "共有用URLの生成に失敗しました";
    }
  } catch (e) {
    shareError.value = e.message;
  } finally {
    shareLoading.value = false;
  }
}

function closeShareModal() {
  showShareModal.value = false;
}

// 地図の表示/非表示を切り替える（再表示時はタイル再描画のためresizeイベントを発火）
function toggleMap() {
  mapVisible.value = !mapVisible.value;
  if (mapVisible.value && mapInstance) {
    nextTick(() => {
      google.maps.event.trigger(mapInstance, "resize");
      mapInstance.setCenter(mapInstance.getCenter());
    });
  }
}

// 住所欄：address_sw に応じてCSV由来／手入力のどちらかを結合して表示する
// （ORIGINAL/EditDetailList.html の execGeoCode と同じ組み立てルール）
function houseAddress(h) {
  if (h.AddressSW === "直接入力") {
    return `${h.InputTownName ?? ""}${h.InputCho ?? ""}-${h.InputBanchi ?? ""}`;
  }
  return `${h.CSVTownName ?? ""}${h.CSVCho ?? ""}-${h.CSVBanchi ?? ""}`;
}

// 保存後：該当住戸の VisitStatus を更新
// オフライン保存時は VisitModal 側で house.VRecord を直接更新済みのため、
// ネットワーク経由の再取得（reloadHouse）は行わない
function onRecordSaved({ house, visitStatus, offline }) {
  const target = houses.value.find(h => h.HousingNo === house.HousingNo);
  if (target) {
    target.VisitStatus = visitStatus;
    if (!offline) reloadHouse(house);
  }
}

function onRecordDeleted({ house, visitStatus, offline }) {
  onRecordSaved({ house, visitStatus, offline });
}

async function reloadHouse(house) {
  // 簡易的に全データを再取得（より細かい更新は拡張で対応）
  try {
    const res = await getChildDetail(house.CardNo, house.ChildNo);
    if (res.status === "success") {
      houses.value = res.houses;
    }
  } catch (e) {
    console.error(e);
  }
}

// 地図初期化
async function initMap() {
  try {
    await loadGoogleMaps();

    const center = {
      lat: childInfo.value?.ChildLat ? Number(childInfo.value.ChildLat) : 35.6812,
      lng: childInfo.value?.ChildLng ? Number(childInfo.value.ChildLng) : 139.7671,
    };

    mapInstance = createMap(mapContainer.value, center, 15);

    // KML オーバーレイ（区域全体のKMLを、この子カード番号で絞り込んで表示）
    if (cardInfo.value?.KML) {
      kmlLayer = addKmlLayer(mapInstance, getKmlUrl(cardInfo.value.KML, props.childNo));
    }

    // 住戸マーカー
    for (const h of houses.value) {
      if (h.CSVLat && h.CSVLng) {
        const marker = addMarker(
          mapInstance,
          { lat: Number(h.CSVLat), lng: Number(h.CSVLng) },
          `#${h.HousingNo} ${h.FamilyName}`
        );
        markers.push(marker);
      }
    }
  } catch (e) {
    console.error("地図初期化エラー:", e);
  }
}

onMounted(async () => {
  try {
    if (!isOnline()) throw new Error("offline");
    const res = await getChildDetail(props.cardNo, props.childNo);
    if (res.status === "success") {
      cardInfo.value  = res.cardInfo;
      childInfo.value = res.childInfo;
      houses.value    = res.houses;
    } else {
      throw new Error(res.message || "取得に失敗しました");
    }
  } catch (e) {
    // ネットワーク不可／取得失敗時は、オフライン保存済みのキャッシュがあればそちらを使う
    const entry  = findOfflineEntryByCard(props.cardNo, props.childNo);
    const cached = entry ? getOfflineChild(entry.childId) : null;
    if (cached) {
      cardInfo.value        = cached.cardInfo;
      childInfo.value       = cached.childInfo;
      houses.value          = cached.houses;
      cachedMapImage.value  = cached.mapImage || "";
      cachedOfflineUser.value = cached.offlineUser || null;
      usingCachedData.value = true;
    } else {
      loadError.value = "データを取得できませんでした。ネットワーク接続を確認してください。";
      console.error(e);
    }
  } finally {
    loading.value = false;
  }

  if (!usingCachedData.value) {
    await initMap();
  }
});

onUnmounted(() => {
  if (kmlLayer) kmlLayer.setMap(null);
  markers.forEach(m => { if (m.map) m.map = null; });
});
</script>

<style scoped>
.loading-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(255,255,255,0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

#mapContainer {
  width: 100%;
  height: 360px;
}

@media (max-width: 768px) {
  #mapContainer { height: 260px; }
}

.card-house {
  margin-bottom: 0.4rem;
  transition: background-color 0.3s ease;
  cursor: pointer;
}

.focused-house {
  background-color: #fff8d6 !important;
}

.col-id      { width: 48px;  text-align: center; }
.col-name    { width: 180px; }
.col-address { min-width: 100px; }
.col-status  { width: 110px; text-align: center; }
.col-result  { width: 100px; text-align: center; }
.col-history { width: 60px;  text-align: center; }

.offline-pill {
  background-color: #6f42c1;
  color: #fff;
  vertical-align: middle;
}
</style>
