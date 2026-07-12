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
          </div>
          <div class="small text-muted">
            {{ cardInfo?.CardNo }}-{{ childInfo?.ChildNo }}
            ／ {{ childInfo?.ChildHouses }}件
          </div>
        </div>

        <button class="btn btn-link p-0 text-center" @click="router.push({ name: 'mainMenu' })">
          <i class="fas fa-home fa-2x"></i>
          <div class="small">ホーム</div>
        </button>
      </div>
    </header>

    <!-- 地図 -->
    <div id="mapContainer" ref="mapContainer"></div>

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
                <div class="small">{{ h.InputTownName }}{{ h.InputCho }}{{ h.InputBanchi }}</div>
              </td>
              <td class="text-center">
                <span :class="statusPillClass(h.VisitStatus)">{{ h.VisitStatus || "未訪問" }}</span>
              </td>
              <td class="text-center small">{{ latestResult(h) }}</td>
              <td class="text-center">
                <button class="btn btn-sm btn-outline-primary" @click.stop="openModal(h)">
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
                <button class="btn btn-sm btn-outline-primary" @click.stop="openModal(h)">
                  <i class="fas fa-plus"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </main>

  <!-- 訪問記録モーダル -->
  <VisitModal
    v-model="showModal"
    :house="selectedHouse"
    @saved="onRecordSaved"
    @deleted="onRecordDeleted"
  />
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/store/authStore.js";
import { getChildDetail, getKmlUrl } from "@/services/api.js";
import { loadGoogleMaps, createMap, addMarker, addKmlLayer } from "@/services/maps.js";
import VisitModal from "@/components/VisitModal.vue";

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
const showModal      = ref(false);
const selectedHouse  = ref(null);

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

// 訪問記録モーダルを開く
function openModal(h) {
  selectedHouse.value = h;
  showModal.value     = true;
}

// 保存後：該当住戸の VisitStatus を更新
function onRecordSaved({ house, visitStatus }) {
  const target = houses.value.find(h => h.HousingNo === house.HousingNo);
  if (target) {
    target.VisitStatus = visitStatus;
    // 再ロードして VRecord を更新
    reloadHouse(house);
  }
}

function onRecordDeleted({ house, visitStatus }) {
  onRecordSaved({ house, visitStatus });
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
.col-address { min-width: 200px; }
.col-status  { width: 110px; text-align: center; }
.col-result  { width: 100px; text-align: center; }
.col-history { width: 60px;  text-align: center; }
</style>
