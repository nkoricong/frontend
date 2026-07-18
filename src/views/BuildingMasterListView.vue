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
      <button class="btn btn-outline-secondary" @click="downloadCsvFormat">
        <i class="fas fa-file-alt"></i> CSVフォーマットのダウンロード
      </button>
      <button class="btn btn-outline-secondary" @click="exportCsv" :disabled="buildings.length === 0">
        <i class="fas fa-file-export"></i> CSVエクスポート
      </button>
      <button class="btn btn-outline-secondary" @click="openImportModal" :disabled="busy">
        <i class="fas fa-file-import"></i> CSVインポート
      </button>
      <button class="btn btn-outline-secondary" @click="fetchBuildings" :disabled="busy">
        <i class="fas fa-redo"></i> 再読み込み
      </button>
      <button class="btn btn-primary" @click="openAddModal" :disabled="busy">
        <i class="fas fa-plus-circle"></i> 建物の追加
      </button>
    </div>

    <!-- 初回のみ：detailテーブルの建物情報を建物マスタへ移行 -->
    <div v-if="!loading && buildings.length === 0" class="px-2 mb-3">
      <div class="alert alert-warning">
        <div class="d-flex justify-content-between align-items-center">
          <span v-if="!backfillRunning">建物マスタがまだ空です。既存の住戸データから建物情報を移行できます。</span>
          <span v-else-if="backfillPhase === 'fetch'">住戸データを取得中... （{{ backfillProgress }}件処理済み）</span>
          <span v-else>建物マスタへ書き込み中... （{{ backfillProgress }} / {{ backfillTotal }} 件）</span>
          <button class="btn btn-warning" @click="runBackfill" :disabled="busy">
            初回のみ：住戸データから移行
          </button>
        </div>
        <div v-if="backfillRunning" class="progress mt-2" style="height:6px;">
          <div class="progress-bar" role="progressbar" style="width:100%"></div>
        </div>
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

  <!-- CSVインポートモーダル（#103） -->
  <div v-if="showImportModal">
    <div class="modal-backdrop-custom" @click="closeImportModal"></div>
    <div class="modal d-block" tabindex="-1">
      <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">建物マスタのCSVインポート</h5>
            <button type="button" class="btn-close" @click="closeImportModal"></button>
          </div>

          <div class="modal-body">
            <p class="text-muted small mb-2">
              「CSVフォーマットのダウンロード」で取得したCSVと同じ列構成のファイルを選択してください。
              BuildingNo列が空欄の行は新規追加、既存の建物マスタに存在するBuildingNoが入力された行はその建物を上書き更新します。
            </p>
            <input type="file" class="form-control" accept=".csv" @change="onImportFileChange">
            <p v-if="importParseMessage" class="mt-2 mb-0 small">{{ importParseMessage }}</p>

            <div v-if="importRows.length > 0" class="table-responsive mt-3">
              <p class="small text-muted mb-1">プレビュー（先頭{{ importPreviewRows.length }}件 / 全{{ importRows.length }}件）</p>
              <table class="table table-sm table-bordered">
                <thead>
                  <tr>
                    <th>BuildingNo</th>
                    <th>建物種別</th>
                    <th>建物名</th>
                    <th>住所</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, idx) in importPreviewRows" :key="idx">
                    <td>{{ row.BuildingNo || "（新規）" }}</td>
                    <td>{{ row.BuildingCategory }}</td>
                    <td>{{ row.BuildingName }}</td>
                    <td class="small">
                      <span v-if="row.AddressSW === '直接入力'">{{ row.InputTownName }}{{ row.InputCho }}{{ row.InputBanchi }}</span>
                      <span v-else>{{ row.CSVTownName }}{{ row.CSVCho }}{{ row.CSVBanchi }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p v-if="importResultMessage" class="small mt-2 mb-0" :class="importResultOk ? 'text-success' : 'text-danger'">{{ importResultMessage }}</p>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" @click="closeImportModal">閉じる</button>
            <button class="btn btn-primary" :disabled="importRows.length === 0 || importing" @click="runCsvImport">
              <span v-if="importing"><i class="fas fa-spinner fa-spin"></i> インポート中...（{{ importedCount }} / {{ importRows.length }}件）</span>
              <span v-else>インポート実行</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

</template>

<script setup>
import { ref, computed, onMounted, nextTick } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/store/authStore.js";
import {
  getBuildingMasterList,
  upsertBuildingMaster,
  deleteBuildingMaster,
  fetchDetailBuildingPage,
  commitBuildingMasterBackfill,
  getKibanTowns,
  getKibanChoList,
  getKibanBanchiList,
  getKibanNearest,
} from "@/services/api.js";
import { buildingIconClass } from "@/utils/buildingIcons.js";
import { loadGoogleMaps, createMap, addMarker } from "@/services/maps.js";
import { resolveMapCenter } from "@/services/mapCenter.js";
import { buildCsv, downloadCsv, parseCsvWithHeader } from "@/utils/csv.js";

const router    = useRouter();
const authStore = useAuthStore();

const loading = ref(true);
const busy    = ref(false);
const buildings = ref([]);

const showModal  = ref(false);
const editMode   = ref("add"); // 'add' | 'edit'
const editForm   = ref({});
const saveError  = ref("");

const backfillRunning  = ref(false);
const backfillPhase    = ref(""); // "fetch" | "commit"
const backfillProgress = ref(0);
const backfillTotal    = ref(0);
const BACKFILL_PAGE_SIZE = 300;
const COMMIT_CHUNK_SIZE  = 50; // 1回のcommit呼び出しで書き込む建物グループ数

const BuildKinds = ["戸建て", "長屋", "アパート", "マンション", "オートロック", "寮", "店舗", "事務所", "工場", "倉庫", "各種施設", "駐車場", "空地", "空き家", "その他"];
const NGStatus    = ["可", "不可"];
const NGCheckSels = ["未確認", "確認済"];

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

// 「戸建て」や建物名未入力の住戸は、複数住戸で共有される「建物」の概念に
// 該当しないため、building_master への集約対象から除外する（バックエンドの
// buildingMasterBackfillService.js の dedupeKey と同じ判定・キー構成）。
function backfillDedupeKey(d) {
  if (!d.BuildingName || d.BuildingCategory === "戸建て") return null;
  return [
    d.BuildingCategory, d.BuildingName, d.Floors, d.Rooms,
    d.AddressSW, d.CSVTownName, d.CSVCho, d.CSVBanchi,
    d.InputTownName, d.InputCho, d.InputBanchi,
  ].join("|");
}

async function runBackfill() {
  if (!confirm("既存の住戸データから建物マスタへ一括移行します。この操作は初回のみ実行してください。よろしいですか？")) return;

  // 二重実行防止：実行直前に建物マスタが本当に空か確認する
  const preCheck = await getBuildingMasterList();
  if (preCheck.status === "success" && preCheck.buildings.length > 0) {
    alert("建物マスタに既にデータが存在するため、中断しました。");
    await fetchBuildings();
    return;
  }

  busy.value = true;
  backfillRunning.value = true;
  backfillPhase.value = "fetch";
  backfillProgress.value = 0;
  try {
    // detailを少数ずつページングして取得・復号する（1回のWorker呼び出しあたりの
    // 復号量を抑えるため）。重複排除・グルーピングは復号済みの値でフロント側が行う。
    // offsetではなくDetailID(row_id)によるカーソル方式でページングする
    // （offset方式はページが深くなるほどcrawlが遅くなり、タイムアウトの原因になるため）。
    const groups = new Map(); // key -> { rowIds: number[], data }
    let afterRowId = 0;
    let processedCount = 0;
    while (true) {
      const res = await fetchDetailBuildingPage(afterRowId, BACKFILL_PAGE_SIZE);
      if (res.status !== "success") {
        alert(res.message || "移行に失敗しました");
        return;
      }
      for (const d of res.rows) {
        const key = backfillDedupeKey(d);
        if (!key) continue;
        if (!groups.has(key)) groups.set(key, { rowIds: [], data: d });
        groups.get(key).rowIds.push(d.DetailID);
      }
      processedCount += res.rows.length;
      afterRowId = res.lastRowId;
      backfillProgress.value = processedCount;
      if (!res.hasMore) break;
    }

    const buildingGroups = [...groups.values()].map(({ rowIds, data }) => ({
      rowIds,
      payload: {
        BuildingCategory: data.BuildingCategory,
        BuildingName:     data.BuildingName,
        Floors:           data.Floors,
        Rooms:            data.Rooms,
        CSVTownName:      data.CSVTownName,
        CSVCho:           data.CSVCho,
        CSVBanchi:        data.CSVBanchi,
        CSVLat:           data.CSVLat,
        CSVLng:           data.CSVLng,
        InputTownName:    data.InputTownName,
        InputCho:         data.InputCho,
        InputBanchi:      data.InputBanchi,
        AddressSW:        data.AddressSW,
      },
    }));

    // 建物グループ数が多い環境でも1回のWorker呼び出しあたりの書き込み量を
    // 一定に保つため、フロント側で数十グループ単位に分割してcommitを繰り返す。
    backfillPhase.value = "commit";
    backfillProgress.value = 0;
    backfillTotal.value = buildingGroups.length;
    let buildingsCreated = 0;
    let detailRowsLinked = 0;
    for (let i = 0; i < buildingGroups.length; i += COMMIT_CHUNK_SIZE) {
      const chunk = buildingGroups.slice(i, i + COMMIT_CHUNK_SIZE);
      const commitRes = await commitBuildingMasterBackfill(chunk);
      if (commitRes.status !== "success") {
        alert(`${commitRes.message || "移行に失敗しました"}（建物 ${buildingsCreated}件まで完了）`);
        return;
      }
      buildingsCreated += commitRes.buildingsCreated;
      detailRowsLinked += commitRes.detailRowsLinked;
      backfillProgress.value += chunk.length;
    }

    alert(`建物マスタへ ${buildingsCreated} 件の建物を作成しました（対象住戸 ${detailRowsLinked} 件）。`);
    await fetchBuildings();
  } catch (e) {
    console.error(e);
    alert("移行に失敗しました");
  } finally {
    busy.value = false;
    backfillRunning.value = false;
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
    const center = await resolveMapCenter(editForm.value, banchiOptions.value);
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

// ---- CSVインポート／エクスポート（#103） ----
// エクスポート／インポートの列構成。順序がそのままCSVの列順・ヘッダー名になる。
// これはbuildingMasterService.jsのtoBuilding()が公開する項目と完全に一致する
// （detailテーブルと異なり隠れた集計項目が無いため、上書き更新でも取りこぼしがない）。
const CSV_COLUMNS = [
  "BuildingNo", "BuildingCategory", "BuildingName", "Floors", "Rooms",
  "AddressSW", "CSVTownName", "CSVCho", "CSVBanchi", "InputTownName", "InputCho", "InputBanchi", "CSVLat", "CSVLng",
  "NGFlag", "NGDate", "NGComment", "NGSarvant", "NGChecked", "Note",
];

function downloadCsvFormat() {
  downloadCsv(buildCsv(CSV_COLUMNS, []), "建物マスタCSVフォーマット.csv");
}

function exportCsv() {
  downloadCsv(buildCsv(CSV_COLUMNS, buildings.value), "建物マスタ.csv");
}

const showImportModal     = ref(false);
const importRows          = ref([]);
const importParseMessage  = ref("");
const importing           = ref(false);
const importedCount       = ref(0);
const importResultMessage = ref("");
const importResultOk      = ref(false);

const importPreviewRows = computed(() => importRows.value.slice(0, 10));

function openImportModal() {
  showImportModal.value     = true;
  importRows.value          = [];
  importParseMessage.value  = "";
  importResultMessage.value = "";
}

function closeImportModal() {
  showImportModal.value = false;
}

async function onImportFileChange(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = ""; // 同じファイルを選び直しても change が発火するようにする
  if (!file) return;

  importResultMessage.value = "";
  try {
    const text = await file.text();
    const rows = parseCsvWithHeader(text);
    importRows.value = rows;
    importParseMessage.value = rows.length > 0
      ? `${rows.length}件のデータを読み込みました。内容を確認して「インポート実行」を押してください。`
      : "有効なデータ行が見つかりませんでした。ヘッダー行と列構成を確認してください。";
  } catch (e) {
    console.error(e);
    importRows.value = [];
    importParseMessage.value = "ファイルの読み込みに失敗しました。";
  }
}

async function runCsvImport() {
  if (importRows.value.length === 0) return;

  // 既存の建物マスタに存在しないBuildingNoが指定されている行がないか、実行前にまとめて検証する
  const existingNos = new Set(buildings.value.map(b => b.BuildingNo));
  const invalidRow = importRows.value.find(row => row.BuildingNo && !existingNos.has(Number(row.BuildingNo)));
  if (invalidRow) {
    importResultOk.value = false;
    importResultMessage.value = `BuildingNo "${invalidRow.BuildingNo}" は建物マスタに存在しません。エクスポートしたCSVを元に編集してからインポートしてください。`;
    return;
  }

  if (!confirm(`${importRows.value.length}件をインポートします。BuildingNo列が空欄の行は新規追加、指定された行は上書き更新されます。よろしいですか？`)) return;

  importing.value = true;
  importedCount.value = 0;
  importResultMessage.value = "";
  try {
    for (const row of importRows.value) {
      const payload = { BuildingNo: row.BuildingNo ? Number(row.BuildingNo) : null };
      for (const col of CSV_COLUMNS) {
        if (col === "BuildingNo") continue;
        payload[col] = row[col] ?? "";
      }

      const res = await upsertBuildingMaster(payload);
      if (res.status !== "success") {
        throw new Error(res.message || `${importedCount.value + 1}行目でエラーが発生しました`);
      }
      importedCount.value++;
    }

    importResultOk.value = true;
    importResultMessage.value = `インポートが完了しました。（${importedCount.value}件）`;
    importRows.value = [];
    await fetchBuildings();
  } catch (e) {
    console.error(e);
    importResultOk.value = false;
    importResultMessage.value = e.message || `インポートに失敗しました（${importedCount.value}件まで完了）。`;
  } finally {
    importing.value = false;
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
