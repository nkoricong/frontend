<template>
  <!-- ローディング -->
  <div v-if="loading" class="loading-overlay">
    <i class="fas fa-spinner fa-4x fa-spin"></i>
  </div>

  <main role="main" class="container py-3">

    <!-- ヘッダー -->
    <header class="sticky-top bg-white mb-2 py-2 border-bottom">
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <button class="btn btn-link p-0 text-center" @click="router.push({ name: 'settings' })">
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

    <div class="text-center my-3">
      <h2><i class="far fa-list-alt"></i> 子カード情報の編集</h2>
    </div>

    <!-- 権限なし -->
    <div v-if="!canEdit" class="alert alert-danger text-center">
      この画面を利用する権限がありません。
    </div>

    <template v-else>

      <!-- 絞込条件 -->
      <div class="card mb-3">
        <div class="card-body">
          <h6 class="mb-2">リスト絞込</h6>
          <div class="row g-2 align-items-end">
            <div class="col-6 col-md-2">
              <label class="form-label small mb-0">区域No</label>
              <input type="number" class="form-control form-control-sm" v-model="filters.cardNo" placeholder="全て" />
            </div>
            <div class="col-6 col-md-3">
              <label class="form-label small mb-0">グループ</label>
              <input type="text" class="form-control form-control-sm" v-model="filters.group" placeholder="全て" />
            </div>
            <div class="col-6 col-md-3">
              <label class="form-label small mb-0">ステータス</label>
              <select class="form-select form-select-sm" v-model="filters.status">
                <option value="ALL">全ステータス</option>
                <option value="貸出可能">貸出可能</option>
                <option value="貸出中">貸出中</option>
                <option value="返却済">返却済</option>
                <option value="整備中">整備中</option>
              </select>
            </div>
            <div class="col-6 col-md-2">
              <button class="btn btn-primary btn-sm w-100" @click="fetchList">
                <i class="fas fa-search"></i> 表示
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- リスト見出し -->
      <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
        <h5 class="mb-0">表示中の枚数：{{ rows.length }}枚</h5>
        <button class="btn btn-success btn-sm" @click="openCreate">
          <i class="fas fa-plus-circle"></i> 新規作成
        </button>
      </div>

      <div class="mb-3">
        <CsvImportExportPanel
          title="子カード情報"
          :columns="CSV_COLUMNS"
          :legacy-columns="CSV_COLUMNS"
          :has-legacy-format="true"
          :has-delete-sync-option="true"
          format-template-filename="子カード情報CSVフォーマット.csv"
          export-filename="子カード情報.csv"
          :export-rows="exportCsvRows"
          :import-batch="importCsvBatch"
          :delete-missing-rows="deleteMissingCsvRows"
          :extract-existing-keys="() => rows.map(r => `${r.card_no}-${r.child_no}`)"
          :extract-csv-key="row => `${row.card_no}-${row.child_no}`"
          @imported="fetchList"
        />
      </div>

      <!-- 子カード一覧 -->
      <div class="table-responsive">
        <table class="table table-sm table-hover align-middle">
          <thead>
            <tr>
              <th>区域No-子No</th>
              <th>区域名</th>
              <th>ステータス</th>
              <th>担当者</th>
              <th>手配者</th>
              <th>使用期限</th>
              <th>住戸件数</th>
              <th>KML/PDF</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id">
              <td class="text-nowrap">{{ row.card_no }}-{{ row.child_no }}</td>
              <td>{{ row.block }}</td>
              <td><span :class="statusBadgeClass(row.status)">{{ row.status }}</span></td>
              <td>{{ userName(row.minister) }}</td>
              <td>{{ userName(row.arrenger) }}</td>
              <td>{{ row.limit_date || "-" }}</td>
              <td>{{ row.houses ?? 0 }}件</td>
              <td>
                <i class="fas fa-map-marked-alt text-info" v-if="row.kml" title="KML登録済"></i>
                <i class="fas fa-file-pdf text-danger ms-1" v-if="row.pdf" title="PDF登録済"></i>
              </td>
              <td class="text-nowrap">
                <button class="btn btn-sm btn-outline-primary me-1" @click="openEdit(row)">編集</button>
                <button class="btn btn-sm btn-outline-danger" @click="removeRow(row)">削除</button>
              </td>
            </tr>
            <tr v-if="rows.length === 0">
              <td colspan="9" class="text-center text-muted py-3">該当する子カードがありません</td>
            </tr>
          </tbody>
        </table>
      </div>

    </template>

    <!-- 編集／新規作成モーダル -->
    <div
      class="modal fade"
      :class="{ show: showModal }"
      :style="showModal ? 'display:block' : 'display:none'"
      tabindex="-1"
      role="dialog"
      @click.self="closeModal"
    >
      <div class="modal-dialog modal-lg modal-dialog-scrollable" role="document">
        <div class="modal-content">

          <div class="modal-header">
            <h5 class="modal-title">
              <span v-if="modalMode === 'create'">子カード情報の新規作成</span>
              <span v-else>子カード情報の編集 [{{ form.card_no }}-{{ form.child_no }}]</span>
            </h5>
            <button type="button" class="btn-close" @click="closeModal"></button>
          </div>

          <div class="modal-body">
            <div class="row g-2">

              <template v-if="modalMode === 'create'">
                <div class="col-6">
                  <label class="form-label small">区域No</label>
                  <select class="form-select form-select-sm" v-model.number="form.card_no">
                    <option v-for="c in cardNoOptions" :key="c" :value="c">{{ c }}</option>
                  </select>
                </div>
                <div class="col-6">
                  <label class="form-label small">子カードNo</label>
                  <select class="form-select form-select-sm" v-model.number="form.child_no">
                    <option v-for="n in childNoOptions" :key="n" :value="n">{{ n }}</option>
                  </select>
                </div>
              </template>

              <div class="col-12">
                <label class="form-label small">区域名</label>
                <input type="text" class="form-control form-control-sm" v-model="form.block" maxlength="40" />
              </div>

              <div class="col-4">
                <label class="form-label small">住戸件数</label>
                <input type="number" class="form-control form-control-sm" v-model.number="form.houses" />
              </div>
              <div class="col-4">
                <label class="form-label small">KMLファイル名</label>
                <input type="text" class="form-control form-control-sm" v-model="form.kml" />
              </div>
              <div class="col-4">
                <label class="form-label small">PDFファイル名</label>
                <input type="text" class="form-control form-control-sm" v-model="form.pdf" />
              </div>

              <div class="col-6">
                <label class="form-label small">経度 (lng)</label>
                <input type="text" class="form-control form-control-sm" v-model="form.lng" />
              </div>
              <div class="col-6">
                <label class="form-label small">緯度 (lat)</label>
                <input type="text" class="form-control form-control-sm" v-model="form.lat" />
              </div>

              <div class="col-12"><hr class="my-2" /><b>貸出情報</b></div>

              <div class="col-4">
                <label class="form-label small">使用期間 (term)<span class="text-danger">*</span></label>
                <input type="date" class="form-control form-control-sm" v-model="form.term" required />
              </div>
              <div class="col-4">
                <label class="form-label small">ステータス</label>
                <select class="form-select form-select-sm" v-model="form.status">
                  <option value="貸出可能">貸出可能</option>
                  <option value="貸出中">貸出中</option>
                  <option value="返却済">返却済</option>
                  <option value="整備中">整備中</option>
                </select>
              </div>
              <div class="col-4">
                <label class="form-label small">グループ</label>
                <input type="text" class="form-control form-control-sm" v-model="form.group" />
              </div>

              <div class="col-6">
                <label class="form-label small">手配者</label>
                <select class="form-select form-select-sm" v-model="form.arrenger">
                  <option :value="null">-選択-</option>
                  <option v-for="u in users" :key="u.UserID" :value="u.UserID">{{ u.UserName }}</option>
                </select>
              </div>
              <div class="col-6">
                <label class="form-label small">担当者</label>
                <select class="form-select form-select-sm" v-model="form.minister">
                  <option :value="null">-選択-</option>
                  <option v-for="u in users" :key="u.UserID" :value="u.UserID">{{ u.UserName }}</option>
                </select>
              </div>

              <div class="col-4">
                <label class="form-label small">貸出開始日</label>
                <input type="date" class="form-control form-control-sm" v-model="form.start_date" />
              </div>
              <div class="col-4">
                <label class="form-label small">使用期限日</label>
                <input type="date" class="form-control form-control-sm" v-model="form.limit_date" />
              </div>
              <div class="col-4">
                <label class="form-label small">貸出日</label>
                <input type="date" class="form-control form-control-sm" v-model="form.checkout_date" />
              </div>
              <div class="col-4">
                <label class="form-label small">返却日</label>
                <input type="date" class="form-control form-control-sm" v-model="form.return_date" />
              </div>
              <div class="col-8">
                <label class="form-label small">次回使用可能日</label>
                <input type="date" class="form-control form-control-sm" v-model="form.next_available_date" />
              </div>

              <div class="col-12 mt-2">
                <div class="form-check form-check-inline">
                  <input class="form-check-input" type="checkbox" id="renewCheck" v-model="form.renew" />
                  <label class="form-check-label small" for="renewCheck">休眠期間不足</label>
                </div>
                <div class="form-check form-check-inline">
                  <input class="form-check-input" type="checkbox" id="overdueCheck" v-model="form.overdue" />
                  <label class="form-check-label small" for="overdueCheck">使用期限超過</label>
                </div>
                <div class="form-check form-check-inline">
                  <input class="form-check-input" type="checkbox" id="lostCheck" v-model="form.lost" />
                  <label class="form-check-label small" for="lostCheck">紛失</label>
                </div>
              </div>

              <div class="col-12"><hr class="my-2" /><b>内訳フラグ</b></div>

              <div class="col-6 col-md-3">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="homeCheck" v-model="form.home" />
                  <label class="form-check-label small" for="homeCheck">家から家</label>
                </div>
              </div>
              <div class="col-6 col-md-3">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="bussinessCheck" v-model="form.bussiness" />
                  <label class="form-check-label small" for="bussinessCheck">会社・商店</label>
                </div>
              </div>
              <div class="col-6 col-md-3">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="autolockCheck" v-model="form.autolock" />
                  <label class="form-check-label small" for="autolockCheck">オートロック</label>
                </div>
              </div>
              <div class="col-6 col-md-3">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="telCheck" v-model="form.tel_enabled" />
                  <label class="form-check-label small" for="telCheck">TEL登録あり</label>
                </div>
              </div>

              <div class="col-12 mt-2">
                <label class="form-label small">メモ</label>
                <textarea class="form-control form-control-sm" v-model="form.description" rows="3" maxlength="128"></textarea>
              </div>

            </div>

            <p v-if="saveError" class="text-danger small mt-2">{{ saveError }}</p>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" @click="closeModal">閉じる</button>
            <button class="btn btn-primary" @click="submitForm" :disabled="saving">
              <span v-if="saving"><i class="fas fa-spinner fa-spin"></i> 保存中...</span>
              <span v-else>{{ modalMode === 'create' ? '登録' : '更新' }}</span>
            </button>
          </div>

        </div>
      </div>
    </div>
    <div v-if="showModal" class="modal-backdrop fade show"></div>

  </main>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/store/authStore.js";
import {
  getChildListAll,
  getUserMasterList,
  getCardNoOptions,
  upsertChildList,
  deleteChildList,
  importChildListBatch,
  deleteChildListBatch,
} from "@/services/api.js";
import CsvImportExportPanel from "@/components/CsvImportExportPanel.vue";

const router    = useRouter();
const authStore = useAuthStore();

const canEdit = computed(() => authStore.userRole >= 1100);

const loading = ref(false);
const saving  = ref(false);
const saveError = ref("");

const rows  = ref([]);
const users = ref([]);          // user_master 一覧（手配者・担当者の名前解決用）
const cardNoOptions = ref([]);  // 既存の区域No一覧（新規作成用）
const childNoOptions = Array.from({ length: 30 }, (_, i) => i + 1);

const filters = reactive({
  cardNo: "",
  group:  "",
  status: "ALL",
});

const showModal = ref(false);
const modalMode  = ref("edit"); // "edit" | "create"

function emptyForm() {
  return {
    id: null,
    card_no: cardNoOptions.value[0] ?? 1,
    child_no: 1,
    block: "",
    houses: 0,
    pdf: "",
    kml: "",
    lng: "",
    lat: "",
    term: new Date().toISOString().slice(0, 10),
    status: "貸出可能",
    group: "",
    arrenger: null,
    minister: null,
    start_date: "",
    limit_date: "",
    checkout_date: "",
    return_date: "",
    next_available_date: "",
    renew: false,
    overdue: false,
    lost: false,
    description: "",
    home: false,
    bussiness: false,
    autolock: false,
    tel_enabled: false,
  };
}

const form = reactive(emptyForm());

function userName(userId) {
  if (!userId) return "-";
  return users.value.find(u => u.UserID === userId)?.UserName ?? userId;
}

function statusBadgeClass(status) {
  const map = {
    "貸出中":   "badge bg-warning text-dark",
    "返却済":   "badge bg-info text-white",
    "貸出可能": "badge bg-success text-white",
    "整備中":   "badge bg-secondary text-white",
  };
  return map[status] || "badge bg-secondary text-white";
}

async function fetchList() {
  loading.value = true;
  try {
    const res = await getChildListAll({
      cardNo: filters.cardNo || "ALL",
      group:  filters.group  || "ALL",
      status: filters.status,
    });
    if (res.status === "success") {
      rows.value = res.data || [];
    }
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

async function fetchUsers() {
  try {
    const res = await getUserMasterList();
    if (res.status === "success") users.value = res.users || [];
  } catch (e) {
    console.error(e);
  }
}

async function fetchCardNoOptions() {
  try {
    const res = await getCardNoOptions();
    if (res.status === "success") cardNoOptions.value = res.cardNos || [];
  } catch (e) {
    console.error(e);
  }
}

// ---- CSVインポート／エクスポート ----
// rows.value はSupabase child_listテーブルの全列をそのまま保持しているため、
// 列名の変換なしにそのままCSVの列として使える
// （現アプリ用・旧アプリ用とも列名は同一。旧アプリ用は日付表記とarrenger/ministerの
// 氏名/ID表記のみが異なり、csvImportService.js側で変換する）
const CSV_COLUMNS = [
  "id", "card_no", "child_no", "block", "houses", "pdf", "kml", "lng", "lat",
  "term", "status", "group", "arrenger", "minister", "start_date", "limit_date",
  "checkout_date", "return_date", "next_available_date", "renew", "overdue", "lost",
  "description", "child_attach1", "child_attach2", "child_attach3", "timestamp",
  "operator", "parent_status", "bad_flag", "bad_comment", "bad_timestamp", "bad_operator",
  "bad_detail", "home", "bussiness", "autolock", "tel_enabled", "ng_count", "unchecked_ng",
  "visited", "younger_gen", "child_classify", "flag1", "flag2", "nickname_flag",
  "nickname", "user_memo",
];

function toLegacyDateString(isoDate) {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  return Number.isNaN(d.getTime()) ? "" : d.toString();
}

const DATE_FIELDS = ["term", "start_date", "limit_date", "checkout_date", "return_date", "next_available_date", "timestamp", "bad_timestamp"];

function exportCsvRows(format) {
  const legacy = format === "legacy";
  return rows.value.map(r => {
    const out = {};
    for (const col of CSV_COLUMNS) out[col] = r[col];
    if (legacy) {
      for (const f of DATE_FIELDS) out[f] = toLegacyDateString(r[f]);
      out.arrenger = r.arrenger ? userName(r.arrenger) : "";
      out.minister = r.minister ? userName(r.minister) : "";
    }
    return out;
  });
}

async function importCsvBatch(csvRows, { format }) {
  const existingByKey = new Map(rows.value.map(r => [`${r.card_no}-${r.child_no}`, r.id]));
  const withId = csvRows.map(row => {
    const id = existingByKey.get(`${row.card_no}-${row.child_no}`);
    return id != null ? { ...row, id } : row;
  });
  return importChildListBatch(withId, format);
}

async function deleteMissingCsvRows(missingKeys) {
  const byKey = new Map(rows.value.map(r => [`${r.card_no}-${r.child_no}`, r.id]));
  const ids = missingKeys.map(k => byKey.get(k)).filter(Boolean);
  const res = await deleteChildListBatch(ids);
  return res.deletedCount ?? 0;
}

function openCreate() {
  modalMode.value = "create";
  Object.assign(form, emptyForm());
  saveError.value = "";
  showModal.value = true;
}

function openEdit(row) {
  modalMode.value = "edit";
  Object.assign(form, {
    ...emptyForm(),
    ...row,
    renew:       !!row.renew,
    overdue:     !!row.overdue,
    lost:        !!row.lost,
    home:        !!row.home,
    bussiness:   !!row.bussiness,
    autolock:    !!row.autolock,
    tel_enabled: !!row.tel_enabled,
  });
  saveError.value = "";
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
}

async function submitForm() {
  if (!form.block || !form.term) {
    saveError.value = "区域名と使用期間は必須です";
    return;
  }
  saving.value = true;
  saveError.value = "";
  try {
    const record = {
      ...form,
      renew:       form.renew       ? 1 : 0,
      overdue:     form.overdue     ? 1 : 0,
      lost:        form.lost        ? 1 : 0,
      home:        form.home        ? 1 : 0,
      bussiness:   form.bussiness   ? 1 : 0,
      autolock:    form.autolock    ? 1 : 0,
      tel_enabled: form.tel_enabled ? 1 : 0,
    };
    const res = await upsertChildList(record);
    if (res.status === "success") {
      showModal.value = false;
      await fetchList();
    } else {
      saveError.value = res.message || "保存に失敗しました";
    }
  } catch (e) {
    saveError.value = e.message;
  } finally {
    saving.value = false;
  }
}

async function removeRow(row) {
  if (!confirm(`区域No.${row.card_no}-${row.child_no} ${row.block} を削除してもよろしいですか？`)) return;
  loading.value = true;
  try {
    const res = await deleteChildList(row.id);
    if (res.status === "success") {
      rows.value = rows.value.filter(r => r.id !== row.id);
    }
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  if (!canEdit.value) return;
  loading.value = true;
  await Promise.all([fetchUsers(), fetchCardNoOptions()]);
  await fetchList();
  loading.value = false;
});
</script>

<style scoped>
.loading-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}
</style>
