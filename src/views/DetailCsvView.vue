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
        <div class="text-center flex-grow-1">
          <p class="mb-0">[ユーザー名]<br />{{ authStore.userName }}<br />({{ authStore.userGroup }})</p>
        </div>
        <div>
          <button class="btn btn-link p-0 text-center" @click="router.push({ name: 'mainMenu' })">
            <i class="fas fa-home fa-2x"></i>
            <div class="small">ホーム</div>
          </button>
        </div>
      </div>
    </header>

    <div class="text-center my-4">
      <h2><i class="fas fa-file-csv"></i> 住戸リストのCSV入出力</h2>
    </div>

    <div class="alert alert-secondary small">
      住戸情報（detail）のCSVインポート・エクスポートを行います。件数が多い場合、時間がかかることがあります。<br>
      旧アプリ（GAS版）からのCSVは、そのまま取り込むことができます（内部で自動的に暗号方式を変換します）。<br>
      「総入替」モードは既存の住戸データを全て削除してからCSVの内容で置き換える破壊的な操作です。実行前に確認が入ります。
    </div>

    <div class="d-flex justify-content-center mb-3">
      <CsvImportExportPanel
        title="住戸リスト"
        :columns="CSV_COLUMNS"
        :legacy-columns="LEGACY_CSV_COLUMNS"
        :has-legacy-format="true"
        :import-modes="IMPORT_MODES"
        :before-import="handleBeforeImport"
        :batch-size="10"
        format-template-filename="住戸リストCSVフォーマット.csv"
        export-filename="住戸リスト.csv"
        :export-rows="exportCsvRows"
        :import-batch="importCsvBatch"
        @imported="resetList"
      />
    </div>

    <!-- 絞込 -->
    <div class="row g-2 align-items-end mb-3">
      <div class="col-6 col-md-2">
        <label class="form-label small mb-0">区域番号</label>
        <input type="text" class="form-control" v-model="cardNoInput" placeholder="例）011" />
      </div>
      <div class="col-6 col-md-2">
        <label class="form-label small mb-0">子カード番号</label>
        <input type="text" class="form-control" v-model="childNoInput" placeholder="例）11" />
      </div>
      <div class="col-6 col-md-3">
        <label class="form-label small mb-0">町名</label>
        <select class="form-select" v-model="selectedTown">
          <option value="">全て</option>
          <option v-for="t in townOptions" :key="t" :value="t">{{ t }}</option>
        </select>
      </div>
      <div class="col-6 col-md-3">
        <label class="form-label small mb-0">エリア</label>
        <select class="form-select" v-model="selectedArea">
          <option value="">全て</option>
          <option v-for="a in areaOptions" :key="a" :value="a">{{ a }}</option>
        </select>
      </div>
      <div class="col-12 col-md-2 text-md-end">
        <button class="btn btn-primary w-100" @click="resetList">
          <i class="fas fa-search"></i> 絞り込む
        </button>
      </div>
    </div>

    <!-- 一覧 -->
    <div class="table-responsive">
      <table class="table table-sm table-striped align-middle">
        <thead class="table-secondary">
          <tr>
            <th>区域番号</th>
            <th>子カード番号</th>
            <th>住戸番号</th>
            <th>建物名</th>
            <th>部屋番号</th>
            <th>家族名</th>
            <th>電話</th>
            <th>状態</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.row_id">
            <td>{{ r.card_no }}</td>
            <td>{{ r.child_no }}</td>
            <td>{{ r.housing_no }}</td>
            <td>{{ r.building_name }}</td>
            <td>{{ r.room_no }}</td>
            <td>{{ r.family_name }}</td>
            <td>{{ r.tel }}</td>
            <td>{{ r.visit_status }}</td>
          </tr>
          <tr v-if="rows.length === 0 && !loadingList">
            <td colspan="8" class="text-center text-muted py-4">該当する住戸がありません</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="text-center my-3">
      <div v-if="loadingList"><i class="fas fa-spinner fa-spin"></i> 読み込み中...</div>
      <button v-else-if="hasMore" class="btn btn-outline-secondary" @click="loadMore">
        さらに読み込む
      </button>
    </div>

  </main>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/store/authStore.js";
import {
  getCardList, getDetailListPage, importDetailBatch, clearDetailAll,
} from "@/services/api.js";
import CsvImportExportPanel from "@/components/CsvImportExportPanel.vue";

const router    = useRouter();
const authStore = useAuthStore();

// ---- 区域カード（絞込の町名/エリア選択肢、区域番号→エリア/町名の照合用） ----
const cards = ref([]);

const townOptions = computed(() => [...new Set(cards.value.map(c => c.TownName).filter(Boolean))].sort());
const areaOptions  = computed(() => [...new Set(cards.value.map(c => c.Area).filter(Boolean))].sort());

// ---- 絞込 ----
const cardNoInput  = ref("");
const childNoInput = ref("");
const selectedTown = ref("");
const selectedArea = ref("");

const filters = computed(() => {
  let cardNos;
  if (cardNoInput.value.trim()) {
    cardNos = [cardNoInput.value.trim()];
  } else if (selectedTown.value || selectedArea.value) {
    cardNos = cards.value
      .filter(c => (!selectedTown.value || c.TownName === selectedTown.value) && (!selectedArea.value || c.Area === selectedArea.value))
      .map(c => c.CardNo);
  }
  return { cardNos, childNo: childNoInput.value.trim() || undefined };
});

// ---- 一覧（キーセットページング） ----
const rows        = ref([]);
const afterRowId   = ref(0);
const hasMore      = ref(false);
const loadingList  = ref(false);
const LIST_PAGE_SIZE = 200;

async function resetList() {
  rows.value      = [];
  afterRowId.value = 0;
  hasMore.value    = false;
  await loadMore();
}

async function loadMore() {
  loadingList.value = true;
  try {
    const res = await getDetailListPage(filters.value, afterRowId.value, LIST_PAGE_SIZE);
    if (res.status === "success") {
      rows.value.push(...(res.rows || []));
      afterRowId.value = res.lastRowId;
      hasMore.value    = res.hasMore;
    }
  } catch (e) {
    console.error(e);
  } finally {
    loadingList.value = false;
  }
}

// ---- CSVインポート／エクスポート ----
// current/legacy共通でdetailテーブルのカラム名（lowercase）を使う。差分は
// housing_no(現)/id(旧)、building_no(現=building_masterへのFK／旧=building_no_legacy相当)のみ。
const CSV_COLUMNS = [
  "housing_no", "card_no", "child_no", "type", "building_no", "building_no_legacy",
  "building_category", "building_name", "floors", "rooms", "room_no", "family_name",
  "tel", "tel_source", "tel_update_date", "note", "comment",
  "csv_town_name", "csv_cho", "csv_banchi", "csv_url", "csv_blank_field", "csv_lng", "csv_lat",
  "ng_flag", "ng_date", "ng_comment", "ng_sarvant", "ng_checked",
  "visit_status", "description", "timestamp", "operator",
  "bad_flag", "bad_comment", "bad_timestamp", "bad_operator",
  "input_town_name", "input_cho", "input_banchi", "address_sw",
  "younger_gen_flag", "yg_flag_timestamp", "yg_flag_operator",
];
const LEGACY_CSV_COLUMNS = [
  "id", "card_no", "child_no", "type", "building_no",
  "building_category", "building_name", "floors", "rooms", "room_no", "family_name",
  "tel", "tel_source", "tel_update_date", "note", "comment",
  "csv_town_name", "csv_cho", "csv_banchi", "csv_url", "csv_blank_field", "csv_lng", "csv_lat",
  "ng_flag", "ng_date", "ng_comment", "ng_sarvant", "ng_checked",
  "visit_status", "description", "timestamp", "operator",
  "bad_flag", "bad_comment", "bad_timestamp", "bad_operator",
  "input_town_name", "input_cho", "input_banchi", "address_sw",
  "younger_gen_flag", "yg_flag_timestamp", "yg_flag_operator",
];

const IMPORT_MODES = [
  { value: "upsert",  label: "追加更新（一致すれば上書き、なければ追加）" },
  { value: "replace", label: "総入替（既存を削除して差し替え）" },
];

const EXPORT_PAGE_SIZE = 1000;

async function exportCsvRows(format) {
  const out = [];
  let cursor = 0;
  for (;;) {
    const res = await getDetailListPage(filters.value, cursor, EXPORT_PAGE_SIZE);
    for (const r of (res.rows || [])) {
      out.push(format === "legacy" ? { ...r, id: r.housing_no, building_no: r.building_no_legacy } : r);
    }
    if (!res.hasMore) break;
    cursor = res.lastRowId;
  }
  return out;
}

async function importCsvBatch(rowsIn, { format, mode }) {
  return importDetailBatch(rowsIn, format, mode);
}

async function handleBeforeImport({ mode }) {
  if (mode === "replace") {
    await clearDetailAll();
  }
}

onMounted(async () => {
  const res = await getCardList();
  if (res.status === "success") cards.value = res.cards || [];
  await resetList();
});
</script>
