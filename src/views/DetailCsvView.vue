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
        import-target="detail"
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

    <!-- 表示件数・ページ操作 -->
    <div class="d-flex flex-wrap justify-content-between align-items-center mb-2 gap-2">
      <div class="d-flex align-items-center gap-2">
        <label class="form-label small mb-0">表示件数</label>
        <select class="form-select form-select-sm w-auto" v-model.number="pageSize">
          <option v-for="s in PAGE_SIZE_OPTIONS" :key="s" :value="s">{{ s }}件</option>
        </select>
      </div>
      <div class="small text-muted">
        <span v-if="total > 0">全{{ total }}件のうち{{ rangeStart }}件目から{{ rangeEnd }}件目を表示</span>
        <span v-else-if="!loadingList">該当する住戸がありません</span>
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

    <div class="d-flex justify-content-center align-items-center gap-3 my-3">
      <div v-if="loadingList"><i class="fas fa-spinner fa-spin"></i> 読み込み中...</div>
      <template v-else-if="totalPages > 0">
        <button class="btn btn-outline-secondary btn-sm" :disabled="currentPage <= 1" @click="goToPage(currentPage - 1)">
          <i class="fas fa-chevron-left"></i> 前へ
        </button>
        <span class="small">{{ totalPages }}ページ中{{ currentPage }}ページ目</span>
        <button class="btn btn-outline-secondary btn-sm" :disabled="currentPage >= totalPages" @click="goToPage(currentPage + 1)">
          次へ <i class="fas fa-chevron-right"></i>
        </button>
      </template>
    </div>

  </main>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/store/authStore.js";
import {
  getCardList, getDetailListPage, getDetailListPageOffset, importDetailBatch,
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

// ---- 一覧（ページ番号方式のページネーション） ----
const PAGE_SIZE_OPTIONS = [50, 100, 500, 1000];

const rows        = ref([]);
const total        = ref(0);
const currentPage  = ref(1);
const pageSize     = ref(100);
const loadingList  = ref(false);

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));
const rangeStart  = computed(() => total.value === 0 ? 0 : (currentPage.value - 1) * pageSize.value + 1);
const rangeEnd    = computed(() => Math.min(total.value, currentPage.value * pageSize.value));

async function resetList() {
  currentPage.value = 1;
  await loadPage();
}

async function goToPage(page) {
  if (page < 1 || page > totalPages.value || page === currentPage.value) return;
  currentPage.value = page;
  await loadPage();
}

async function loadPage() {
  loadingList.value = true;
  try {
    const offset = (currentPage.value - 1) * pageSize.value;
    const res = await getDetailListPageOffset(filters.value, offset, pageSize.value);
    if (res.status === "success") {
      rows.value  = res.rows || [];
      total.value = res.total ?? 0;
    }
  } catch (e) {
    console.error(e);
  } finally {
    loadingList.value = false;
  }
}

// 表示件数を変更したら1ページ目に戻る
watch(pageSize, () => resetList());

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

onMounted(async () => {
  const res = await getCardList();
  if (res.status === "success") cards.value = res.cards || [];
  await resetList();
});
</script>
