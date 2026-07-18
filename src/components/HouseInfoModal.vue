<template>
  <div
    class="modal fade"
    :class="{ show: modelValue }"
    :style="modelValue ? 'display:block' : 'display:none'"
    tabindex="-1"
    role="dialog"
    @click.self="close"
  >
    <div class="modal-dialog modal-lg modal-dialog-scrollable" role="document">
      <div class="modal-content" v-if="form">

        <div class="modal-header">
          <h5 class="modal-title">住戸情報の表示・編集</h5>
          <button type="button" class="btn-close" @click="close"></button>
        </div>

        <div class="modal-body">
          <div class="row g-2">

            <div class="col-12"><h6 class="text-muted">基本情報</h6></div>

            <div class="col-3 col-form-label small">お名前</div>
            <div class="col-9">
              <input class="form-control form-control-sm" v-model="form.FamilyName" :disabled="readOnly" placeholder="( 表札名なし )" />
            </div>

            <div class="col-3 col-form-label small">若い世代</div>
            <div class="col-9">
              <select class="form-select form-select-sm" v-model="form.YoungerGENFlag" :disabled="readOnly">
                <option v-for="opt in YOUNGER_GEN_OPTIONS" :key="opt" :value="opt">{{ opt }}</option>
              </select>
            </div>

            <div class="col-3 col-form-label small">住所の入力方法</div>
            <div class="col-9">
              <div class="form-check form-check-inline">
                <input class="form-check-input" type="radio" id="addr-sw-list" value="リストから選択" v-model="form.AddressSW" :disabled="readOnly">
                <label class="form-check-label small" for="addr-sw-list">リストから選択</label>
              </div>
              <div class="form-check form-check-inline">
                <input class="form-check-input" type="radio" id="addr-sw-input" value="直接入力" v-model="form.AddressSW" :disabled="readOnly">
                <label class="form-check-label small" for="addr-sw-input">直接入力</label>
              </div>
            </div>

            <template v-if="form.AddressSW === '直接入力'">
              <div class="col-3 col-form-label small">町名</div>
              <div class="col-9">
                <select class="form-select form-select-sm" v-model="form.InputTownName" :disabled="readOnly">
                  <option value="" disabled>-選択-</option>
                  <option v-for="t in townOptions" :key="t" :value="t">{{ t }}</option>
                </select>
              </div>
              <div class="col-3 col-form-label small">番地</div>
              <div class="col-9">
                <input class="form-control form-control-sm" v-model="form.InputCho" :disabled="readOnly" />
              </div>
              <div class="col-3 col-form-label small">住居番号</div>
              <div class="col-9">
                <input class="form-control form-control-sm" v-model="form.InputBanchi" :disabled="readOnly" />
              </div>
            </template>
            <template v-else>
              <div class="col-3 col-form-label small">町名</div>
              <div class="col-9">
                <select class="form-select form-select-sm" v-model="form.CSVTownName" :disabled="readOnly" @change="onTownChange">
                  <option value="" disabled>-選択-</option>
                  <option v-for="t in townOptions" :key="t" :value="t">{{ t }}</option>
                </select>
              </div>
              <div class="col-3 col-form-label small">番地</div>
              <div class="col-9">
                <select class="form-select form-select-sm" v-model="form.CSVCho" :disabled="readOnly" @change="onChoChange">
                  <option value="" disabled>-選択-</option>
                  <option v-for="c in choOptions" :key="c" :value="c">{{ c }}</option>
                </select>
              </div>
              <div class="col-3 col-form-label small">住居番号</div>
              <div class="col-9">
                <select class="form-select form-select-sm" v-model="form.CSVBanchi" :disabled="readOnly" @change="onBanchiChange">
                  <option value="" disabled>-選択-</option>
                  <option v-for="b in banchiOptions" :key="b.Banchi" :value="b.Banchi">{{ b.Banchi }}</option>
                </select>
                <div class="form-text">{{ csvAddressDisplay }}</div>
              </div>
            </template>

            <div class="col-3 col-form-label small">建物種別</div>
            <div class="col-9 d-flex align-items-center gap-2">
              <i v-if="buildingIconClass(form.BuildingCategory)" class="fas text-secondary" :class="buildingIconClass(form.BuildingCategory)"></i>
              <select class="form-select form-select-sm" v-model="form.BuildingCategory" :disabled="readOnly">
                <option v-for="opt in BUILD_KINDS" :key="opt" :value="opt">{{ opt }}</option>
              </select>
            </div>

            <template v-if="form.BuildingCategory !== '戸建て'">
              <div class="col-3 col-form-label small">建物名</div>
              <div class="col-9">
                <input class="form-control form-control-sm" v-model="form.BuildingName" :disabled="readOnly" />
              </div>
              <div class="col-3 col-form-label small">部屋番号</div>
              <div class="col-9">
                <input class="form-control form-control-sm" v-model="form.RoomNo" :disabled="readOnly" />
              </div>
            </template>

            <div class="col-3 col-form-label small">緯度・経度</div>
            <div class="col-9">
              <div class="d-flex gap-1 mb-1">
                <input class="form-control form-control-sm" v-model="form.CSVLat" :disabled="readOnly" placeholder="緯度　例）34.768660059488724" />
                <input class="form-control form-control-sm" v-model="form.CSVLng" :disabled="readOnly" placeholder="経度　例）135.59748150473885" />
              </div>
              <div v-if="!readOnly" class="d-flex gap-2">
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

            <div class="col-12"><hr /></div>
            <div class="col-12"><h6 class="text-muted">電話</h6></div>

            <div class="col-3 col-form-label small">電話番号</div>
            <div class="col-9">
              <input class="form-control form-control-sm" v-model="form.TEL" :disabled="readOnly" placeholder="例）072-800-0000" />
            </div>
            <div class="col-3 col-form-label small">情報源</div>
            <div class="col-9">
              <select class="form-select form-select-sm" v-model="form.TELSource" :disabled="readOnly">
                <option v-for="opt in TEL_SOURCE_KINDS" :key="opt" :value="opt">{{ opt }}</option>
              </select>
            </div>
            <div class="col-3 col-form-label small">取得日</div>
            <div class="col-9">
              <input type="date" class="form-control form-control-sm" v-model="form.TELUpdateDate" :disabled="readOnly" />
            </div>

            <div class="col-12"><hr /></div>

            <div class="col-3 col-form-label small">訪問可否</div>
            <div class="col-9">
              <select class="form-select form-select-sm" v-model="form.NGFlag" :disabled="readOnly" @change="onNgFlagChange">
                <option v-for="opt in NG_FLAG_OPTIONS" :key="opt" :value="opt">{{ opt }}</option>
              </select>
            </div>
            <template v-if="form.NGFlag === '不可'">
              <div class="col-3 col-form-label small">記録日</div>
              <div class="col-9">
                <input type="date" class="form-control form-control-sm" v-model="form.NGDate" :disabled="readOnly" />
              </div>
              <div class="col-3 col-form-label small">訪問不可説明</div>
              <div class="col-9">
                <textarea class="form-control form-control-sm" v-model="form.NGComment" :disabled="readOnly" rows="2" maxlength="128"></textarea>
              </div>
              <div class="col-3 col-form-label small">奉仕監督確認</div>
              <div class="col-9">
                <select class="form-select form-select-sm" v-model="form.NGChecked" :disabled="readOnly">
                  <option v-for="opt in NG_CHECK_OPTIONS" :key="opt" :value="opt">{{ opt }}</option>
                </select>
              </div>
            </template>

            <div class="col-3 col-form-label small">チェック結果</div>
            <div class="col-9">
              <span v-if="form.BadFlag === 'Bad'" class="text-danger"><i class="fas fa-exclamation-triangle"></i> 要確認</span>
              <span v-else-if="form.BadFlag === 'Good'" class="text-success"><i class="fas fa-check-circle"></i> チェック済</span>
              <span v-else class="text-muted">未確認</span>
            </div>

            <div class="col-3 col-form-label small">備考</div>
            <div class="col-9">
              <textarea class="form-control form-control-sm" v-model="form.Description" :disabled="readOnly" rows="2"></textarea>
            </div>

          </div>

          <p v-if="readOnly" class="text-muted small mt-2">
            <i class="fas fa-plane"></i> オフラインで保存したデータを表示しています。編集はネット接続時のみ行えます。
          </p>
          <p v-if="saveError" class="text-danger small mt-2">{{ saveError }}</p>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="close">閉じる</button>
          <button v-if="!readOnly" class="btn btn-primary" @click="save" :disabled="saving">
            <span v-if="saving"><i class="fas fa-spinner fa-spin"></i> 保存中...</span>
            <span v-else><i class="fas fa-save"></i> 保存</span>
          </button>
        </div>

        <!-- 地図で地点を指定するミニマップ（緯度経度欄の[地図で指定]から開く） -->
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
  <div v-if="modelValue" class="modal-backdrop fade show"></div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from "vue";
import { upsertDetail, getKibanTowns, getKibanChoList, getKibanBanchiList, getKibanNearest } from "@/services/api.js";
import { useAuthStore } from "@/store/authStore.js";
import { buildingIconClass } from "@/utils/buildingIcons.js";
import { loadGoogleMaps, createMap, addMarker } from "@/services/maps.js";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  house:      { type: Object, default: null },
  // オフライン（未ログインでのキャッシュ閲覧含む）で開いている場合は表示のみとし、保存はさせない
  readOnly:   { type: Boolean, default: false },
});

const emit = defineEmits(["update:modelValue", "saved"]);

const authStore = useAuthStore();

// ORIGINAL/ChildMap.html・EditDetailList.html のBuildKinds/TelSourceKindsを踏襲
const BUILD_KINDS = [
  "戸建て", "長屋", "アパート", "マンション", "オートロック", "寮",
  "店舗", "事務所", "工場", "倉庫", "各種施設", "駐車場", "空地", "空き家", "その他",
];
const TEL_SOURCE_KINDS = [
  "-選択-", "ハローページ", "タウンページ", "公式ウェブサイト", "民間の情報サイト等",
  "看板・掲示物", "チラシ・広告", "公式情報", "官公庁/公共団体の公開情報",
  "直接入手", "未確認", "過去リストから移行", "その他",
];
const YOUNGER_GEN_OPTIONS = ["若い世代に会えた", "若い世代と推定", "一般", "未確認"];
const NG_FLAG_OPTIONS  = ["可", "不可"];
const NG_CHECK_OPTIONS = ["未確認", "確認済"];
const DEFAULT_MAP_CENTER = { lat: 35.6812, lng: 139.7671 };

const form       = ref(null);
const saving     = ref(false);
const saveError  = ref("");

// 町名マスタ（kiban_master）由来のカスケード選択肢（「リストから選択」用）。
// 町名一覧はデータ量が少なく変化も稀なため全モーダルで使い回し、
// 番地・号は選択のたびに該当分だけをバックエンドから取得する（町単位で数万件になるため）。
const townOptions = ref([]);
let townsLoaded = false;

const choOptions    = ref([]); // 選択中の町名に属する番地一覧
const banchiOptions = ref([]); // [{ Banchi, Lat, Lng }] 選択中の番地に属する号一覧

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
  form.value.CSVCho    = "";
  form.value.CSVBanchi = "";
  await loadChoOptions(form.value.CSVTownName);
}
async function onChoChange() {
  form.value.CSVBanchi = "";
  await loadBanchiOptions(form.value.CSVTownName, form.value.CSVCho);
}
function onBanchiChange() {
  const b = banchiOptions.value.find(b => b.Banchi === form.value.CSVBanchi);
  if (b) {
    if (b.Lat != null) form.value.CSVLat = b.Lat;
    if (b.Lng != null) form.value.CSVLng = b.Lng;
  }
}

watch(() => props.modelValue, async (open) => {
  if (open && props.house) {
    form.value = { ...props.house };
    if (!form.value.AddressSW) form.value.AddressSW = "リストから選択";
    if (!form.value.NGFlag) form.value.NGFlag = "可";
    saveError.value = "";
    if (!props.readOnly) {
      await ensureTownsLoaded();
      // 既存の選択値を編集する場合、カスケードの続きの選択肢もあわせて読み込んでおく
      if (form.value.CSVTownName) await loadChoOptions(form.value.CSVTownName);
      if (form.value.CSVTownName && form.value.CSVCho) await loadBanchiOptions(form.value.CSVTownName, form.value.CSVCho);
    }
  } else if (!open) {
    closeMapPicker();
  }
});

const csvAddressDisplay = computed(() => {
  if (!form.value) return "";
  return `${form.value.CSVTownName ?? ""}${form.value.CSVCho ?? ""}-${form.value.CSVBanchi ?? ""}`;
});

// NGFlagが「可」→「不可」に変わった時点（新規のNG登録）に、
// 記録日・記録者・奉仕監督確認状態を自動セットする
function onNgFlagChange() {
  if (form.value.NGFlag === "不可") {
    if (!form.value.NGDate) form.value.NGDate = new Date().toISOString().slice(0, 10);
    form.value.NGSarvant = authStore.userName;
    form.value.NGChecked = "未確認";
  }
}

// クリップボードから「緯度, 経度」形式の文字列を読み取り緯度経度欄に反映する
// （Googleマップアプリで地点を長押しコピーした際の書式。前後の括弧は許容する）
async function pasteClipboard() {
  try {
    const text = (await navigator.clipboard.readText() || "").trim();
    const cleaned = text.replace(/^\(/, "").replace(/\)$/, "").trim();
    const commaIdx = cleaned.search(/,/);
    if (commaIdx !== -1) {
      form.value.CSVLat = cleaned.slice(0, commaIdx).trim();
      form.value.CSVLng = cleaned.slice(commaIdx + 1).trim();
    } else if (cleaned) {
      form.value.CSVLat = cleaned;
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
    const center = (form.value.CSVLat && form.value.CSVLng)
      ? { lat: Number(form.value.CSVLat), lng: Number(form.value.CSVLng) }
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
    form.value.CSVLat = pos.lat();
    form.value.CSVLng = pos.lng();
    // ピン確定地点に最も近い町名マスタの住所を自動セットする（#97）
    try {
      const res = await getKibanNearest(pos.lat(), pos.lng());
      if (res.status === "success" && res.nearest) {
        form.value.AddressSW    = "リストから選択";
        form.value.CSVTownName  = res.nearest.Town;
        form.value.CSVCho       = res.nearest.Cho;
        form.value.CSVBanchi    = res.nearest.Banchi;
        await ensureTownsLoaded();
        await loadChoOptions(form.value.CSVTownName);
        await loadBanchiOptions(form.value.CSVTownName, form.value.CSVCho);
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

function close() {
  if (saving.value) return;
  emit("update:modelValue", false);
}

async function save() {
  if (!form.value) return;
  saving.value    = true;
  saveError.value = "";
  try {
    const payload = { ...form.value };
    const res = await upsertDetail(payload);
    if (res.status === "success") {
      emit("saved", payload);
      emit("update:modelValue", false);
    } else {
      saveError.value = res.message || "保存に失敗しました";
    }
  } catch (e) {
    saveError.value = e.message;
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
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
