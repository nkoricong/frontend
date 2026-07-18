<template>
  <!-- ローディング -->
  <div v-if="loading" class="loading-overlay">
    <div class="text-center">
      <div class="spinner-border text-primary" style="width:3rem;height:3rem;" role="status"></div>
      <p class="mt-3">建物マスタを読み込み中...</p>
    </div>
  </div>

  <main class="container-fluid py-2">

    <!-- ヘッダー -->
    <header class="sticky-top bg-white mb-2 py-2 border-bottom">
      <div class="d-flex justify-content-between align-items-center px-2">
        <button class="btn btn-link p-0 text-center" @click="router.push({ name: 'settings' })">
          <i class="fas fa-arrow-circle-left fa-2x"></i>
          <div class="small">戻る</div>
        </button>

        <div class="text-center flex-grow-1">
          <div style="font-size:18px;font-weight:700;">建物マスタの編集</div>
          <div class="small text-muted">{{ buildings.length }}件</div>
        </div>

        <button class="btn btn-link p-0 text-center" @click="router.push({ name: 'mainMenu' })">
          <i class="fas fa-home fa-2x"></i>
          <div class="small">ホーム</div>
        </button>
      </div>
    </header>

    <!-- ツールバー -->
    <div class="d-flex flex-wrap gap-2 justify-content-end mb-2 px-2">
      <button class="btn btn-outline-secondary" @click="fetchBuildings" :disabled="busy">
        <i class="fas fa-redo"></i> 再読み込み
      </button>
      <button class="btn btn-primary" @click="openAddModal" :disabled="busy">
        <i class="fas fa-plus-circle"></i> 建物の追加
      </button>
    </div>

    <!-- 初回のみ：detailテーブルの建物情報を建物マスタへ移行 -->
    <div v-if="!loading && buildings.length === 0" class="px-2 mb-3">
      <div class="alert alert-warning d-flex justify-content-between align-items-center">
        <span>建物マスタがまだ空です。既存の住戸データから建物情報を移行できます。</span>
        <button class="btn btn-warning" @click="runBackfill" :disabled="busy">
          初回のみ：住戸データから移行
        </button>
      </div>
    </div>

    <!-- 一覧テーブル -->
    <div class="table-responsive px-2">
      <table class="table table-sm table-hover table-bordered align-middle">
        <thead class="table-light">
          <tr>
            <th style="width:70px;">建物番号</th>
            <th style="width:160px;">建物種別</th>
            <th>建物名</th>
            <th>住所</th>
            <th style="width:70px;">可否</th>
            <th style="width:140px;">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="b in buildings" :key="b.BuildingNo">
            <td class="text-center fw-bold">{{ b.BuildingNo }}</td>
            <td>
              <i v-if="buildingIconClass(b.BuildingCategory)" class="fas text-secondary me-1" :class="buildingIconClass(b.BuildingCategory)"></i>
              {{ b.BuildingCategory }}
            </td>
            <td>{{ b.BuildingName }}</td>
            <td class="small">
              <span v-if="b.AddressSW === '直接入力'">{{ b.InputTownName }}{{ b.InputCho }}{{ b.InputBanchi }}</span>
              <span v-else>{{ b.CSVTownName }}{{ b.CSVCho }}{{ b.CSVBanchi }}</span>
            </td>
            <td class="text-center">
              <i v-if="b.NGFlag === '不可'" class="fas fa-ban text-danger" title="訪問不可"></i>
              <span v-else>可</span>
            </td>
            <td class="text-nowrap">
              <button class="btn btn-sm btn-outline-primary me-1" @click="openEditModal(b)">編集</button>
              <button class="btn btn-sm btn-outline-danger" @click="deleteRow(b)">削除</button>
            </td>
          </tr>
          <tr v-if="buildings.length === 0">
            <td colspan="6" class="text-center text-muted py-4">建物マスタデータがありません</td>
          </tr>
        </tbody>
      </table>
    </div>

  </main>

  <!-- 編集・追加モーダル -->
  <div v-if="showModal">
    <div class="modal-backdrop-custom" @click="closeModal"></div>
    <div class="modal d-block" tabindex="-1">
      <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <span v-if="editMode === 'edit'">建物マスタの編集</span>
              <span v-else>建物マスタの追加</span>
            </h5>
            <button type="button" class="btn-close" @click="closeModal"></button>
          </div>

          <div class="modal-body">
            <div class="row g-3">

              <div class="col-sm-6">
                <label class="form-label">建物種別</label>
                <div class="d-flex align-items-center gap-2">
                  <i v-if="buildingIconClass(editForm.BuildingCategory)" class="fas text-secondary" :class="buildingIconClass(editForm.BuildingCategory)"></i>
                  <select class="form-select" v-model="editForm.BuildingCategory">
                    <option v-for="b in BuildKinds" :key="b" :value="b">{{ b }}</option>
                  </select>
                </div>
              </div>

              <div class="col-sm-6">
                <label class="form-label">建物名</label>
                <input type="text" class="form-control" v-model="editForm.BuildingName">
              </div>

              <div class="col-sm-6">
                <label class="form-label">階数</label>
                <input type="text" class="form-control" v-model="editForm.Floors">
              </div>

              <div class="col-sm-6">
                <label class="form-label">部屋数</label>
                <input type="text" class="form-control" v-model="editForm.Rooms">
              </div>

              <div class="col-sm-12"><hr><b>住所</b></div>

              <div class="col-sm-12">
                <div class="form-check form-check-inline">
                  <input class="form-check-input" type="radio" id="bm-addr-list" value="リストから選択" v-model="editForm.AddressSW">
                  <label class="form-check-label" for="bm-addr-list">リストから選択</label>
                </div>
                <div class="form-check form-check-inline">
                  <input class="form-check-input" type="radio" id="bm-addr-input" value="直接入力" v-model="editForm.AddressSW">
                  <label class="form-check-label" for="bm-addr-input">直接入力</label>
                </div>
              </div>

              <template v-if="editForm.AddressSW === '直接入力'">
                <div class="col-sm-4">
                  <label class="form-label">町名</label>
                  <select class="form-select" v-model="editForm.InputTownName">
                    <option value="" disabled>-選択-</option>
                    <option v-for="t in townOptions" :key="t" :value="t">{{ t }}</option>
                  </select>
                </div>
                <div class="col-sm-4">
                  <label class="form-label">番地</label>
                  <input type="text" class="form-control" v-model="editForm.InputCho">
                </div>
                <div class="col-sm-4">
                  <label class="form-label">号</label>
                  <input type="text" class="form-control" v-model="editForm.InputBanchi">
                </div>
              </template>
              <template v-else>
                <div class="col-sm-4">
                  <label class="form-label">町名</label>
                  <select class="form-select" v-model="editForm.CSVTownName" @change="onTownChange">
                    <option value="" disabled>-選択-</option>
                    <option v-for="t in townOptions" :key="t" :value="t">{{ t }}</option>
                  </select>
                </div>
                <div class="col-sm-4">
                  <label class="form-label">番地</label>
                  <select class="form-select" v-model="editForm.CSVCho" @change="onChoChange">
                    <option value="" disabled>-選択-</option>
                    <option v-for="c in choOptions" :key="c" :value="c">{{ c }}</option>
                  </select>
                </div>
                <div class="col-sm-4">
                  <label class="form-label">号</label>
                  <select class="form-select" v-model="editForm.CSVBanchi" @change="onBanchiChange">
                    <option value="" disabled>-選択-</option>
                    <option v-for="b in banchiOptions" :key="b.Banchi" :value="b.Banchi">{{ b.Banchi }}</option>
                  </select>
                </div>
              </template>

              <div class="col-sm-12">
                <label class="form-label">緯度・経度</label>
                <div class="d-flex gap-1 mb-1">
                  <input class="form-control" v-model="editForm.CSVLat" placeholder="緯度　例）34.768660059488724">
                  <input class="form-control" v-model="editForm.CSVLng" placeholder="経度　例）135.59748150473885">
                </div>
                <div class="d-flex gap-2">
                  <button type="button" class="btn btn-sm btn-outline-secondary" @click="pasteClipboard">
                    <i class="fas fa-paste"></i> 貼り付け
                  </button>
                  <button type="button" class="btn btn-sm btn-outline-secondary" @click="openMapPicker">
                    <i class="fas fa-map-marker-alt"></i> 地図で指定
                  </button>
                </div>
                <div class="form-text">
                  Googleマップアプリで地点を長押し→座標をコピーし、[貼り付け]を押すと自動入力されます。
                </div>
              </div>

              <div class="col-sm-12"><hr><b>訪問可否</b></div>

              <div class="col-sm-3">
                <label class="form-label">可否</label>
                <select class="form-select" v-model="editForm.NGFlag" @change="onNgFlagChange">
                  <option v-for="n in NGStatus" :key="n" :value="n">{{ n }}</option>
                </select>
              </div>

              <template v-if="editForm.NGFlag === '不可'">
                <div class="col-sm-3">
                  <label class="form-label">記録日</label>
                  <input type="date" class="form-control" v-model="editForm.NGDate">
                </div>
                <div class="col-sm-3">
                  <label class="form-label">奉仕監督確認</label>
                  <select class="form-select" v-model="editForm.NGChecked">
                    <option v-for="c in NGCheckSels" :key="c" :value="c">{{ c }}</option>
                  </select>
                </div>
                <div class="col-sm-12">
                  <label class="form-label">説明</label>
                  <textarea class="form-control" rows="2" maxlength="128" v-model="editForm.NGComment"></textarea>
                </div>
              </template>

              <div class="col-sm-12">
                <label class="form-label">備考（Note）</label>
                <textarea class="form-control" rows="2" v-model="editForm.Note"></textarea>
              </div>

            </div>
            <p v-if="saveError" class="text-danger small mt-2 mb-0">{{ saveError }}</p>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" @click="closeModal">閉じる</button>
            <button class="btn btn-primary" @click="saveForm" :disabled="busy">
              {{ editMode === "edit" ? "更新" : "登録" }}
            </button>
          </div>

          <!-- 地図で地点を指定するミニマップ -->
          <div v-if="showMapPicker" class="map-picker-overlay">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <strong class="small">地図をクリックして地点を指定してください</strong>
              <button type="button" class="btn-close" @click="closeMapPicker"></button>
            </div>
            <div ref="pickerMapContainer" class="picker-map"></div>
            <div class="d-flex justify-content-end gap-2 mt-2">
              <button type="button" class="btn btn-sm btn-secondary" @click="closeMapPicker">キャンセル</button>
              <button type="button" class="btn btn-sm btn-primary" @click="confirmMapPicker">この地点に決定</button>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>

</template>

<script setup>
import { ref, onMounted, nextTick } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/store/authStore.js";
import {
  getBuildingMasterList,
  upsertBuildingMaster,
  deleteBuildingMaster,
  backfillBuildingMasterFromDetail,
  getKibanTowns,
  getKibanChoList,
  getKibanBanchiList,
  getKibanNearest,
} from "@/services/api.js";
import { buildingIconClass } from "@/utils/buildingIcons.js";
import { loadGoogleMaps, createMap, addMarker } from "@/services/maps.js";

const router    = useRouter();
const authStore = useAuthStore();

const loading = ref(true);
const busy    = ref(false);
const buildings = ref([]);

const showModal  = ref(false);
const editMode   = ref("add"); // 'add' | 'edit'
const editForm   = ref({});
const saveError  = ref("");

const BuildKinds = ["戸建て", "長屋", "アパート", "マンション", "オートロック", "寮", "店舗", "事務所", "工場", "倉庫", "各種施設", "駐車場", "空地", "空き家", "その他"];
const NGStatus    = ["可", "不可"];
const NGCheckSels = ["未確認", "確認済"];
const DEFAULT_MAP_CENTER = { lat: 35.6812, lng: 139.7671 };

function blankForm() {
  return {
    BuildingNo: null,
    BuildingCategory: "アパート",
    BuildingName: "",
    Floors: "",
    Rooms: "",
    CSVTownName: "", CSVCho: "", CSVBanchi: "", CSVLat: "", CSVLng: "",
    InputTownName: "", InputCho: "", InputBanchi: "",
    AddressSW: "リストから選択",
    Note: "",
    NGFlag: "可", NGDate: "", NGComment: "", NGSarvant: "", NGChecked: "未確認",
  };
}

async function fetchBuildings() {
  busy.value = true;
  try {
    const res = await getBuildingMasterList();
    if (res.status === "success") buildings.value = res.buildings;
  } catch (e) {
    console.error(e);
  } finally {
    busy.value = false;
    loading.value = false;
  }
}

async function runBackfill() {
  if (!confirm("既存の住戸データから建物マスタへ一括移行します。この操作は初回のみ実行してください。よろしいですか？")) return;
  busy.value = true;
  try {
    const res = await backfillBuildingMasterFromDetail();
    if (res.status === "success") {
      alert(`建物マスタへ ${res.buildingsCreated} 件の建物を作成しました（対象住戸 ${res.detailRowsLinked} 件）。`);
      await fetchBuildings();
    } else {
      alert(res.message || "移行に失敗しました");
    }
  } catch (e) {
    console.error(e);
    alert("移行に失敗しました");
  } finally {
    busy.value = false;
  }
}

// ---- 町名マスタ（kiban_master）由来のカスケード選択肢 ----
const townOptions = ref([]);
let townsLoaded = false;
const choOptions    = ref([]);
const banchiOptions = ref([]);

async function ensureTownsLoaded() {
  if (townsLoaded) return;
  townsLoaded = true;
  try {
    const res = await getKibanTowns();
    if (res.status === "success") townOptions.value = res.towns || [];
  } catch (e) {
    console.error("町名一覧の取得に失敗しました:", e);
  }
}

async function loadChoOptions(town) {
  choOptions.value = [];
  if (!town) return;
  try {
    const res = await getKibanChoList(town);
    if (res.status === "success") choOptions.value = res.choList || [];
  } catch (e) {
    console.error("番地一覧の取得に失敗しました:", e);
  }
}

async function loadBanchiOptions(town, cho) {
  banchiOptions.value = [];
  if (!town) return;
  try {
    const res = await getKibanBanchiList(town, cho);
    if (res.status === "success") banchiOptions.value = res.banchiList || [];
  } catch (e) {
    console.error("号一覧の取得に失敗しました:", e);
  }
}

async function onTownChange() {
  editForm.value.CSVCho    = "";
  editForm.value.CSVBanchi = "";
  await loadChoOptions(editForm.value.CSVTownName);
}
async function onChoChange() {
  editForm.value.CSVBanchi = "";
  await loadBanchiOptions(editForm.value.CSVTownName, editForm.value.CSVCho);
}
function onBanchiChange() {
  const b = banchiOptions.value.find(b => b.Banchi === editForm.value.CSVBanchi);
  if (b) {
    if (b.Lat != null) editForm.value.CSVLat = b.Lat;
    if (b.Lng != null) editForm.value.CSVLng = b.Lng;
  }
}

// NGFlagが「可」→「不可」に変わった時点で記録日・記録者を自動セットする
function onNgFlagChange() {
  if (editForm.value.NGFlag === "不可") {
    if (!editForm.value.NGDate) editForm.value.NGDate = new Date().toISOString().slice(0, 10);
    editForm.value.NGSarvant = authStore.userName;
    editForm.value.NGChecked = "未確認";
  }
}

// クリップボードの「緯度, 経度」形式（Googleマップの長押しコピー書式）を読み取る
async function pasteClipboard() {
  try {
    const text = (await navigator.clipboard.readText() || "").trim();
    const cleaned = text.replace(/^\(/, "").replace(/\)$/, "").trim();
    const commaIdx = cleaned.search(/,/);
    if (commaIdx !== -1) {
      editForm.value.CSVLat = cleaned.slice(0, commaIdx).trim();
      editForm.value.CSVLng = cleaned.slice(commaIdx + 1).trim();
    } else if (cleaned) {
      editForm.value.CSVLat = cleaned;
    }
  } catch (e) {
    alert("クリップボードから読み取れませんでした：" + e.message);
  }
}

// ---- 地図で地点を指定 ----
const showMapPicker = ref(false);
const pickerMapContainer = ref(null);
let pickerMapInstance = null;
let pickerMarker = null;

async function openMapPicker() {
  showMapPicker.value = true;
  await nextTick();
  try {
    await loadGoogleMaps();
    const center = (editForm.value.CSVLat && editForm.value.CSVLng)
      ? { lat: Number(editForm.value.CSVLat), lng: Number(editForm.value.CSVLng) }
      : DEFAULT_MAP_CENTER;
    pickerMapInstance = createMap(pickerMapContainer.value, center, 17);
    pickerMarker = addMarker(pickerMapInstance, center, "");
    pickerMapInstance.addListener("click", (e) => {
      pickerMarker.setPosition(e.latLng);
    });
  } catch (e) {
    console.error("地図の初期化に失敗しました:", e);
  }
}

async function confirmMapPicker() {
  if (pickerMarker) {
    const pos = pickerMarker.getPosition();
    editForm.value.CSVLat = pos.lat();
    editForm.value.CSVLng = pos.lng();
    try {
      const res = await getKibanNearest(pos.lat(), pos.lng());
      if (res.status === "success" && res.nearest) {
        editForm.value.AddressSW   = "リストから選択";
        editForm.value.CSVTownName = res.nearest.Town;
        editForm.value.CSVCho      = res.nearest.Cho;
        editForm.value.CSVBanchi   = res.nearest.Banchi;
        await ensureTownsLoaded();
        await loadChoOptions(editForm.value.CSVTownName);
        await loadBanchiOptions(editForm.value.CSVTownName, editForm.value.CSVCho);
      }
    } catch (e) {
      console.error("最寄り住所の取得に失敗しました:", e);
    }
  }
  closeMapPicker();
}

function closeMapPicker() {
  showMapPicker.value = false;
  pickerMapInstance = null;
  pickerMarker = null;
}

async function openAddModal() {
  editMode.value = "add";
  editForm.value = blankForm();
  saveError.value = "";
  showModal.value = true;
  await ensureTownsLoaded();
}

async function openEditModal(b) {
  editMode.value = "edit";
  editForm.value = { ...b };
  saveError.value = "";
  showModal.value = true;
  await ensureTownsLoaded();
  if (editForm.value.CSVTownName) await loadChoOptions(editForm.value.CSVTownName);
  if (editForm.value.CSVTownName && editForm.value.CSVCho) await loadBanchiOptions(editForm.value.CSVTownName, editForm.value.CSVCho);
}

function closeModal() {
  showModal.value = false;
  closeMapPicker();
}

async function saveForm() {
  busy.value = true;
  saveError.value = "";
  try {
    const res = await upsertBuildingMaster(editForm.value);
    if (res.status === "success") {
      showModal.value = false;
      await fetchBuildings();
    } else {
      saveError.value = res.message || "保存に失敗しました";
    }
  } catch (e) {
    console.error(e);
    saveError.value = e.message || "保存に失敗しました";
  } finally {
    busy.value = false;
  }
}

async function deleteRow(b) {
  if (!confirm(`建物番号: ${b.BuildingNo} ${b.BuildingName || ""} を削除しますか？`)) return;
  busy.value = true;
  try {
    await deleteBuildingMaster(b.BuildingNo);
    await fetchBuildings();
  } catch (e) {
    console.error(e);
    alert("削除に失敗しました");
  } finally {
    busy.value = false;
  }
}

onMounted(fetchBuildings);
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

.modal-backdrop-custom {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  z-index: 1040;
}

.modal-content {
  position: relative;
}
.map-picker-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.98);
  z-index: 20;
  padding: 12px;
  display: flex;
  flex-direction: column;
}
.picker-map {
  flex: 1;
  min-height: 260px;
}
</style>
