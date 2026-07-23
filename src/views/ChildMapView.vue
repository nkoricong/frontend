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
    <header class="sticky-top bg-white mb-2 py-2 border-bottom no-print" ref="headerEl">
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
          <button class="btn btn-link p-0 text-center" :disabled="printLoading" @click="printChildCard">
            <i class="fas fa-print fa-2x"></i>
            <div class="small">印刷/PDF</div>
          </button>
          <button class="btn btn-link p-0 text-center" @click="router.push({ name: 'mainMenu' })">
            <i class="fas fa-home fa-2x"></i>
            <div class="small">ホーム</div>
          </button>
        </div>
      </div>
    </header>

    <!-- オフラインキャッシュ利用中の案内 -->
    <div v-if="usingCachedData" class="alert alert-warning py-1 px-2 small mb-2 mx-2 no-print">
      <i class="fas fa-plane"></i> オフラインで保存したデータを表示しています
    </div>
    <div v-if="usingCachedData && cachedOfflineUser" class="small text-muted px-2 mb-2 text-start no-print">
      <i class="fas fa-user"></i>
      {{ cachedOfflineUser.userName || "-" }}（UserID: {{ cachedOfflineUser.userId ?? "-" }}）
      ／ グループ：{{ cachedOfflineUser.userGroup || "-" }}
    </div>
    <div v-if="loadError" class="alert alert-danger m-2 no-print">{{ loadError }}</div>

    <!-- 印刷／PDF出力専用：ヘッダー＋貸出情報＋QRコード（画面には表示しない、#30/#33） -->
    <!-- 添付の「子カード印刷サンプル.pptx」のレイアウトを再現する -->
    <div class="print-only print-header-bar">
      <span class="print-status-badge">{{ cardInfo?.CardNo ?? "-" }}-{{ childInfo?.ChildNo ?? "-" }}</span>
      <span class="print-header-title">【{{ childInfo?.ChildStatus ?? "-" }}】{{ childInfo?.ChildBlock ?? "-" }}</span>
    </div>
    <div class="print-only print-meta-panel">
      <div class="print-meta-grid">
        <div class="print-meta-cell">
          <div class="print-meta-label">使用開始日</div>
          <div class="print-meta-value">{{ childInfo?.ChildStartDate ?? "-" }}</div>
        </div>
        <div class="print-meta-cell">
          <div class="print-meta-label">割当グループ</div>
          <div class="print-meta-value">{{ childInfo?.ChildGroup ?? "-" }}</div>
        </div>
        <div class="print-meta-cell">
          <div class="print-meta-label">使用期限</div>
          <div class="print-meta-value">{{ childInfo?.ChildLimitDate ?? "-" }}</div>
        </div>
        <div class="print-meta-cell">
          <div class="print-meta-label">割当奉仕者</div>
          <div class="print-meta-value">{{ childInfo?.ChildMinister ?? "-" }}</div>
        </div>
      </div>
      <img v-if="printQrDataUrl" :src="printQrDataUrl" alt="共有QRコード" class="print-qr" />
    </div>

    <!-- 地図（オフライン時は保存済みの静止画像を表示） -->
    <!-- 住戸一覧をスクロールしても地図が隠れないよう、ヘッダー直下に固定表示する -->
    <template v-if="!usingCachedData">
      <div class="map-sticky-wrapper" :style="{ top: headerHeight + 'px' }">
        <div class="d-flex justify-content-end gap-2 px-2 mb-1 no-print">
          <button class="btn btn-sm btn-outline-secondary" @click="toggleGestureMode">
            <i class="fas fa-hand-pointer"></i>
            {{ gestureMode === "greedy" ? "指2本で操作" : "指1本で操作" }}
          </button>
          <button class="btn btn-sm btn-outline-secondary" @click="toggleMap">
            <i class="fas" :class="mapVisible ? 'fa-eye-slash' : 'fa-eye'"></i>
            {{ mapVisible ? "地図を隠す" : "地図を表示" }}
          </button>
        </div>
        <div id="mapContainer" ref="mapContainer" v-show="mapVisible"></div>
      </div>
    </template>
    <div v-else-if="cachedMapImage" class="px-2 mb-2 no-print">
      <img :src="cachedMapImage" alt="保存済みの地図画像" class="img-fluid rounded border" />
    </div>

    <!-- 印刷／PDF出力専用：訪問リスト見出し＋住戸リスト（画面には表示しない、#30/#33） -->
    <div class="print-only print-section-header">
      <span class="print-section-tick"></span>
      <span class="print-section-title">訪問リスト</span>
      <span class="print-section-sub">住所はすべて {{ cardInfo?.TownName ?? "-" }}</span>
    </div>
    <table class="print-only print-house-table">
      <thead>
        <tr>
          <th class="col-no">NO</th>
          <th class="col-name">氏名</th>
          <th class="col-banchi">番地</th>
          <th class="col-status">訪問状況</th>
          <th class="col-date-latest">最新訪問日</th>
          <th class="col-date-met">最後に会えた日</th>
          <th class="col-note">ノート</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="h in printHouses" :key="'p-' + h.DetailID">
          <td class="text-center col-no">{{ h.HousingNo }}</td>
          <td class="col-name">{{ h.FamilyName || "（表記なし）" }}</td>
          <td class="text-center col-banchi">{{ printBanchi(h) }}</td>
          <td class="text-center col-status" :style="{ color: printVisitStatusColor(h) }">{{ printVisitStatusLabel(h) }}</td>
          <td class="text-center col-date-latest">{{ latestVisitDate(h) }}</td>
          <td class="text-center col-date-met">{{ lastMetDate(h) }}</td>
          <td class="col-note"></td>
        </tr>
      </tbody>
    </table>
    <div class="print-only print-footer">
      使用期限：{{ childInfo?.ChildLimitDate ?? "-" }}　／　子カード貸出情報 — {{ childInfo?.ChildBlock ?? "-" }}
    </div>

    <!-- 住戸一覧 -->
    <div class="mt-3 px-2 no-print">
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
              <th class="col-ng">NG</th>
              <th class="col-name">氏名</th>
              <th class="col-address">住所</th>
              <th class="col-building">建物</th>
              <th class="col-status">ステータス</th>
              <th class="col-lastvisit">最新訪問日</th>
              <th class="col-result">最新結果</th>
              <th class="col-history">履歴</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="row in visibleRows" :key="row.kind === 'building' ? 'b-' + row.key : row.house.DetailID">
              <!-- 建物ヘッダー行：結果入力／履歴ボタンは付けない -->
              <tr v-if="row.kind === 'building'" class="table-light building-row" style="cursor:pointer" @click="toggleGroup(row.key)">
                <td class="text-center">
                  <i class="fas" :class="expandedGroups[row.key] ? 'fa-caret-up' : 'fa-caret-down'"></i>
                </td>
                <td></td>
                <td>
                  <span v-if="buildingIconClass(row.houses[0].BuildingCategory)" class="me-1 text-secondary">
                    <i class="fas" :class="buildingIconClass(row.houses[0].BuildingCategory)"></i>
                  </span>
                  <b>{{ row.houses[0].BuildingName }}</b>
                  <span class="small text-muted ms-1">（{{ row.houses.length }}件）</span>
                </td>
                <td><div class="small">{{ houseAddress(row.houses[0]) }}</div></td>
                <td class="small text-muted">階数 {{ row.houses[0].Floors || "-" }} ／ 部屋数 {{ row.houses[0].Rooms || "-" }}</td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
              </tr>

              <!-- 住戸行（通常どおりの表示。建物配下のときは少しインデントする） -->
              <tr
                v-else
                :data-housing="row.house.HousingNo"
                :class="{ 'table-warning': focusedHousing === row.house.HousingNo }"
                @click="focusHouse(row.house)"
                style="cursor:pointer"
              >
                <td class="text-center fw-bold">
                  <span v-if="row.grouped" class="text-muted me-1">└</span>{{ row.house.HousingNo }}
                </td>
                <td class="text-center">
                  <i v-if="row.house.NGFlag === '不可'" class="fas fa-ban text-danger" title="訪問不可"></i>
                </td>
                <td>
                  <button type="button" class="btn btn-link p-0 text-start" @click.stop="openHouseInfoModal(row.house)">
                    <span class="name-text">{{ row.house.FamilyName || "(表記なし)" }}</span>
                  </button>
                </td>
                <td>
                  <div class="small">{{ houseAddress(row.house) }}</div>
                </td>
                <td>
                  <button type="button" class="btn btn-link p-0 text-start" @click.stop="openHouseInfoModal(row.house)">
                    <span v-if="buildingIconClass(row.house.BuildingCategory)" class="me-1 text-secondary">
                      <i class="fas" :class="buildingIconClass(row.house.BuildingCategory)"></i>
                    </span>
                    <span class="small">{{ row.house.BuildingName }} {{ row.house.RoomNo }}</span>
                  </button>
                </td>
                <td class="text-center">
                  <span :class="statusPillClass(displayStatus(row.house))">{{ displayStatus(row.house) }}</span>
                </td>
                <td class="text-center small">{{ latestVisitDate(row.house) }}</td>
                <td class="text-center small">
                  <button class="btn btn-sm btn-outline-primary" @click.stop="openAddModal(row.house)">結果入力</button>
                </td>
                <td class="text-center">
                  <button class="btn btn-sm btn-outline-secondary" @click.stop="openHistoryModal(row.house)" title="履歴">
                    <i class="fas fa-history"></i>
                  </button>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- カード形式（スマホ） -->
      <div class="d-md-none">
        <template v-for="row in visibleRows" :key="row.kind === 'building' ? 'b-' + row.key : row.house.DetailID">
          <!-- 建物ヘッダーカード：結果入力／履歴ボタンは付けない -->
          <div v-if="row.kind === 'building'" class="card card-house mb-2 building-row" @click="toggleGroup(row.key)">
            <div class="card-body py-2 px-3">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <i class="fas me-2" :class="expandedGroups[row.key] ? 'fa-caret-up' : 'fa-caret-down'"></i>
                  <span v-if="buildingIconClass(row.houses[0].BuildingCategory)" class="me-1 text-secondary">
                    <i class="fas" :class="buildingIconClass(row.houses[0].BuildingCategory)"></i>
                  </span>
                  <b>{{ row.houses[0].BuildingName }}</b>
                  <span class="small text-muted ms-1">（{{ row.houses.length }}件）</span>
                  <div class="small text-muted">{{ houseAddress(row.houses[0]) }}</div>
                  <div class="small text-muted">階数 {{ row.houses[0].Floors || "-" }} ／ 部屋数 {{ row.houses[0].Rooms || "-" }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 住戸カード（通常どおりの表示） -->
          <div
            v-else
            :data-housing="row.house.HousingNo"
            class="card card-house mb-2"
            :class="{ 'focused-house': focusedHousing === row.house.HousingNo, 'ms-3': row.grouped }"
            @click="focusHouse(row.house)"
          >
            <div class="card-body py-2 px-3">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <span class="fw-bold me-2">#{{ row.house.HousingNo }}</span>
                  <i v-if="row.house.NGFlag === '不可'" class="fas fa-ban text-danger me-1" title="訪問不可"></i>
                  <span v-if="buildingIconClass(row.house.BuildingCategory)" class="me-1 text-secondary">
                    <i class="fas" :class="buildingIconClass(row.house.BuildingCategory)"></i>
                  </span>
                  <button type="button" class="btn btn-link p-0" @click.stop="openHouseInfoModal(row.house)">
                    {{ row.house.FamilyName || "(表記なし)" }}
                  </button>
                  <div class="small text-muted">{{ row.house.BuildingName }} {{ row.house.RoomNo }}</div>
                  <div class="small text-muted">最新訪問日: {{ latestVisitDate(row.house) }}</div>
                </div>
                <div class="d-flex align-items-center gap-2">
                  <span :class="statusPillClass(displayStatus(row.house))" style="font-size:14px;">
                    {{ displayStatus(row.house) }}
                  </span>
                  <button class="btn btn-sm btn-outline-primary" @click.stop="openAddModal(row.house)">結果入力</button>
                  <button class="btn btn-sm btn-outline-secondary" @click.stop="openHistoryModal(row.house)" title="履歴">
                    <i class="fas fa-history"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </template>
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

  <!-- 住戸情報モーダル（氏名・建物クリック） -->
  <HouseInfoModal
    v-model="showHouseInfoModal"
    :house="houseInfoTarget"
    :read-only="usingCachedData"
    @saved="onHouseInfoSaved"
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
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from "vue";
import { useRouter } from "vue-router";
import QRCode from "qrcode";
import { useAuthStore } from "@/store/authStore.js";
import { getChildDetail, getChildPolygons, createChildShare, createChildPrintShare } from "@/services/api.js";
import { loadGoogleMaps, createMap, addMarker, setMarkerFocused } from "@/services/maps.js";
import { fetchDefaultCenter } from "@/services/mapCenter.js";
import { isChildOffline, getOfflineChild, findOfflineEntryByCard, isOnline } from "@/services/offline.js";
import VisitModal from "@/components/VisitModal.vue";
import HouseInfoModal from "@/components/HouseInfoModal.vue";
import OfflineSyncDialog from "@/components/OfflineSyncDialog.vue";
import { buildingIconClass } from "@/utils/buildingIcons.js";
import { groupHousesByBuilding } from "@/utils/buildingGroups.js";

const props = defineProps({
  cardNo:  { type: Number, required: true },
  childNo: { type: Number, required: true },
});

const router    = useRouter();
const authStore = useAuthStore();

// 地図のジェスチャー操作モード（1本指／2本指）をユーザーごとにブラウザストレージへ記憶する（#29）
const GESTURE_MODE_STORAGE_KEY = "ekuiki_childmap_gesture_mode";
function gestureModeStorageKey() {
  const uid = authStore.userId || "anonymous";
  return `${GESTURE_MODE_STORAGE_KEY}:${uid}`;
}
function loadGestureModePref() {
  try {
    const saved = localStorage.getItem(gestureModeStorageKey());
    return saved === "cooperative" ? "cooperative" : "greedy";
  } catch {
    return "greedy";
  }
}
function saveGestureModePref(mode) {
  try {
    localStorage.setItem(gestureModeStorageKey(), mode);
  } catch {
    // ストレージ不可でも致命的ではないため無視
  }
}

const loading        = ref(true);
const cardInfo       = ref(null);
const childInfo      = ref(null);
const houses         = ref([]);
const statusFilter   = ref("");
const focusedHousing = ref(null);
const mapContainer   = ref(null);
const mapVisible     = ref(true);
const gestureMode    = ref(loadGestureModePref()); // "greedy"(1本指) | "cooperative"(2本指)
const headerEl       = ref(null);
const headerHeight   = ref(64);
const showModal      = ref(false);
const selectedHouse  = ref(null);
const modalMode      = ref("add"); // 'add' | 'history'

const showShareModal = ref(false);
const shareLoading   = ref(false);
const shareQrDataUrl = ref("");
const shareError     = ref("");

const printLoading    = ref(false);
const printQrDataUrl  = ref("");
let printMapVisibleBefore = true;

const showHouseInfoModal = ref(false);
const houseInfoTarget    = ref(null);

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

let mapInstance   = null;
let parentPolygon = null; // 親カード（区域全体）のポリゴン、赤
let childPolygon  = null; // 当該子カードのポリゴン、緑
let infoWindow    = null;
const markers   = [];
const markersByHousing = new Map(); // HousingNo -> google.maps.Marker

// フィルタ済み住戸
const filteredHouses = computed(() => {
  if (!statusFilter.value) return houses.value;
  return houses.value.filter(h => (h.VisitStatus || "未訪問") === statusFilter.value);
});

// ---- 建物単位のアコーディオン表示（#100） ----
// キー: 建物グループキー、値: 展開中かどうか
const expandedGroups = reactive({});
function toggleGroup(key) {
  expandedGroups[key] = !expandedGroups[key];
}

// 表示行を「建物ヘッダー行」「住戸行」が混在する1本のリストに平坦化する。
// 建物ヘッダーは展開時のみ配下の住戸行を続けて出力する。
const visibleRows = computed(() => {
  const rows = [];
  for (const entry of groupHousesByBuilding(filteredHouses.value)) {
    if (entry.type === "house") {
      rows.push({ kind: "house", house: entry.house, grouped: false });
      continue;
    }
    rows.push({ kind: "building", key: entry.key, houses: entry.houses });
    if (expandedGroups[entry.key]) {
      for (const h of entry.houses) rows.push({ kind: "house", house: h, grouped: true });
    }
  }
  return rows;
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

// 地図ピンの色（#101）。訪問NG（NGFlag）はVisitStatusに関わらず最優先で赤にする。
const PIN_COLORS = {
  "未訪問": { fill: "#495057", stroke: "#212529" }, // 濃い灰色
  "不在":   { fill: "#FFC107", stroke: "#B8860B" }, // 黄色
  "済":     { fill: "#28A745", stroke: "#1E7E34" }, // 緑
  ng:       { fill: "#DC3545", stroke: "#A71D2A" }, // 赤（訪問NG）
};
function pinColor(h) {
  if (h.NGFlag === "不可") return PIN_COLORS.ng;
  return PIN_COLORS[h.VisitStatus || "未訪問"] || PIN_COLORS["未訪問"];
}

const TIME_ORDER = {
  "9時以前":    1,
  "9時〜12時":  2,
  "12時〜13時": 3,
  "13時〜16時": 4,
  "16時〜18時": 5,
  "18時以降":   6,
};

// 日付・時間帯で新しい順に並べた VRecord の先頭（最新の訪問記録）を返す
function latestRecord(h) {
  if (!h.VRecord || h.VRecord.length === 0) return null;
  const sorted = [...h.VRecord].sort((a, b) => {
    if (a.VisitDate !== b.VisitDate) return (b.VisitDate || "").localeCompare(a.VisitDate || "");
    return (TIME_ORDER[b.Time] || 0) - (TIME_ORDER[a.Time] || 0);
  });
  return sorted[0] ?? null;
}

// 最新訪問日
function latestVisitDate(h) {
  return latestRecord(h)?.VisitDate || "-";
}

// 最後に会えた日（結果が「済」の訪問記録のうち最新のもの、印刷用、#30）
function lastMetDate(h) {
  if (!h.VRecord || h.VRecord.length === 0) return "-";
  const met = h.VRecord
    .filter(v => (v.Result || "").includes("済"))
    .sort((a, b) => {
      if (a.VisitDate !== b.VisitDate) return (b.VisitDate || "").localeCompare(a.VisitDate || "");
      return (TIME_ORDER[b.Time] || 0) - (TIME_ORDER[a.Time] || 0);
    });
  return met[0]?.VisitDate || "-";
}

// 印刷用の住戸リスト（建物グルーピングをせず、住戸番号順にフラット表示、#30）
const printHouses = computed(() => {
  return [...houses.value].sort((a, b) => (a.HousingNo ?? 0) - (b.HousingNo ?? 0));
});

// 印刷用の「番地」欄：町名は見出しに共通表記済みのため、丁目-番地のみを表示する（#33）
function printBanchi(h) {
  if (h.AddressSW === "直接入力") {
    return `${h.InputCho ?? ""}-${h.InputBanchi ?? ""}`;
  }
  return `${h.CSVCho ?? ""}-${h.CSVBanchi ?? ""}`;
}

// 印刷用の訪問状況ラベル：訪問NGを最優先、「済」は「訪問済」と表記する（#33）
const PRINT_STATUS_COLORS = {
  "未訪問": "#6B7280",
  "訪問済": "#1E7A46",
  "不在":   "#B45309",
  "訪問NG": "#B91C1C",
};
function printVisitStatusLabel(h) {
  if (h.NGFlag === "不可") return "訪問NG";
  const raw = h.VisitStatus || "未訪問";
  return raw === "済" ? "訪問済" : raw;
}
function printVisitStatusColor(h) {
  return PRINT_STATUS_COLORS[printVisitStatusLabel(h)] || "#6B7280";
}

// NGを考慮しない「生の」訪問ステータス（訪問結果の履歴のみから算出）
function rawVisitStatus(h) {
  const top = latestRecord(h)?.Result || "";
  if (top.includes("済")) return "済";
  if (top === "不在")     return "不在";
  if (top !== "")         return "不在";
  return "未訪問";
}

// ステータス欄に表示する値。訪問不可はNGアイコン列に移したため、
// NGが立っている場合はステータス欄には（NGを除いた）本来の訪問状況を表示する
function displayStatus(h) {
  if (h.NGFlag === "不可") return rawVisitStatus(h);
  return h.VisitStatus || "未訪問";
}

// 住戸リスト側からの選択：該当ピンを強調表示し、地図を移動して吹き出しを開く
function focusHouse(h) {
  const prevMarker = focusedHousing.value != null ? markersByHousing.get(focusedHousing.value) : null;
  if (prevMarker) {
    const prevHouse = houses.value.find(x => x.HousingNo === focusedHousing.value);
    const c = prevHouse ? pinColor(prevHouse) : PIN_COLORS["未訪問"];
    setMarkerFocused(prevMarker, false, c.fill, c.stroke);
  }

  focusedHousing.value = h.HousingNo;

  const marker = markersByHousing.get(h.HousingNo);
  if (mapInstance && marker && h.CSVLat && h.CSVLng) {
    const c = pinColor(h);
    setMarkerFocused(marker, true, c.fill, c.stroke);
    mapInstance.panTo({ lat: h.CSVLat, lng: h.CSVLng });
    mapInstance.setZoom(18);
    openInfoWindow(h, marker);
  }
}

// 住戸の訪問ステータス／NGフラグが変わった際に、該当ピンの色を塗り替える
function updateMarkerColor(h) {
  const marker = markersByHousing.get(h.HousingNo);
  if (!marker) return;
  const c = pinColor(h);
  setMarkerFocused(marker, focusedHousing.value === h.HousingNo, c.fill, c.stroke);
}

// 地図側（ピンクリック）からの選択：住戸リストの該当行をハイライトし、スクロールする
function focusFromMarker(h) {
  focusHouse(h);
  nextTick(() => {
    document.querySelector(`[data-housing="${h.HousingNo}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

// 吹き出し（InfoWindow）：ORIGINAL/ChildMap.htmlのsetMarkersと同じ内容・体裁
// （Google標準の吹き出しをそのまま使用。カスタムの形・配色は付けない）
function openInfoWindow(h, marker) {
  if (!infoWindow) infoWindow = new google.maps.InfoWindow();
  const content = h.FamilyName
    ? `[No.${h.HousingNo}] ${h.FamilyName} さん<br>${houseAddress(h)}`
    : `[No.${h.HousingNo}] ${houseAddress(h)}`;
  infoWindow.setContent(content);
  infoWindow.open({ map: mapInstance, anchor: marker });
}

// 「氏名・建物」クリック：住戸情報モーダルを開く
function openHouseInfoModal(h) {
  houseInfoTarget.value = h;
  showHouseInfoModal.value = true;
}

function onHouseInfoSaved(updated) {
  const idx = houses.value.findIndex(h => h.DetailID === updated.DetailID);
  if (idx !== -1) {
    houses.value[idx] = { ...houses.value[idx], ...updated };
    updateMarkerColor(houses.value[idx]);
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

// 印刷／PDF出力：貸出情報・地図・住戸リストをB5横幅に収まるレイアウトで出力する（#30）。
// 印刷とPDFはレイアウトを分けず、いずれもブラウザの印刷ダイアログ（window.print、
// 「PDFに保存」選択可）を経由する。QRコードは使用期限内なら何度でもスキャンできる
// 印刷専用トークン（createChildPrintShare）を都度発行する。
async function printChildCard() {
  if (!childInfo.value?.ChildID) return;
  printLoading.value = true;
  try {
    const res = await createChildPrintShare(childInfo.value.ChildID);
    if (res.status === "success") {
      const shareUrl = `${window.location.origin}${window.location.pathname}#/mypage?share=${encodeURIComponent(res.token)}`;
      printQrDataUrl.value = await QRCode.toDataURL(shareUrl, { width: 160, margin: 1 });
    }
  } catch (e) {
    console.error("印刷用QRコードの生成に失敗しました:", e);
  } finally {
    printLoading.value = false;
  }
  await nextTick();
  window.print();
}

// 印刷時は「地図を隠す」状態でも地図を強制的に表示し、印刷後は元の表示状態に戻す
function handleBeforePrint() {
  printMapVisibleBefore = mapVisible.value;
  mapVisible.value = true;
}
function handleAfterPrint() {
  mapVisible.value = printMapVisibleBefore;
}

// 地図のジェスチャー操作モードを切り替える（誤操作防止、#29）
function toggleGestureMode() {
  gestureMode.value = gestureMode.value === "greedy" ? "cooperative" : "greedy";
  saveGestureModePref(gestureMode.value);
  if (mapInstance) {
    mapInstance.setOptions({ gestureHandling: gestureMode.value });
  }
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
    updateMarkerColor(target);
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
      const target = houses.value.find(h => h.HousingNo === house.HousingNo);
      if (target) updateMarkerColor(target);
    }
  } catch (e) {
    console.error(e);
  }
}

// 地図初期化
async function initMap() {
  try {
    await loadGoogleMaps();

    const center = (childInfo.value?.ChildLat && childInfo.value?.ChildLng)
      ? { lat: Number(childInfo.value.ChildLat), lng: Number(childInfo.value.ChildLng) }
      : await fetchDefaultCenter();

    mapInstance = createMap(mapContainer.value, center, 15, { gestureHandling: gestureMode.value });

    // 親カード（区域全体、赤）＋当該子カード（緑）のポリゴンを描画する（#27）。
    // KmlLayerでは2色の描き分けができないため、座標をJSONで取得して
    // google.maps.Polygonを個別描画する（GroupMapView.vueと同じ方式）。
    if (cardInfo.value?.KML) {
      try {
        const res = await getChildPolygons(cardInfo.value.KML);
        if (res.status === "success") {
          const bounds = new google.maps.LatLngBounds();
          const wholeEntry = (res.polygons || []).find(p => p.ChildNo === null);
          const childEntry = (res.polygons || []).find(p => p.ChildNo === Number(props.childNo));

          if (wholeEntry?.Path?.length > 0) {
            parentPolygon = new google.maps.Polygon({
              map: mapInstance,
              paths: wholeEntry.Path,
              fillColor: "#F44336", fillOpacity: 0.1,
              strokeColor: "#D32F2F", strokeWeight: 2,
              clickable: false,
            });
            wholeEntry.Path.forEach(p => bounds.extend(p));
          }
          if (childEntry?.Path?.length > 0) {
            childPolygon = new google.maps.Polygon({
              map: mapInstance,
              paths: childEntry.Path,
              fillColor: "#4CAF50", fillOpacity: 0.35,
              strokeColor: "#388E3C", strokeWeight: 2,
              clickable: false,
            });
            childEntry.Path.forEach(p => bounds.extend(p));
          }
          if (!bounds.isEmpty()) mapInstance.fitBounds(bounds);
        }
      } catch (e) {
        console.error("KMLポリゴンの取得に失敗しました:", e);
      }
    }

    // 住戸マーカー（クリックで住戸リストの該当行をハイライト・吹き出し表示）
    // ピンの色は訪問ステータス／訪問NGフラグに応じて塗り分ける（#101）
    for (const h of houses.value) {
      if (h.CSVLat && h.CSVLng) {
        const c = pinColor(h);
        const marker = addMarker(
          mapInstance,
          { lat: Number(h.CSVLat), lng: Number(h.CSVLng) },
          `#${h.HousingNo} ${h.FamilyName}`,
          c.fill,
          c.stroke
        );
        marker.addListener("click", () => focusFromMarker(h));
        markers.push(marker);
        markersByHousing.set(h.HousingNo, marker);
      }
    }
  } catch (e) {
    console.error("地図初期化エラー:", e);
  }
}

// 住戸一覧スクロール中も地図を固定表示するため、ヘッダーの実高さを地図ラッパーのtopに反映する
function updateHeaderHeight() {
  headerHeight.value = headerEl.value?.offsetHeight || 64;
}

onMounted(async () => {
  await nextTick();
  updateHeaderHeight();
  window.addEventListener("resize", updateHeaderHeight);
  window.addEventListener("beforeprint", handleBeforePrint);
  window.addEventListener("afterprint", handleAfterPrint);

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
  window.removeEventListener("resize", updateHeaderHeight);
  window.removeEventListener("beforeprint", handleBeforePrint);
  window.removeEventListener("afterprint", handleAfterPrint);
  if (parentPolygon) parentPolygon.setMap(null);
  if (childPolygon) childPolygon.setMap(null);
  if (infoWindow) infoWindow.close();
  markers.forEach(m => { if (m.map) m.map = null; });
  markersByHousing.clear();
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

.building-row {
  background-color: #f1f3f5;
}

.col-id       { width: 48px;  text-align: center; }
.col-ng       { width: 40px;  text-align: center; }
.col-name,
.col-address,
.col-building { width: 20%; }
.col-status   { width: 110px; text-align: center; }
.col-lastvisit { width: 100px; text-align: center; }
.col-result   { width: 90px;  text-align: center; }
.col-history  { width: 60px;  text-align: center; }

.name-text {
  font-size: calc(1rem + 4pt);
}

.map-sticky-wrapper {
  position: sticky;
  z-index: 10;
  background: #fff;
}

.offline-pill {
  background-color: #6f42c1;
  color: #fff;
  vertical-align: middle;
}

/* ---- 印刷／PDF出力（#30, #33で添付「子カード印刷サンプル.pptx」の様式を再現） ---- */
.print-only { display: none; }

/* ヘッダーバー（紺地・全幅フルブリード、ステータスバッジ＋町名タイトル） */
.print-header-bar {
  background: #1F3A63;
  color: #fff;
  padding: 8px 10mm;
  display: flex;
  align-items: center;
  gap: 10px;
}
.print-status-badge {
  background: #2C4B7C;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 6px;
  white-space: nowrap;
}
.print-header-title {
  font-size: 15px;
  font-weight: 700;
}

/* 貸出情報パネル（2x2ラベル/値グリッド＋右側にQR） */
.print-meta-panel {
  margin: 8px 10mm 0;
  padding: 8px 12px;
  background: #F5F7FA;
  border: 1px solid #D6DCE5;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.print-meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 24px;
  row-gap: 6px;
}
.print-meta-label {
  font-size: 7px;
  color: #6B7280;
}
.print-meta-value {
  font-size: 11px;
  font-weight: 700;
  color: #1F3A63;
}
.print-qr {
  width: 70px;
  height: 70px;
  flex: none;
}

/* 訪問リスト見出し（紺のtick＋タイトル、右に町名の注記） */
.print-section-header {
  margin: 10px 10mm 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.print-section-tick {
  width: 2px;
  height: 10px;
  background: #1F3A63;
  display: inline-block;
}
.print-section-title {
  font-size: 10px;
  font-weight: 700;
  color: #1F2937;
}
.print-section-sub {
  margin-left: auto;
  font-size: 7px;
  color: #6B7280;
}

/* 住戸（訪問）リスト表 */
.print-house-table {
  width: calc(100% - 20mm);
  margin: 0 10mm;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 12pt;
}
.print-house-table th,
.print-house-table td {
  border: 1px solid #D6DCE5;
  padding: 2px 3px;
  overflow-wrap: break-word;
}
.print-house-table th {
  background: #F5F7FA;
  font-weight: 700;
}
.print-house-table td.col-status  { font-weight: 700; }
.print-house-table .col-no         { width: 7%; }
.print-house-table .col-name       { width: 18%; }
.print-house-table .col-banchi     { width: 10%; }
.print-house-table .col-status     { width: 14%; }
.print-house-table .col-date-latest { width: 12%; }
.print-house-table .col-date-met   { width: 21%; }
.print-house-table .col-note       { width: 18%; }

.print-footer {
  margin: 4px 10mm 0;
  font-size: 7px;
  color: #6B7280;
  text-align: right;
}

@media print {
  .no-print { display: none !important; }
  .print-only { display: block !important; }

  /* #33：添付pptxと同じJIS B5・縦向き（182mm×257mm）、フチなしでヘッダーバーを全幅表示する */
  @page { size: 182mm 257mm; margin: 0; }

  .map-sticky-wrapper {
    position: static !important;
    top: auto !important;
    width: 68%;
    margin: 8px auto 0;
    border: 1px solid #D6DCE5;
    border-radius: 4px;
    overflow: hidden;
  }
  #mapContainer {
    width: 100% !important;
    height: 60mm !important;
  }
}
</style>
