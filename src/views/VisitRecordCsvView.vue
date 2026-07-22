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
      <h2><i class="fas fa-file-csv"></i> 訪問履歴のCSV入出力</h2>
    </div>

    <div class="alert alert-secondary small">
      訪問履歴（visit_record）全件のCSVインポート・エクスポートを行います（GitHub Actions上で
      バックグラウンド実行されるため、件数が多くても失敗しません。画面を閉じても処理は継続します）。<br>
      現アプリ用CSVの各項目（時間帯・訪問結果・奉仕者・コメント等）は復号済みの平文で入出力されます。
      旧アプリ（GAS版）からのCSVは、そのまま取り込むことができます（内部で自動的に暗号方式を変換します）。
      旧アプリ用CSVの取り込みは常に追加（履歴の積み増し）となります。<br>
      「総入替」モードは既存の訪問履歴を全て削除してからCSVの内容で置き換える破壊的な操作です。実行前に確認が入ります。
      エクスポートは、下記の絞込条件にヒットした全件が対象です（表示件数の設定には依存しません）。
    </div>

    <div class="d-flex justify-content-center mb-3">
      <CsvImportExportPanel
        title="訪問履歴"
        :columns="CSV_COLUMNS"
        :legacy-columns="LEGACY_CSV_COLUMNS"
        :has-legacy-format="true"
        :import-modes="IMPORT_MODES"
        import-target="visit_record"
        format-template-filename="訪問履歴CSVフォーマット.csv"
        export-filename="訪問履歴.csv"
        :export-rows="exportCsvRows"
        :export-filters="getExportFilters"
        :import-batch="importCsvBatch"
        @imported="resetList"
      />
    </div>

    <!-- 絞込 -->
    <div class="row g-2 align-items-end mb-3">
      <div class="col-6 col-md-2">
        <label class="form-label small mb-0">区域番号</label>
        <input type="text" class="form-control form-control-sm" v-model="cardNoInput" placeholder="例）011" />
      </div>
      <div class="col-6 col-md-2">
        <label class="form-label small mb-0">子カード番号</label>
        <input type="text" class="form-control form-control-sm" v-model="childNoInput" placeholder="例）11" />
      </div>
      <div class="col-6 col-md-2">
        <label class="form-label small mb-0">住戸番号</label>
        <input type="text" class="form-control form-control-sm" v-model="housingNoInput" placeholder="例）1" />
      </div>
      <div class="col-6 col-md-2">
        <label class="form-label small mb-0">訪問日</label>
        <input type="date" class="form-control form-control-sm" v-model="visitDateInput" />
      </div>
      <div class="col-6 col-md-2">
        <label class="form-label small mb-0">時間帯</label>
        <select class="form-select form-select-sm" v-model="timeInput">
          <option value="">全て</option>
          <option v-for="t in TIME_OPTIONS" :key="t" :value="t">{{ t }}</option>
        </select>
      </div>
      <div class="col-6 col-md-2">
        <label class="form-label small mb-0">結果</label>
        <input type="text" class="form-control form-control-sm" v-model="resultInput" placeholder="例）済" />
      </div>
      <div class="col-6 col-md-3">
        <label class="form-label small mb-0">奉仕者</label>
        <input type="text" class="form-control form-control-sm" v-model="ministerInput" placeholder="奉仕者名・UserID" />
      </div>
      <div class="col-12 col-md-3 text-md-end">
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
        <span v-else-if="!loadingList">該当する訪問履歴がありません</span>
        <span v-if="truncated" class="text-warning ms-2">
          <i class="fas fa-exclamation-triangle"></i> 内部処理の上限に達したため、一部の結果のみ表示しています。絞込条件を絞ってください。
        </span>
      </div>
    </div>

    <!-- 一覧（閲覧専用） -->
    <div class="table-responsive">
      <table class="table table-sm table-striped align-middle">
        <thead class="table-secondary">
          <tr>
            <th>区域番号</th>
            <th>子カード番号</th>
            <th>住戸番号</th>
            <th>訪問日</th>
            <th>時間帯</th>
            <th>結果</th>
            <th>奉仕者</th>
            <th>コメント</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.row_id">
            <td>{{ r.card_no }}</td>
            <td>{{ r.child_no }}</td>
            <td>{{ r.housing_no }}</td>
            <td>{{ r.visit_date }}</td>
            <td>{{ r.time }}</td>
            <td>{{ r.result }}</td>
            <td>{{ r.minister }}</td>
            <td>{{ r.comment }}</td>
          </tr>
          <tr v-if="rows.length === 0 && !loadingList">
            <td colspan="8" class="text-center text-muted py-4">該当する訪問履歴がありません</td>
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
  getVisitRecordExportPage, getVisitRecordListPageOffset, importVisitRecordBatch,
} from "@/services/api.js";
import CsvImportExportPanel from "@/components/CsvImportExportPanel.vue";

const router    = useRouter();
const authStore = useAuthStore();

const TIME_OPTIONS = ["9時以前", "9時〜12時", "12時〜13時", "13時〜16時", "16時〜18時", "18時以降"];

// ---- 絞込 ----
const cardNoInput    = ref("");
const childNoInput   = ref("");
const housingNoInput = ref("");
const visitDateInput = ref("");
const timeInput      = ref("");
const resultInput    = ref("");
const ministerInput  = ref("");

const filters = computed(() => ({
  cardNos:   cardNoInput.value.trim() ? [cardNoInput.value.trim()] : undefined,
  childNo:   childNoInput.value.trim() || undefined,
  housingNo: housingNoInput.value.trim() || undefined,
  visitDate: visitDateInput.value || undefined,
  time:      timeInput.value || undefined,
  result:    resultInput.value.trim() || undefined,
  minister:  ministerInput.value.trim() || undefined,
}));

// ---- 一覧（ページ番号方式のページネーション、閲覧専用） ----
const PAGE_SIZE_OPTIONS = [50, 100, 500, 1000];

const rows       = ref([]);
const total       = ref(0);
const currentPage = ref(1);
const pageSize    = ref(100);
const loadingList = ref(false);
const truncated   = ref(false);

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
    const res = await getVisitRecordListPageOffset(filters.value, offset, pageSize.value);
    if (res.status === "success") {
      rows.value      = res.rows || [];
      total.value     = res.total ?? 0;
      truncated.value = res.truncated ?? false;
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
// 現アプリ用：row_idを含める（再インポート時にこの値が一致すればUPDATE、無ければINSERT）
const CSV_COLUMNS = [
  "row_id", "card_no", "child_no", "housing_no", "visit_date",
  "time", "field", "result", "minister", "comment", "note", "term",
];
// 旧アプリ（GAS版）：idは旧システム側の識別子で現行row_idとは無関係のため、
// 旧アプリ用フォーマットの取り込みは常に新規追加になる
const LEGACY_CSV_COLUMNS = [
  "id", "card_no", "child_no", "housing_no", "visit_date",
  "time", "field", "result", "minister", "comment", "note", "term",
];

const IMPORT_MODES = [
  { value: "upsert",  label: "追加更新（区域番号・子カード番号・住戸番号・訪問日・時間帯が一致すれば上書き、なければ追加）" },
  { value: "replace", label: "総入替（既存を削除して差し替え）" },
];

const EXPORT_PAGE_SIZE = 1000;

// テンプレート内はscript setupのref/computedが自動アンラップされるため、
// 名前付き関数として切り出し、通常のscript setupコードから明示的に
// .valueでアクセスする（DetailCsvView.vueと同じ理由）。
function getExportFilters() {
  return filters.value;
}

// importTarget指定時、実際のエクスポートはジョブ方式（CsvImportExportPanel側）を
// 使うため、この関数はプロップの都合上残しているだけで呼ばれない
// （DetailCsvView.vue等の他画面と同じ既存の慣習）。
async function exportCsvRows() {
  const out = [];
  let afterRowId = 0;
  for (;;) {
    const res = await getVisitRecordExportPage(filters.value, afterRowId, EXPORT_PAGE_SIZE);
    // legacy列リストの "id" 列にも同じ値が出るよう、row_idをidとしても持たせておく
    out.push(...(res.rows || []).map(r => ({ ...r, id: r.row_id })));
    if (!res.hasMore) break;
    afterRowId = res.lastRowId;
  }
  return out;
}

async function importCsvBatch(rowsIn, { format, mode }) {
  return importVisitRecordBatch(rowsIn, format, mode);
}

onMounted(() => {
  resetList();
});
</script>
