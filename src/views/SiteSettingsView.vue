<template>
  <main role="main" class="container py-3">

    <!-- ヘッダー -->
    <header class="sticky-top bg-white mb-2 py-2 border-bottom">
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <button class="btn btn-link p-0 text-center" @click="router.push({ name: 'admins' })">
            <i class="fas fa-arrow-circle-left fa-2x"></i>
            <div class="small">戻る</div>
          </button>
        </div>
        <div class="text-center flex-grow-1" style="font-size:22px; font-weight:700;">サイト設定</div>
        <div>
          <button class="btn btn-link p-0 text-center" @click="router.push({ name: 'mainMenu' })">
            <i class="fas fa-home fa-2x"></i>
            <div class="small">ホーム</div>
          </button>
        </div>
      </div>
    </header>

    <div v-if="!authorized" class="alert alert-danger mt-3">このページを表示する権限がありません。</div>

    <div v-else class="row mt-3">
      <div class="col-sm-2"></div>
      <div class="col-sm-8">
        <div class="card shadow-sm">
          <div class="card-body">
            <h5 class="card-title">ログイン画面のアクセスコード</h5>
            <p class="text-muted small">
              ログイン画面を開いたとき、全ユーザーの氏名やメールアドレスの一覧が
              誰にでも見えてしまわないよう、最初にこのコードの入力を求めます。
            </p>

            <div v-if="loading" class="text-center text-muted py-3">
              <i class="fas fa-spinner fa-spin"></i> 読み込み中...
            </div>

            <template v-else>
              <label class="form-label">現在のコード</label>
              <input type="text" class="form-control mb-3" :value="currentCode" disabled />

              <label class="form-label">新しいコード（半角数字）</label>
              <input
                type="text"
                class="form-control"
                v-model="newCode"
                inputmode="numeric"
                placeholder="半角数字を入力"
              />

              <p v-if="message" class="small mt-2" :class="isError ? 'text-danger' : 'text-success'">{{ message }}</p>

              <button class="btn btn-primary mt-3" @click="save" :disabled="saving">
                {{ saving ? "保存中..." : "変更する" }}
              </button>
            </template>
          </div>
        </div>

        <div class="card shadow-sm mt-3">
          <div class="card-body">
            <h5 class="card-title">「地図で指定」の初期表示位置</h5>
            <p class="text-muted small">
              住戸・建物の緯度経度も住所も未入力の状態で［地図で指定］を開いたとき、
              最初に表示する地点です。緯度経度・住所が入力済みの場合はそちらが優先されます。
            </p>

            <div v-if="mapLoading" class="text-center text-muted py-3">
              <i class="fas fa-spinner fa-spin"></i> 読み込み中...
            </div>

            <template v-else>
              <div class="row g-2 mb-2">
                <div class="col-6">
                  <label class="form-label">緯度</label>
                  <input type="text" class="form-control" v-model="mapLat" inputmode="decimal" />
                </div>
                <div class="col-6">
                  <label class="form-label">経度</label>
                  <input type="text" class="form-control" v-model="mapLng" inputmode="decimal" />
                </div>
              </div>

              <button class="btn btn-outline-secondary btn-sm" @click="openMapPicker">
                <i class="fas fa-map-marker-alt"></i> 地図で指定
              </button>

              <div v-if="showMapPicker" class="border rounded mt-2 p-2">
                <div ref="pickerMapContainer" style="width:100%; height:320px;"></div>
                <div class="d-flex justify-content-end gap-2 mt-2">
                  <button class="btn btn-secondary btn-sm" @click="closeMapPicker">キャンセル</button>
                  <button class="btn btn-primary btn-sm" @click="confirmMapPicker">この地点にする</button>
                </div>
              </div>

              <p v-if="mapMessage" class="small mt-2" :class="mapIsError ? 'text-danger' : 'text-success'">{{ mapMessage }}</p>

              <button class="btn btn-primary mt-3" @click="saveMapCenter" :disabled="mapSaving">
                {{ mapSaving ? "保存中..." : "変更する" }}
              </button>
            </template>
          </div>
        </div>
      </div>
      <div class="col-sm-2"></div>
    </div>

  </main>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/store/authStore.js";
import { getSiteAccessCode, updateSiteAccessCode, getDefaultMapCenter, updateDefaultMapCenter } from "@/services/api.js";
import { loadGoogleMaps, createMap, addMarker } from "@/services/maps.js";
import { invalidateDefaultMapCenterCache } from "@/services/mapCenter.js";

// 管理者未設定・取得失敗時の最終フォールバック（東京都千代田区）。src/services/mapCenter.js と同じ値。
const FALLBACK_MAP_CENTER = { lat: 35.6812, lng: 139.7671 };

const router    = useRouter();
const authStore = useAuthStore();

const authorized = computed(() => authStore.userRole >= 9001);

const loading     = ref(false);
const saving      = ref(false);
const currentCode = ref("");
const newCode     = ref("");
const message     = ref("");
const isError     = ref(false);

async function fetchCode() {
  loading.value = true;
  try {
    const res = await getSiteAccessCode();
    if (res.status === "success") {
      currentCode.value = res.code;
      newCode.value     = res.code;
    } else {
      message.value = res.message || "取得に失敗しました";
      isError.value = true;
    }
  } catch (e) {
    message.value = e.message;
    isError.value = true;
  } finally {
    loading.value = false;
  }
}

async function save() {
  message.value = "";
  isError.value = false;

  if (!/^[0-9]+$/.test(newCode.value)) {
    message.value = "半角数字のみ入力してください";
    isError.value = true;
    return;
  }

  saving.value = true;
  try {
    const res = await updateSiteAccessCode(newCode.value);
    if (res.status === "success") {
      currentCode.value = res.code;
      message.value     = "アクセスコードを変更しました";
      isError.value      = false;
    } else {
      message.value = res.message || "変更に失敗しました";
      isError.value = true;
    }
  } catch (e) {
    message.value = e.message;
    isError.value = true;
  } finally {
    saving.value = false;
  }
}

// ---- 「地図で指定」の初期表示位置 ----
const mapLoading = ref(false);
const mapSaving  = ref(false);
const mapLat     = ref("");
const mapLng     = ref("");
const mapMessage = ref("");
const mapIsError = ref(false);

const showMapPicker      = ref(false);
const pickerMapContainer = ref(null);
let pickerMapInstance = null;
let pickerMarker = null;

async function fetchDefaultCenter() {
  mapLoading.value = true;
  try {
    const res = await getDefaultMapCenter();
    if (res.status === "success") {
      mapLat.value = res.lat != null ? String(res.lat) : String(FALLBACK_MAP_CENTER.lat);
      mapLng.value = res.lng != null ? String(res.lng) : String(FALLBACK_MAP_CENTER.lng);
    } else {
      mapMessage.value = res.message || "取得に失敗しました";
      mapIsError.value = true;
    }
  } catch (e) {
    mapMessage.value = e.message;
    mapIsError.value = true;
  } finally {
    mapLoading.value = false;
  }
}

async function openMapPicker() {
  showMapPicker.value = true;
  await nextTick();
  try {
    await loadGoogleMaps();
    const center = (mapLat.value && mapLng.value)
      ? { lat: Number(mapLat.value), lng: Number(mapLng.value) }
      : FALLBACK_MAP_CENTER;
    pickerMapInstance = createMap(pickerMapContainer.value, center, 15);
    pickerMarker = addMarker(pickerMapInstance, center, "");
    pickerMapInstance.addListener("click", (e) => {
      pickerMarker.setPosition(e.latLng);
    });
  } catch (e) {
    console.error("地図の初期化に失敗しました:", e);
  }
}

function confirmMapPicker() {
  if (pickerMarker) {
    const pos = pickerMarker.getPosition();
    mapLat.value = String(pos.lat());
    mapLng.value = String(pos.lng());
  }
  closeMapPicker();
}

function closeMapPicker() {
  showMapPicker.value = false;
  pickerMapInstance = null;
  pickerMarker = null;
}

async function saveMapCenter() {
  mapMessage.value = "";
  mapIsError.value = false;

  const lat = Number(mapLat.value);
  const lng = Number(mapLng.value);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    mapMessage.value = "緯度・経度を正しく入力してください";
    mapIsError.value = true;
    return;
  }

  mapSaving.value = true;
  try {
    const res = await updateDefaultMapCenter(lat, lng);
    if (res.status === "success") {
      mapMessage.value = "初期表示位置を変更しました";
      mapIsError.value = false;
      invalidateDefaultMapCenterCache();
    } else {
      mapMessage.value = res.message || "変更に失敗しました";
      mapIsError.value = true;
    }
  } catch (e) {
    mapMessage.value = e.message;
    mapIsError.value = true;
  } finally {
    mapSaving.value = false;
  }
}

onMounted(() => {
  if (authorized.value) {
    fetchCode();
    fetchDefaultCenter();
  }
});
</script>
