<template>
  <!-- ローディング -->
  <div v-if="loading" class="loading">
    <i class="fas fa-spinner fa-4x fa-spin"></i>
  </div>

  <main role="main" class="container-fluid py-3">

    <!-- ヘッダー -->
    <header class="sticky-top bg-white mb-2 py-2 border-bottom">
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <button class="btn btn-link p-0 text-center" @click="router.push({ name: 'mainMenu' })">
            <i class="fas fa-arrow-circle-left fa-2x"></i>
            <div class="small">戻る</div>
          </button>
        </div>
        <div class="text-center flex-grow-1" style="font-size:22px; font-weight:700;">マイページ（地図）</div>
        <div>
          <button class="btn btn-link p-0 text-center" @click="router.push({ name: 'mainMenu' })">
            <i class="fas fa-home fa-2x"></i>
            <div class="small">ホーム</div>
          </button>
        </div>
      </div>
    </header>

    <!-- ユーザー情報 -->
    <div class="alert alert-secondary py-2 mb-3 mx-2">
      <strong>{{ authStore.userName }}</strong>（{{ authStore.userEmail }}）
      ／ グループ：{{ authStore.userGroup }} ／ 権限：{{ authStore.userRole }}
    </div>

    <div class="d-flex justify-content-end mb-2 mx-2">
      <button class="btn btn-outline-primary btn-sm" @click="router.push({ name: 'assignmentList' })">
        <i class="fas fa-th-list"></i> 一覧で見る
      </button>
    </div>

    <!-- 凡例 -->
    <div class="d-flex flex-wrap gap-3 align-items-center small mb-2 mx-2">
      <span v-for="(c, status) in STATUS_COLORS" :key="status">
        <span class="legend-swatch" :style="{ background: c.fill, borderColor: c.stroke }"></span> {{ status }}
      </span>
    </div>

    <div id="mapContainer" ref="mapContainer" class="mx-2"></div>

    <div v-if="!loading && childs.length === 0" class="text-center text-muted mt-5">
      <i class="fas fa-inbox fa-3x mb-3"></i>
      <p>表示するカードがありません</p>
    </div>

  </main>
</template>

<script setup>
import { ref, onMounted, nextTick } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/store/authStore.js";
import { getFilteredChildCardbyUser, getChildPolygons } from "@/services/api.js";
import { loadGoogleMaps, createMap } from "@/services/maps.js";

const router    = useRouter();
const authStore = useAuthStore();

const loading      = ref(true);
const childs       = ref([]);
const mapContainer = ref(null);

let mapInstance = null;
const polygonsByKey = new Map(); // "CardNo-ChildNo" -> [{lat,lng}]

// オリジナル版のBootstrap4配色をhex直指定で踏襲（マイページ一覧画面と同一のステータス配色）
const STATUS_COLORS = {
  "貸出中": { fill: "rgba(255,193,7,0.25)",  stroke: "#B8860B" },
  "返却済": { fill: "rgba(23,162,184,0.25)", stroke: "#117a8b" },
  "整備中": { fill: "rgba(108,117,125,0.25)", stroke: "#495057" },
  "完了":   { fill: "rgba(40,167,69,0.25)",  stroke: "#1e7e34" },
  "重点":   { fill: "rgba(220,53,69,0.25)",  stroke: "#a71d2a" },
};

function styleForChild(child) {
  const c = STATUS_COLORS[child.CHILDSTATUS] || STATUS_COLORS["整備中"];
  return { fillColor: c.fill, fillOpacity: 1, strokeColor: c.stroke, strokeWeight: 2, clickable: true };
}

// 割り当てられた子カードが参照する各card_noのKMLファイルから、子カードごとのポリゴン座標を取得する
async function loadPolygons() {
  const fileToCardNo = new Map();
  for (const c of childs.value) {
    if (c.KML && !fileToCardNo.has(c.KML)) fileToCardNo.set(c.KML, c.CARDNO);
  }

  polygonsByKey.clear();
  await Promise.all([...fileToCardNo.entries()].map(async ([file, cardNo]) => {
    try {
      const res = await getChildPolygons(file);
      if (res.status !== "success") return;
      for (const p of res.polygons || []) {
        polygonsByKey.set(`${cardNo}-${p.ChildNo}`, p.Path);
      }
    } catch (e) {
      console.error("KMLポリゴンの取得に失敗しました:", file, e);
    }
  }));
}

function warnIfOverdue(child) {
  if (!child.CHILDLIMITDATE) return;
  const limit = new Date(child.CHILDLIMITDATE);
  if (Number.isNaN(limit.getTime())) return;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  limit.setHours(0, 0, 0, 0);
  if (limit < today) {
    alert("使用期限を過ぎています。使用にあたっては区域担当者にご相談ください。");
  }
}

function openChildMap(child) {
  warnIfOverdue(child);
  router.push({
    name:   "childMap",
    params: { cardNo: child.CARDNO, childNo: child.CHILDNO },
  });
}

async function initMap() {
  try {
    await loadGoogleMaps();
    mapInstance = createMap(mapContainer.value, { lat: 35.6812, lng: 139.7671 }, 12);

    const bounds = new google.maps.LatLngBounds();
    for (const child of childs.value) {
      const path = polygonsByKey.get(`${child.CARDNO}-${child.CHILDNO}`);
      if (!path || path.length === 0) continue;

      const polygon = new google.maps.Polygon({
        map: mapInstance,
        paths: path,
        ...styleForChild(child),
      });
      path.forEach(p => bounds.extend(p));
      polygon.addListener("click", () => openChildMap(child));
    }

    if (!bounds.isEmpty()) mapInstance.fitBounds(bounds);
  } catch (e) {
    console.error("地図初期化エラー:", e);
  }
}

async function fetchData() {
  loading.value = true;
  try {
    const res = await getFilteredChildCardbyUser();
    if (res.status === "success") childs.value = res.cards || [];

    await loadPolygons();
    await nextTick();
    await initMap();
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

onMounted(fetchData);
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

#mapContainer {
  width: calc(100% - 1rem);
  height: 70vh;
  min-height: 400px;
}

.legend-swatch {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid;
  vertical-align: middle;
  margin-right: 4px;
}
</style>
