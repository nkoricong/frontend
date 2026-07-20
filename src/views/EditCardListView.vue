<template>
  <!-- ローディング -->
  <div v-if="loading" class="loading-overlay">
    <div class="text-center">
      <div class="spinner-border text-primary" style="width:3rem;height:3rem;" role="status"></div>
      <p class="mt-3">区域カード情報を読み込み中...</p>
    </div>
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
        <div class="d-flex">
          <button class="btn btn-link p-0 text-center me-2" @click="router.push({ name: 'mainMenu' })">
            <i class="fas fa-home fa-2x"></i>
            <div class="small">ホーム</div>
          </button>
        </div>
      </div>
    </header>

    <!-- 権限不足 -->
    <div v-if="!canAccess" class="alert alert-danger mt-4">
      このページを利用する権限がありません。
    </div>

    <template v-else>

      <div class="text-center my-3">
        <h3>区域カード情報の編集</h3>
      </div>

      <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
        <button class="btn btn-primary" @click="openCreateForm">
          <i class="fas fa-plus-circle"></i> 新規作成
        </button>
        <div class="d-flex align-items-center gap-2">
          <span class="me-2">件数：{{ filteredCards.length }}件</span>
          <button class="btn btn-outline-secondary btn-sm" @click="fetchCards" :disabled="loading">
            <i class="fas fa-sync-alt"></i> 更新
          </button>
        </div>
      </div>

      <div class="mb-3">
        <CsvImportExportPanel
          title="区域カード情報"
          :columns="CSV_COLUMNS"
          :legacy-columns="CSV_COLUMNS"
          :has-legacy-format="true"
          :has-delete-sync-option="true"
          format-template-filename="区域カード情報CSVフォーマット.csv"
          export-filename="区域カード情報.csv"
          :export-rows="exportCsvRows"
          :import-batch="importCsvBatch"
          :delete-missing-rows="deleteMissingCsvRows"
          :extract-existing-keys="() => cards.map(c => Number(c.CardNo))"
          :extract-csv-key="row => Number(row.card_no)"
          @imported="fetchCards"
        />
      </div>

      <!-- 検索/絞り込み -->
      <div class="row g-2 mb-3">
        <div class="col-12 col-md-4">
          <input type="text" class="form-control" v-model="searchText" placeholder="区域No・区域名・エリアで検索" />
        </div>
        <div class="col-6 col-md-3">
          <select class="form-select" v-model="statusFilter">
            <option value="">ステータス：全て</option>
            <option v-for="s in statusOptions" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <div class="col-6 col-md-3">
          <select class="form-select" v-model="colorFilter">
            <option value="">色：全て</option>
            <option v-for="c in colorOptions" :key="c.value" :value="c.value">{{ c.label }}</option>
          </select>
        </div>
      </div>

      <!-- 一覧テーブル -->
      <div class="table-responsive">
        <table class="table table-sm table-hover table-bordered align-middle">
          <thead class="table-secondary">
            <tr>
              <th>区域No</th>
              <th>エリア</th>
              <th>区域名</th>
              <th>色</th>
              <th>ステータス</th>
              <th class="text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="card in filteredCards" :key="card.CardNo">
              <td><b>{{ card.CardNo }}</b></td>
              <td>{{ card.Area }}</td>
              <td>{{ card.TownName }}</td>
              <td>
                <span class="badge" :style="{ backgroundColor: colorCode(card.Color), color: '#333' }">
                  {{ card.Color }}
                </span>
              </td>
              <td>{{ card.Status }}</td>
              <td class="text-center">
                <button class="btn btn-sm alert-primary me-1" @click="openEditForm(card)">編集</button>
                <button class="btn btn-sm btn-warning" @click="handleDelete(card)">削除</button>
              </td>
            </tr>
            <tr v-if="filteredCards.length === 0">
              <td colspan="6" class="text-center text-muted py-3">該当する区域カードがありません</td>
            </tr>
          </tbody>
        </table>
      </div>

    </template>

    <!-- ***************************************************************** -->
    <!-- 編集/新規作成モーダル -->
    <!-- ***************************************************************** -->
    <div
      class="modal fade"
      :class="{ show: showForm }"
      :style="showForm ? 'display:block' : 'display:none'"
      tabindex="-1"
      role="dialog"
      @click.self="closeForm"
    >
      <div class="modal-dialog modal-lg modal-dialog-scrollable" role="document">
        <div class="modal-content">

          <div class="modal-header">
            <h5 class="modal-title">
              {{ formMode === 'add' ? '区域カードの追加' : '区域カード情報の編集' }}
            </h5>
            <button type="button" class="btn-close" @click="closeForm"></button>
          </div>

          <div class="modal-body">
            <div class="row g-2">

              <div class="col-6 col-md-3">
                <label class="form-label small">区域No</label>
                <input
                  type="number" class="form-control form-control-sm"
                  v-model.number="form.CardNo" :disabled="formMode === 'edit'"
                />
              </div>

              <div class="col-6 col-md-3">
                <label class="form-label small">新/旧</label>
                <select class="form-select form-select-sm" v-model="form.Type">
                  <option value="新">新</option>
                  <option value="旧">旧</option>
                </select>
              </div>

              <div class="col-6 col-md-3">
                <label class="form-label small">色</label>
                <select class="form-select form-select-sm" v-model="form.Color">
                  <option v-for="c in colorOptions" :key="c.value" :value="c.value">{{ c.label }}</option>
                </select>
              </div>

              <div class="col-6 col-md-3">
                <label class="form-label small">子カード枚数</label>
                <input type="number" class="form-control form-control-sm" v-model.number="form.Childs" min="0" />
              </div>

              <div class="col-6 col-md-6">
                <label class="form-label small">エリア</label>
                <input type="text" class="form-control form-control-sm" v-model="form.Area" placeholder="エリア名を入力" />
              </div>

              <div class="col-6 col-md-6">
                <label class="form-label small">区域名</label>
                <input type="text" class="form-control form-control-sm" v-model="form.TownName" placeholder="区域カード名を入力" />
              </div>

              <hr class="my-2" />

              <div class="col-6 col-md-6">
                <label class="form-label small">KMLファイル名</label>
                <input type="text" class="form-control form-control-sm" v-model="form.Kml" placeholder="ファイル名を入力" />
              </div>

              <div class="col-6 col-md-6">
                <label class="form-label small">PDFファイル名</label>
                <input type="text" class="form-control form-control-sm" v-model="form.Pdf" placeholder="ファイル名を入力" />
              </div>

              <div class="col-6 col-md-3">
                <label class="form-label small">緯度(LAT)</label>
                <input type="text" class="form-control form-control-sm" v-model="form.Lat" placeholder="GoogleMaps等から貼付" />
              </div>

              <div class="col-6 col-md-3">
                <label class="form-label small">経度(LNG)</label>
                <input type="text" class="form-control form-control-sm" v-model="form.Lng" placeholder="GoogleMaps等から貼付" />
              </div>

              <hr class="my-2" />

              <div class="col-6 col-md-3">
                <label class="form-label small">有効期間(TERM)</label>
                <input type="month" class="form-control form-control-sm" v-model="form.Term" />
              </div>

              <div class="col-6 col-md-3">
                <label class="form-label small">ステータス</label>
                <select class="form-select form-select-sm" v-model="form.Status">
                  <option v-for="s in statusOptions" :key="s" :value="s">{{ s }}</option>
                </select>
              </div>

              <div class="col-6 col-md-3">
                <label class="form-label small">グループ</label>
                <input type="text" class="form-control form-control-sm" v-model="form.Group" placeholder="担当グループ名" />
              </div>

              <div class="col-6 col-md-3">
                <label class="form-label small">担当者(手配者)</label>
                <select class="form-select form-select-sm" v-model="form.Arrenger">
                  <option :value="null">-選択-</option>
                  <option v-for="u in userOptions" :key="u.UserID" :value="u.UserID">{{ u.UserName }}</option>
                </select>
              </div>

              <hr class="my-2" />

              <div class="col-6 col-md-3">
                <label class="form-label small">貸出開始日</label>
                <input type="date" class="form-control form-control-sm" v-model="form.StartDate" />
              </div>

              <div class="col-6 col-md-3">
                <label class="form-label small">返却期限</label>
                <input type="date" class="form-control form-control-sm" v-model="form.LimitDate" />
              </div>

              <div class="col-6 col-md-3">
                <label class="form-label small">貸出日</label>
                <input type="date" class="form-control form-control-sm" v-model="form.CheckoutDate" />
              </div>

              <div class="col-6 col-md-3">
                <label class="form-label small">返却日</label>
                <input type="date" class="form-control form-control-sm" v-model="form.ReturnDate" />
              </div>

              <div class="col-6 col-md-3">
                <label class="form-label small">次回使用可能日</label>
                <input type="date" class="form-control form-control-sm" v-model="form.NextAvailableDate" />
              </div>

              <div class="col-6 col-md-3 d-flex align-items-end">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="renewCheck" v-model="renewEnabled" />
                  <label class="form-check-label small" for="renewCheck">自動更新（RENEW）</label>
                </div>
              </div>

              <div class="col-12">
                <label class="form-label small">説明・メモ</label>
                <textarea class="form-control form-control-sm" v-model="form.Description" rows="2"></textarea>
              </div>

            </div>

            <p v-if="formError" class="text-danger mt-2 small">{{ formError }}</p>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" @click="closeForm">閉じる</button>
            <button class="btn btn-primary" @click="submitForm" :disabled="saving">
              <span v-if="saving"><i class="fas fa-spinner fa-spin"></i> 保存中...</span>
              <span v-else>{{ formMode === 'add' ? '登録' : '更新' }}</span>
            </button>
          </div>

        </div>
      </div>
    </div>
    <div v-if="showForm" class="modal-backdrop fade show"></div>

  </main>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/store/authStore.js";
import {
  getCardList, upsertCardList, deleteCardList, getUserMasterList,
  importCardListBatch, deleteCardListMissing,
} from "@/services/api.js";
import CsvImportExportPanel from "@/components/CsvImportExportPanel.vue";

const router    = useRouter();
const authStore = useAuthStore();

// このページの利用可否（設定メニューの「区域リスト」と同じ権限しきい値を踏襲）
const canAccess = computed(() => authStore.userRole >= 1100);

const loading = ref(false);
const saving  = ref(false);

const cards = ref([]);
const users = ref([]); // 担当者(手配者)選択肢用の user_master 一覧

const searchText  = ref("");
const statusFilter = ref("");
const colorFilter  = ref("");

// 区域カードの色（既存のドロップダウン相当。getColorCode()の背景色に対応）
const colorOptions = [
  { value: "赤", label: "赤" },
  { value: "白", label: "白" },
  { value: "黄", label: "黄" },
  { value: "青", label: "青" },
  { value: "緑", label: "緑" },
  { value: "★", label: "★" },
];

// レガシー側で使用されていたステータス値
const statusOptions = ["整備中", "貸出可能", "貸出中", "返却済", "重点"];

const showForm  = ref(false);
const formMode  = ref("add"); // 'add' | 'edit'
const formError = ref("");
const renewEnabled = ref(false);

const emptyForm = () => ({
  ID:                null,
  CardNo:            null,
  Type:              "新",
  Color:             "赤",
  Childs:            1,
  Area:              "",
  TownName:          "",
  Kml:               "",
  Pdf:               "",
  Lat:               "",
  Lng:               "",
  Term:              "",
  Status:            "整備中",
  Group:             "",
  Arrenger:          null,
  StartDate:         "",
  LimitDate:         "",
  CheckoutDate:      "",
  ReturnDate:        "",
  NextAvailableDate: "",
  Description:       "",
});

const form = ref(emptyForm());

const userOptions = computed(() => users.value);

const colorCode = (color) => {
  const map = { "赤": "#ffb6c1", "青": "#87cefa", "黄": "#ffd700", "緑": "#00ff00", "★": "#00ff00" };
  return map[color] || "#e0e0e0";
};

const filteredCards = computed(() => {
  return cards.value.filter(c => {
    if (statusFilter.value && c.Status !== statusFilter.value) return false;
    if (colorFilter.value && c.Color !== colorFilter.value) return false;
    if (searchText.value) {
      const q = searchText.value.toLowerCase();
      const hit =
        String(c.CardNo ?? "").includes(q) ||
        (c.TownName ?? "").toLowerCase().includes(q) ||
        (c.Area ?? "").toLowerCase().includes(q);
      if (!hit) return false;
    }
    return true;
  });
});

async function fetchCards() {
  loading.value = true;
  try {
    const res = await getCardList({ filter: "ALL" });
    if (res.status === "success") {
      cards.value = res.cards || [];
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
    if (res.status === "success") {
      users.value = res.users || [];
    }
  } catch (e) {
    console.error(e);
  }
}

// ---- CSVインポート／エクスポート ----
// 現アプリ用・旧アプリ用（GAS版）とも列名はSupabase card_listテーブルの列名そのまま
// （旧アプリ用は日付表記とarrengerの氏名/ID表記のみが異なる。csvImportService.js側で変換する）
const CSV_COLUMNS = [
  "id", "card_no", "type", "color", "childs", "area", "town_name", "kml", "pdf",
  "lng", "lat", "term", "status", "group", "arrenger", "start_date", "limit_date",
  "checkout_date", "return_date", "next_available_date", "description",
  "timestamp", "operator", "renew",
];

// ISO日付(YYYY-MM-DD)を旧アプリ（GAS版）が出力していたJS Date文字列表現に変換する
function toLegacyDateString(isoDate) {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  return Number.isNaN(d.getTime()) ? "" : d.toString();
}

function exportCsvRows(format) {
  const legacy = format === "legacy";
  return cards.value.map(c => ({
    id: c.ID, card_no: c.CardNo, type: c.Type, color: c.Color, childs: c.Childs,
    area: c.Area, town_name: c.TownName, kml: c.Kml, pdf: c.Pdf, lng: c.Lng, lat: c.Lat,
    term:          legacy ? toLegacyDateString(c.Term)          : c.Term,
    status: c.Status, group: c.Group,
    arrenger:      legacy ? (c.ArrengerName || "") : c.Arrenger,
    start_date:    legacy ? toLegacyDateString(c.StartDate)    : c.StartDate,
    limit_date:    legacy ? toLegacyDateString(c.LimitDate)    : c.LimitDate,
    checkout_date: legacy ? toLegacyDateString(c.CheckoutDate) : c.CheckoutDate,
    return_date:   legacy ? toLegacyDateString(c.ReturnDate)   : c.ReturnDate,
    next_available_date: legacy ? toLegacyDateString(c.NextAvailableDate) : c.NextAvailableDate,
    description: c.Description,
    timestamp:     legacy ? toLegacyDateString(c.Timestamp)    : c.Timestamp,
    operator: c.Operator, renew: c.Renew,
  }));
}

async function importCsvBatch(rows, { format }) {
  const existingByCardNo = new Map(cards.value.map(c => [Number(c.CardNo), c.ID]));
  const withId = rows.map(row => {
    const id = existingByCardNo.get(Number(row.card_no));
    return id != null ? { ...row, id } : row;
  });
  return importCardListBatch(withId, format);
}

async function deleteMissingCsvRows(missingCardNos) {
  const res = await deleteCardListMissing(missingCardNos);
  return res.deleted?.length ?? 0;
}

function openCreateForm() {
  formMode.value  = "add";
  form.value      = emptyForm();
  renewEnabled.value = false;
  formError.value = "";
  showForm.value  = true;
}

function openEditForm(card) {
  formMode.value  = "edit";
  form.value      = { ...emptyForm(), ...card };
  renewEnabled.value = card.Renew === 1 || card.Renew === true;
  formError.value = "";
  showForm.value  = true;
}

function closeForm() {
  showForm.value = false;
}

async function submitForm() {
  if (!form.value.CardNo || !form.value.TownName) {
    formError.value = "区域No・区域名は必須です";
    return;
  }
  saving.value    = true;
  formError.value = "";

  try {
    const record = { ...form.value, Renew: renewEnabled.value ? 1 : 0 };
    const res = await upsertCardList(record);
    if (res.status === "success") {
      showForm.value = false;
      await fetchCards();
    } else {
      formError.value = res.message || "保存に失敗しました";
    }
  } catch (e) {
    formError.value = e.message;
  } finally {
    saving.value = false;
  }
}

async function handleDelete(card) {
  if (!confirm(`区域No「${card.CardNo}（${card.TownName}）」を削除します。よろしいですか？`)) return;

  loading.value = true;
  try {
    // 子カードが存在する場合はWorker側で削除を拒否する想定（レガシーのdoDeleteCard仕様を踏襲）
    const res = await deleteCardList(card.CardNo);
    if (res.status === "success") {
      await fetchCards();
    } else {
      alert(res.message || "子カードが存在するため削除できません。");
    }
  } catch (e) {
    alert(e.message);
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await Promise.all([fetchCards(), fetchUsers()]);
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
