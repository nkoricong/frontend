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
        <button class="btn btn-link p-0 text-center" @click="router.push({ name: 'cardList' })">
          <i class="fas fa-arrow-circle-left fa-2x"></i>
          <div class="small">戻る</div>
        </button>

        <div class="text-center flex-grow-1">
          <div style="font-size:18px;font-weight:700;">
            [{{ cardInfo?.CardNo }}] {{ cardInfo?.TownName }}
          </div>
          <div class="small text-muted">
            {{ cardInfo?.Area }} ／ 子カード{{ childs.length }}枚
          </div>
        </div>

        <button class="btn btn-link p-0 text-center" @click="router.push({ name: 'mainMenu' })">
          <i class="fas fa-home fa-2x"></i>
          <div class="small">ホーム</div>
        </button>
      </div>
    </header>

    <!-- 区域カード情報サマリー -->
    <div class="row px-2 mb-2">
      <div class="col-6 col-md-4"><h6 class="mb-1">[ステータス] {{ cardInfo?.Status ?? "-" }}</h6></div>
      <div class="col-6 col-md-4"><h6 class="mb-1">[責任者] {{ cardInfo?.Group ?? "-" }} / {{ cardInfo?.Arrenger ?? "-" }}</h6></div>
      <div class="col-12 col-md-4"><h6 class="mb-1">[貸出日] {{ cardInfo?.CheckoutDate ?? "-" }} / [返却期限] {{ cardInfo?.LimitDate ?? "-" }}</h6></div>
    </div>

    <!-- 地図 -->
    <div id="mapContainer" ref="mapContainer"></div>

    <!-- 子カード一覧 -->
    <div class="mt-3 px-2">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <h6 class="mb-0">子カード一覧（{{ childs.length }}枚）</h6>
      </div>

      <!-- テーブル形式（PC） -->
      <div class="d-none d-md-block">
        <table class="table table-sm table-hover table-bordered align-middle">
          <thead class="table-light">
            <tr>
              <th class="col-id">#</th>
              <th class="col-block">区域名(枚数)</th>
              <th class="col-status">ｽﾃｰﾀｽ</th>
              <th class="col-people">グループ｜奉仕者</th>
              <th class="col-date">貸出日／期限</th>
              <th class="col-visited">訪問済</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="child in childs"
              :key="child.ChildID"
              style="cursor:pointer"
              @click="openChildMap(child)"
            >
              <td class="text-center fw-bold">{{ child.CardNo }}-{{ child.ChildNo }}</td>
              <td>
                {{ child.ChildBlock }}
                <span class="small text-muted">({{ child.ChildHouses }}件)</span>
              </td>
              <td class="text-center">
                <span :class="statusBadgeClass(child.ChildStatus)">{{ child.ChildStatus }}</span>
              </td>
              <td v-if="child.ChildStatus === '貸出中'">
                {{ child.ChildGroup }} ｜ {{ child.ChildMinister }}
              </td>
              <td v-else></td>
              <td class="small text-center">
                {{ child.ChildCheckoutDate ?? "-" }} ／ {{ child.ChildLimitDate ?? "-" }}
              </td>
              <td class="text-center">{{ child.Visited ?? 0 }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- カード形式（スマホ） -->
      <div class="d-md-none">
        <div class="row g-2">
          <div class="col-12" v-for="child in childs" :key="child.ChildID">
            <div class="card shadow-sm" @click="openChildMap(child)" style="cursor:pointer">
              <div class="card-body py-2 px-3">
                <div class="d-flex justify-content-between align-items-start mb-1">
                  <h6 class="mb-0">
                    <span class="cardno-badge">{{ child.CardNo }}-{{ child.ChildNo }}</span>
                    {{ child.ChildBlock }}
                  </h6>
                  <span :class="statusBadgeClass(child.ChildStatus)">{{ child.ChildStatus }}</span>
                </div>
                <p class="mb-1 small text-muted">
                  {{ child.ChildHouses }}件 ／ 訪問済：{{ child.Visited ?? 0 }}件
                </p>
                <p v-if="child.ChildStatus === '貸出中'" class="mb-1 small">
                  {{ child.ChildGroup }} ｜ {{ child.ChildMinister }}
                </p>
                <div class="small text-muted">
                  貸出: {{ child.ChildCheckoutDate ?? "-" }} ／ 期限: {{ child.ChildLimitDate ?? "-" }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="childs.length === 0 && !loading" class="text-center text-muted mt-5">
        <i class="fas fa-inbox fa-3x mb-3"></i>
        <p>子カードがありません</p>
      </div>
    </div>

  </main>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { getChildListByCard, getKmlUrl } from "@/services/api.js";
import { loadGoogleMaps, createMap, addKmlLayer } from "@/services/maps.js";

const props = defineProps({
  cardNo: { type: Number, required: true },
});

const router = useRouter();

const loading      = ref(true);
const cardInfo     = ref(null);
const childs       = ref([]);
const mapContainer = ref(null);

let mapInstance = null;
let kmlLayer    = null;

// ステータスの badge スタイル（AssignmentListView と同一のマッピング）
function statusBadgeClass(status) {
  const map = {
    "貸出中": "badge bg-primary",
    "重点":   "badge bg-danger",
    "返却済": "badge bg-secondary",
  };
  return map[status] || "badge bg-light text-dark";
}

function openChildMap(child) {
  router.push({
    name:   "childMap",
    params: { cardNo: child.CardNo, childNo: child.ChildNo },
  });
}

// 地図初期化（区域全体の中心 + KML 区割り表示）
async function initMap() {
  try {
    await loadGoogleMaps();

    const center = {
      lat: cardInfo.value?.LAT ? Number(cardInfo.value.LAT) : 35.6812,
      lng: cardInfo.value?.LNG ? Number(cardInfo.value.LNG) : 139.7671,
    };

    mapInstance = createMap(mapContainer.value, center, 15);

    if (cardInfo.value?.KML) {
      kmlLayer = addKmlLayer(mapInstance, getKmlUrl(cardInfo.value.KML));
    }
  } catch (e) {
    console.error("地図初期化エラー:", e);
  }
}

onMounted(async () => {
  try {
    const res = await getChildListByCard(props.cardNo);
    if (res.status === "success") {
      cardInfo.value = res.cardInfo;
      childs.value   = res.childs;
    }
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }

  await initMap();
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
  height: 300px;
}

@media (max-width: 768px) {
  #mapContainer { height: 220px; }
}

.cardno-badge {
  border: 2px solid #007bff;
  border-radius: 8px;
  padding: 2px 8px;
  font-weight: bold;
  margin-right: 6px;
  font-size: 14px;
}

.col-id      { width: 90px;  text-align: center; }
.col-block   { min-width: 200px; }
.col-status  { width: 100px; text-align: center; }
.col-people  { min-width: 160px; }
.col-date    { width: 200px; text-align: center; }
.col-visited { width: 80px;  text-align: center; }
</style>
