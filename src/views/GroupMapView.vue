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
        <div class="text-center flex-grow-1" style="font-size:22px; font-weight:700;">グループページ（地図）</div>
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

    <div class="d-flex justify-content-between align-items-end mb-2 mx-2 flex-wrap gap-2">
      <div class="d-flex align-items-end gap-3 flex-wrap">
        <div>
          <label class="form-label small mb-0">奉仕者で絞り込み</label>
          <select class="form-select form-select-sm" v-model="filterMinisterId">
            <option value="">全奉仕者</option>
            <option v-for="m in ministers" :key="m.UserID" :value="m.UserID">{{ m.UserName }}</option>
          </select>
        </div>
        <div class="form-check">
          <input
            type="checkbox"
            class="form-check-input"
            id="includeAvailable"
            v-model="includeAvailableInFilter"
            :disabled="!filterMinisterId"
          >
          <label class="form-check-label small" for="includeAvailable">貸出可能なカードも併せて表示する</label>
        </div>
      </div>
      <GroupViewSwitcher :current="GROUP_VIEWS.GROUP_MAP" />
    </div>

    <!-- 凡例 -->
    <div class="d-flex flex-wrap gap-3 align-items-center small mb-2 mx-2">
      <span><span class="legend-swatch" style="background:rgba(255,235,59,0.25); border-color:#FBC02D;"></span> 貸出中</span>
      <span><span class="legend-swatch" style="background:rgba(76,175,80,0.25); border-color:#388E3C;"></span> 貸出可能</span>
      <span><span class="legend-swatch" style="background:rgba(0,150,136,0.25); border-color:#00796B;"></span> 返却済（期限内）</span>
      <span><span class="legend-swatch" style="border-color:#9E9E9E;"></span> その他（操作不可）</span>
    </div>

    <div id="mapContainer" ref="mapContainer" class="mx-2"></div>

  </main>

  <!-- 地図クリック時の操作モーダル -->
  <div
    class="modal fade"
    :class="{ show: mapActionTarget }"
    :style="mapActionTarget ? 'display:block' : 'display:none'"
    tabindex="-1"
    role="dialog"
    @click.self="closeMapAction"
  >
    <div class="modal-dialog" role="document">
      <div class="modal-content" v-if="mapActionTarget">

        <div class="modal-header">
          <h5 class="modal-title">
            区域No.{{ mapActionTarget.CARDNO }}-{{ mapActionTarget.CHILDNO }} {{ mapActionTarget.CHILDBLOCK }}
          </h5>
          <button type="button" class="btn-close" @click="closeMapAction"></button>
        </div>

        <div class="modal-body">
          <template v-if="mapActionTarget.CHILDSTATUS === '貸出中'">
            <p class="mb-1">奉仕者：{{ mapActionTarget.MINISTERNAME || "-" }}</p>
            <p class="mb-1">貸出日：{{ mapActionTarget.CHILDCHECKOUTDATE || "-" }} ／ 期限：{{ mapActionTarget.CHILDLIMITDATE || "-" }}</p>
          </template>
          <template v-else>
            <div class="row g-2 align-items-center">
              <div class="col-6">奉仕者</div>
              <div class="col-6">
                <select class="form-select form-select-sm" v-model="mapMinisterId">
                  <option value="">-選択-</option>
                  <option v-for="m in ministers" :key="m.UserID" :value="m.UserID">{{ m.UserName }}</option>
                </select>
              </div>
              <div class="col-6">貸出日</div>
              <div class="col-6">
                <input type="date" class="form-control form-control-sm" v-model="mapCheckoutDate" />
              </div>
              <div class="col-6">期限日</div>
              <div class="col-6">
                <input type="date" class="form-control form-control-sm" v-model="mapLimitDate" />
              </div>
              <div class="col-6">（最大）</div>
              <div class="col-6">{{ mapActionTarget.CARDLIMITDATE ?? "-" }}</div>
              <div class="col-6">メモ</div>
              <div class="col-6">
                <textarea class="form-control form-control-sm" v-model="mapDescription" rows="2" maxlength="128"></textarea>
              </div>
            </div>
          </template>

          <p v-if="mapActionError" class="text-danger small mt-2 mb-0">{{ mapActionError }}</p>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeMapAction">閉じる</button>
          <button
            v-if="mapActionTarget.CHILDSTATUS === '貸出中'"
            class="btn btn-success"
            :disabled="mapActionProcessing"
            @click="returnFromMap"
          >
            <span v-if="mapActionProcessing"><i class="fas fa-spinner fa-spin"></i> 処理中...</span>
            <span v-else>返却する</span>
          </button>
          <button v-else class="btn btn-primary" :disabled="mapActionProcessing" @click="assignFromMap">
            <span v-if="mapActionProcessing"><i class="fas fa-spinner fa-spin"></i> 処理中...</span>
            <span v-else>貸出登録</span>
          </button>
        </div>

      </div>
    </div>
  </div>
  <div v-if="mapActionTarget" class="modal-backdrop fade show"></div>

</template>

<script setup>
import { ref, onMounted, nextTick, watch } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/store/authStore.js";
import {
  getGroupChildList, getMinisterOptions, getChildPolygons,
  assignChildMinister, returnChildCard,
} from "@/services/api.js";
import { loadGoogleMaps, createMap } from "@/services/maps.js";
import { fetchDefaultCenter } from "@/services/mapCenter.js";
import GroupViewSwitcher from "@/components/GroupViewSwitcher.vue";
import { GROUP_VIEWS, setLastGroupView } from "@/services/groupViewPreference.js";

const router    = useRouter();
const authStore = useAuthStore();

const loading         = ref(true);
const cards           = ref([]);
const ministers       = ref([]);
const mapContainer    = ref(null);
const filterMinisterId = ref(""); // #112: 空なら全件表示
const includeAvailableInFilter = ref(false); // #113: 絞り込み中も貸出可能・返却済（期限内）を併せて表示するか

let mapInstance = null;
const polygonsByKey  = new Map(); // "CardNo-ChildNo" -> [{lat,lng}]
const polygonByChild  = new Map(); // CHILDID -> google.maps.Polygon

// 貸出可能・返却済で、かつ使用期限が到来していない子カードのみ地図から貸出できる（ChildListView.vueと同じ判定）
function isCheckoutable(child) {
  if (child.CHILDSTATUS !== "貸出可能" && child.CHILDSTATUS !== "返却済") return false;
  if (!child.CHILDLIMITDATE) return true;
  return child.CHILDLIMITDATE >= new Date().toISOString().slice(0, 10);
}

function styleForChild(child) {
  if (child.CHILDSTATUS === "貸出中") {
    return { fillColor: "#FFEB3B", fillOpacity: 0.25, strokeColor: "#FBC02D", strokeWeight: 2, clickable: true };
  }
  if (isCheckoutable(child)) {
    // 貸出可能＝緑、返却済＝青緑（いずれも透過率75%で塗りつぶし）（#113）
    if (child.CHILDSTATUS === "貸出可能") {
      return { fillColor: "#4CAF50", fillOpacity: 0.25, strokeColor: "#388E3C", strokeWeight: 2, clickable: true };
    }
    return { fillColor: "#009688", fillOpacity: 0.25, strokeColor: "#00796B", strokeWeight: 2, clickable: true };
  }
  return { fillColor: "#9E9E9E", fillOpacity: 0, strokeColor: "#9E9E9E", strokeWeight: 1, clickable: false };
}

function updatePolygonStyle(childId) {
  const polygon = polygonByChild.get(childId);
  const child   = cards.value.find(c => c.CHILDID === childId);
  if (!polygon || !child) return;
  polygon.setOptions(styleForChild(child));
}

// グループの子カードが参照する各card_noのKMLファイルから、子カードごとのポリゴン座標を取得する
async function loadPolygons() {
  const fileToCardNo = new Map();
  for (const c of cards.value) {
    if (c.CardKml && !fileToCardNo.has(c.CardKml)) fileToCardNo.set(c.CardKml, c.CARDNO);
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

async function initMap() {
  try {
    await loadGoogleMaps();
    mapInstance = createMap(mapContainer.value, await fetchDefaultCenter(), 12);

    const bounds = new google.maps.LatLngBounds();
    for (const child of cards.value) {
      const path = polygonsByKey.get(`${child.CARDNO}-${child.CHILDNO}`);
      if (!path || path.length === 0) continue;

      const style = styleForChild(child);
      const polygon = new google.maps.Polygon({
        map: mapInstance,
        paths: path,
        ...style,
      });
      polygonByChild.set(child.CHILDID, polygon);
      path.forEach(p => bounds.extend(p));

      if (style.clickable) {
        polygon.addListener("click", () => openMapAction(child.CHILDID));
      }
    }

    if (!bounds.isEmpty()) mapInstance.fitBounds(bounds);
  } catch (e) {
    console.error("地図初期化エラー:", e);
  }
}

// 奉仕者フィルタ（#112）：選択中は、その奉仕者が貸出中のポリゴンだけを表示する
function applyMinisterFilter() {
  if (!mapInstance) return;

  const bounds = new google.maps.LatLngBounds();
  for (const child of cards.value) {
    const polygon = polygonByChild.get(child.CHILDID);
    if (!polygon) continue;

    const visible = !filterMinisterId.value
      || (child.CHILDSTATUS === "貸出中" && child.MINISTER === filterMinisterId.value)
      || (includeAvailableInFilter.value && isCheckoutable(child));
    polygon.setVisible(visible);
    if (visible) polygon.getPath().forEach(latLng => bounds.extend(latLng));
  }

  if (!bounds.isEmpty()) mapInstance.fitBounds(bounds);
}

watch([filterMinisterId, includeAvailableInFilter], applyMinisterFilter);

async function fetchData() {
  loading.value = true;
  try {
    const [cardsRes, ministersRes] = await Promise.all([
      getGroupChildList(authStore.userGroup),
      getMinisterOptions(authStore.userGroup),
    ]);
    if (cardsRes.status === "success")     cards.value     = cardsRes.cards || [];
    if (ministersRes.status === "success") ministers.value = ministersRes.ministers || [];

    await loadPolygons();
    await nextTick();
    await initMap();
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

// ---- 地図クリック時の操作モーダル ----
const mapActionTarget     = ref(null);
const mapMinisterId       = ref("");
const mapCheckoutDate     = ref("");
const mapLimitDate        = ref("");
const mapDescription      = ref("");
const mapActionProcessing = ref(false);
const mapActionError      = ref("");

function openMapAction(childId) {
  const child = cards.value.find(c => c.CHILDID === childId);
  if (!child) return;

  mapActionTarget.value = child;
  mapActionError.value  = "";
  if (child.CHILDSTATUS !== "貸出中") {
    mapMinisterId.value   = "";
    mapCheckoutDate.value = new Date().toISOString().slice(0, 10);
    mapLimitDate.value    = child.CHILDLIMITDATE || "";
    mapDescription.value  = "";
  }
}

function closeMapAction() {
  mapActionTarget.value = null;
}

async function assignFromMap() {
  if (!mapActionTarget.value) return;

  if (!mapMinisterId.value) {
    mapActionError.value = "貸し出す奉仕者名を選択してください。";
    return;
  }
  if (mapCheckoutDate.value && mapLimitDate.value && mapCheckoutDate.value > mapLimitDate.value) {
    mapActionError.value = "期限日は貸出日以降に設定してください。";
    return;
  }
  if (mapActionTarget.value.CARDLIMITDATE && mapLimitDate.value && mapLimitDate.value > mapActionTarget.value.CARDLIMITDATE) {
    mapActionError.value = "期限日は親カードの使用期限日（最大）を超えないように設定してください。";
    return;
  }

  mapActionProcessing.value = true;
  try {
    const res = await assignChildMinister(mapActionTarget.value.CHILDID, {
      ministerId:   mapMinisterId.value,
      limitDate:    mapLimitDate.value || null,
      checkoutDate: mapCheckoutDate.value || null,
      description:  mapDescription.value,
    });
    if (res.status === "success") {
      const idx = cards.value.findIndex(c => c.CHILDID === mapActionTarget.value.CHILDID);
      if (idx !== -1) {
        cards.value[idx].MINISTER          = res.child?.MINISTER          ?? mapMinisterId.value;
        cards.value[idx].MINISTERNAME      = res.child?.MINISTERNAME      ?? (ministers.value.find(m => m.UserID === mapMinisterId.value)?.UserName ?? "");
        if (res.child?.CHILDSTATUS)        cards.value[idx].CHILDSTATUS       = res.child.CHILDSTATUS;
        if (res.child?.CHILDCHECKOUTDATE)  cards.value[idx].CHILDCHECKOUTDATE = res.child.CHILDCHECKOUTDATE;
        if (res.child?.CHILDLIMITDATE)     cards.value[idx].CHILDLIMITDATE    = res.child.CHILDLIMITDATE;
      }
      updatePolygonStyle(mapActionTarget.value.CHILDID);
      closeMapAction();
    } else {
      mapActionError.value = res.message || "貸出に失敗しました";
    }
  } catch (e) {
    mapActionError.value = e.message;
  } finally {
    mapActionProcessing.value = false;
  }
}

async function returnFromMap() {
  if (!mapActionTarget.value) return;
  if (!confirm(`${mapActionTarget.value.CARDNO}-${mapActionTarget.value.CHILDNO}のカードを返却します。よろしいですか？`)) return;

  mapActionProcessing.value = true;
  try {
    const res = await returnChildCard(mapActionTarget.value.CHILDID);
    if (res.status === "success") {
      const idx = cards.value.findIndex(c => c.CHILDID === mapActionTarget.value.CHILDID);
      if (idx !== -1) {
        cards.value[idx].CHILDSTATUS       = res.child?.CHILDSTATUS ?? "返却済";
        cards.value[idx].CHILDCHECKOUTDATE = res.child?.CHILDCHECKOUTDATE ?? cards.value[idx].CHILDCHECKOUTDATE;
      }
      updatePolygonStyle(mapActionTarget.value.CHILDID);
      closeMapAction();
    } else {
      mapActionError.value = res.message || "返却に失敗しました";
    }
  } catch (e) {
    mapActionError.value = e.message;
  } finally {
    mapActionProcessing.value = false;
  }
}

onMounted(() => {
  setLastGroupView(GROUP_VIEWS.GROUP_MAP);
  fetchData();
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
