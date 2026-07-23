<template>
  <!-- ローディング -->
  <div v-if="loading" class="loading-overlay no-print">
    <div class="text-center">
      <div class="spinner-border text-primary" style="width:3rem;height:3rem;" role="status"></div>
      <p class="mt-3">印刷データを読み込み中...</p>
    </div>
  </div>
  <div v-else-if="loadError" class="alert alert-danger m-3 no-print">{{ loadError }}</div>

  <!-- 画面上のツールバー（印刷時は非表示） -->
  <div class="toolbar no-print">
    <button class="btn btn-link p-0 text-center" @click="router.back()">
      <i class="fas fa-arrow-circle-left fa-2x"></i>
      <div class="small">戻る</div>
    </button>
    <button class="btn btn-primary" :disabled="printLoading" @click="doPrint">
      <i class="fas fa-print"></i> 印刷/PDF出力
    </button>
  </div>

  <!-- 印刷用ページ本体（添付の「子カード印刷サンプル.pptx」の様式を再現、#30/#33改） -->
  <div v-if="!loading && !loadError" class="print-page">
    <div class="print-header-bar">
      <span class="print-status-badge">{{ cardInfo?.CardNo ?? "-" }}-{{ childInfo?.ChildNo ?? "-" }}</span>
      <span class="print-header-title">【{{ childInfo?.ChildStatus ?? "-" }}】{{ childInfo?.ChildBlock ?? "-" }}</span>
    </div>

    <div class="print-meta-panel">
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

    <div class="map-frame">
      <div id="printMapContainer" ref="mapContainer"></div>
    </div>

    <div class="print-section-header">
      <span class="print-section-tick"></span>
      <span class="print-section-title">訪問リスト</span>
      <span class="print-section-sub">住所はすべて {{ cardInfo?.TownName ?? "-" }}</span>
    </div>
    <table class="print-house-table">
      <thead>
        <tr>
          <th class="col-no">NO</th>
          <th class="col-name">氏名</th>
          <th class="col-address">番地</th>
          <th class="col-status">訪問状況／最新訪問日</th>
          <th class="col-lastmet">最後に会えた日</th>
          <th class="col-note">ノート</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="h in printHouses" :key="h.DetailID">
          <td class="text-center col-no">{{ h.HousingNo }}</td>
          <td class="col-name">{{ h.FamilyName || "（表記なし）" }}</td>
          <td class="col-address">
            <div>{{ houseAddress(h) }}</div>
            <div>{{ h.BuildingName }} {{ h.RoomNo }}</div>
          </td>
          <td class="text-center col-status">
            <div class="status-value" :style="{ color: printVisitStatusColor(h) }">{{ printVisitStatusLabel(h) }}</div>
            <div class="status-date">{{ latestVisitDate(h) }}</div>
          </td>
          <td class="text-center col-lastmet">{{ lastMetDate(h) }}</td>
          <td class="col-note"></td>
        </tr>
      </tbody>
    </table>
    <div class="print-footer">
      使用期限：{{ childInfo?.ChildLimitDate ?? "-" }}　／　子カード貸出情報 — {{ childInfo?.ChildBlock ?? "-" }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import QRCode from "qrcode";
import { getChildDetail, getChildPolygons, createChildPrintShare } from "@/services/api.js";
import { loadGoogleMaps, createMap } from "@/services/maps.js";
import { fetchDefaultCenter } from "@/services/mapCenter.js";

const props = defineProps({
  cardNo:  { type: Number, required: true },
  childNo: { type: Number, required: true },
});

const router = useRouter();

const loading      = ref(true);
const loadError    = ref("");
const printLoading = ref(false);
const printQrDataUrl = ref("");

const cardInfo  = ref(null);
const childInfo = ref(null);
const houses    = ref([]);
const mapContainer = ref(null);

function doPrint() {
  window.print();
}

const TIME_ORDER = {
  "9時以前":    1,
  "9時〜12時":  2,
  "12時〜13時": 3,
  "13時〜16時": 4,
  "16時〜18時": 5,
  "18時以降":   6,
};

function latestRecord(h) {
  if (!h.VRecord || h.VRecord.length === 0) return null;
  const sorted = [...h.VRecord].sort((a, b) => {
    if (a.VisitDate !== b.VisitDate) return (b.VisitDate || "").localeCompare(a.VisitDate || "");
    return (TIME_ORDER[b.Time] || 0) - (TIME_ORDER[a.Time] || 0);
  });
  return sorted[0] ?? null;
}

function latestVisitDate(h) {
  return latestRecord(h)?.VisitDate || "-";
}

// 最後に会えた日（結果が「済」の訪問記録のうち最新のもの）
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

// 住戸番号順にフラット表示（建物グルーピングはしない）
const printHouses = computed(() => {
  return [...houses.value].sort((a, b) => (a.HousingNo ?? 0) - (b.HousingNo ?? 0));
});

// 「番地」欄1行目：住所（町名＋番地/号）。address_swに応じてCSV由来／手入力を切替（#39）
function houseAddress(h) {
  if (h.AddressSW === "直接入力") {
    return `${h.InputTownName ?? ""}${h.InputCho ?? ""}-${h.InputBanchi ?? ""}`;
  }
  return `${h.CSVTownName ?? ""}${h.CSVCho ?? ""}-${h.CSVBanchi ?? ""}`;
}

// 訪問状況ラベル：訪問NGを最優先、「済」は「訪問済」と表記する
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

async function initMap() {
  try {
    await loadGoogleMaps();

    const center = (childInfo.value?.ChildLat && childInfo.value?.ChildLng)
      ? { lat: Number(childInfo.value.ChildLat), lng: Number(childInfo.value.ChildLng) }
      : await fetchDefaultCenter();

    const mapInstance = createMap(mapContainer.value, center, 15, { gestureHandling: "cooperative" });

    if (cardInfo.value?.KML) {
      try {
        const res = await getChildPolygons(cardInfo.value.KML);
        if (res.status === "success") {
          const bounds = new google.maps.LatLngBounds();
          const wholeEntry = (res.polygons || []).find(p => p.ChildNo === null);
          const childEntry = (res.polygons || []).find(p => p.ChildNo === Number(props.childNo));

          if (wholeEntry?.Path?.length > 0) {
            new google.maps.Polygon({
              map: mapInstance,
              paths: wholeEntry.Path,
              fillColor: "#F44336", fillOpacity: 0.1,
              strokeColor: "#D32F2F", strokeWeight: 2,
              clickable: false,
            });
            wholeEntry.Path.forEach(p => bounds.extend(p));
          }
          if (childEntry?.Path?.length > 0) {
            new google.maps.Polygon({
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
  } catch (e) {
    console.error("地図初期化エラー:", e);
  }
}

onMounted(async () => {
  try {
    const res = await getChildDetail(props.cardNo, props.childNo);
    if (res.status !== "success") {
      throw new Error(res.message || "取得に失敗しました");
    }
    cardInfo.value  = res.cardInfo;
    childInfo.value = res.childInfo;
    houses.value    = res.houses;
  } catch (e) {
    loadError.value = "データを取得できませんでした。ネットワーク接続を確認してください。";
    console.error(e);
    loading.value = false;
    return;
  }

  // 印刷用QR（使用期限内は何度でもスキャンできる印刷専用トークン）
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

  loading.value = false;
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

.toolbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #fff;
  border-bottom: 1px solid #dee2e6;
}

/* 画面上でも印刷結果に近い見た目を確認できるよう、灰色背景の上に紙面を1枚表示する */
.print-page {
  width: 182mm;
  min-height: 257mm;
  margin: 12px auto;
  background: #fff;
  box-shadow: 0 0 8px rgba(0,0,0,.25);
}

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

.map-frame {
  width: 68%;
  margin: 8px auto 0;
  border: 1px solid #D6DCE5;
  border-radius: 4px;
  overflow: hidden;
}
#printMapContainer {
  width: 100%;
  height: 60mm;
}

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
.print-house-table .status-value { font-weight: 700; }
.print-house-table .status-date  { color: #6B7280; }
.print-house-table .col-no       { width: 7%; }
.print-house-table .col-name     { width: 18%; }
.print-house-table .col-address  { width: 20%; }
.print-house-table .col-status   { width: 20%; }
.print-house-table .col-lastmet  { width: 17%; }
.print-house-table .col-note     { width: 18%; }

.print-footer {
  margin: 4px 10mm 0;
  font-size: 7px;
  color: #6B7280;
  text-align: right;
}

@media print {
  .no-print { display: none !important; }

  /* 添付pptxと同じJIS B5・縦向き（182mm×257mm） */
  @page { size: 182mm 257mm; margin: 0; }

  body {
    background: #fff;
  }
  .print-page {
    width: auto;
    min-height: 0;
    margin: 0;
    box-shadow: none;
  }
}
</style>
