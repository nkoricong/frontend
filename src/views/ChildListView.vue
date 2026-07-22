<template>
  <!-- ローディング -->
  <div v-if="loading" class="loading">
    <i class="fas fa-spinner fa-4x fa-spin"></i>
  </div>

  <main role="main" class="container py-3">

    <!-- ヘッダー -->
    <header class="sticky-top bg-white mb-2 py-2 border-bottom">
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <button class="btn btn-link p-0 text-center" @click="router.push({ name: 'mainMenu' })">
            <i class="fas fa-arrow-circle-left fa-2x"></i>
            <div class="small">戻る</div>
          </button>
        </div>
        <div class="text-center flex-grow-1" style="font-size:22px; font-weight:700;">グループページ</div>
        <div>
          <button class="btn btn-link p-0 text-center" @click="router.push({ name: 'mainMenu' })">
            <i class="fas fa-home fa-2x"></i>
            <div class="small">ホーム</div>
          </button>
        </div>
      </div>
    </header>

    <!-- ユーザー情報 -->
    <div class="alert alert-secondary py-2 mb-3">
      <strong>{{ authStore.userName }}</strong>（{{ authStore.userEmail }}）
      ／ グループ：{{ authStore.userGroup }} ／ 権限：{{ authStore.userRole }}
    </div>

    <div class="d-flex justify-content-end mb-3">
      <GroupViewSwitcher :current="GROUP_VIEWS.CHILD_LIST" />
    </div>

    <!-- リスト絞込 -->
    <div class="row g-2 align-items-end mb-3">
      <div class="col-auto">
        <label class="form-label small mb-0">奉仕者</label>
        <select class="form-select form-select-sm" v-model="filterMinisterId">
          <option value="">全奉仕者</option>
          <option v-for="m in ministers" :key="m.UserID" :value="m.UserID">{{ m.UserName }}</option>
        </select>
      </div>
      <div class="col-auto">
        <label class="form-label small mb-0">ステータス</label>
        <select class="form-select form-select-sm" v-model="filterStatus">
          <option value="">全ステータス</option>
          <option value="貸出可能">貸出可能</option>
          <option value="貸出中">貸出中</option>
          <option value="返却済">返却済</option>
          <option value="整備中">整備中</option>
        </select>
      </div>
      <div class="col-auto">
        <div class="form-check">
          <input type="checkbox" class="form-check-input" id="overdueOnly" v-model="overdueOnly">
          <label class="form-check-label small" for="overdueOnly">使用期限超過のみ</label>
        </div>
      </div>
      <div class="col-auto ms-auto">
        <button class="btn btn-primary btn-sm" @click="refresh" :disabled="loading">
          <i class="fas fa-sync-alt"></i> 更新
        </button>
      </div>
    </div>

    <div v-if="canCsv" class="d-flex justify-content-end mb-3">
      <CsvImportExportPanel
        title="子カード使用履歴"
        :columns="USAGE_HISTORY_CSV_COLUMNS"
        import-target="child_usage_history"
        format-template-filename="子カード使用履歴CSVフォーマット.csv"
        export-filename="子カード使用履歴.csv"
        :export-rows="exportUsageHistoryCsvRows"
        :export-filters="getUsageHistoryExportFilters"
        :import-batch="importUsageHistoryCsvBatch"
      />
    </div>

    <!-- 一括貸出・返却ツールバー -->
    <div class="d-flex flex-wrap gap-2 align-items-center mb-2" v-if="canAssign">
      <button class="btn btn-outline-warning btn-sm" :disabled="selectedChildIds.length === 0" @click="openBulkCheckoutModal">
        <i class="fas fa-hand-holding"></i> 貸出（{{ selectedChildIds.length }}件選択中）
      </button>
      <button class="btn btn-outline-success btn-sm" :disabled="selectedChildIds.length === 0" @click="bulkReturn">
        <i class="fas fa-undo"></i> 返却（{{ selectedChildIds.length }}件選択中）
      </button>
    </div>

    <div class="mb-2"><h5>表示中の枚数：{{ filteredCards.length }}枚</h5></div>

    <!-- カード一覧 -->
    <div class="row g-3">
      <div class="col-12 col-sm-6" v-for="child in filteredCards" :key="child.CHILDID">
        <div class="card shadow-sm h-100" :class="{ 'card-past-limit': isPastLimit(child) }">
          <div class="card-body" role="button" @click="openChildMap(child)">

            <div class="d-flex justify-content-between align-items-start mb-1">
              <h5 class="card-title mb-0">
                <input
                  v-if="canAssign"
                  type="checkbox"
                  class="form-check-input me-2"
                  :value="child.CHILDID"
                  v-model="selectedChildIds"
                  @click.stop
                >
                <span class="cardno-badge" :style="{ backgroundColor: colorBg(child.COLOR), borderColor: colorBg(child.COLOR) }">{{ child.CARDNO }}-{{ child.CHILDNO }}</span>
                {{ child.CHILDBLOCK }} (<i class="fas fa-house-user"></i>{{ child.CHILDHOUSES }}件)
              </h5>
              <button
                type="button"
                class="btn btn-sm rounded-pill"
                :class="statusBadgeClass(child.CHILDSTATUS)"
                :disabled="!canAssign"
                @click.stop="openFixModal(child)"
              >
                {{ child.CHILDSTATUS }}
              </button>
            </div>

            <p class="mb-1 small">
              奉仕者：
              <span :class="{ 'text-muted fst-italic': !child.MINISTER }">
                {{ child.MINISTERNAME || '未割当' }}
              </span>
            </p>

            <p v-if="child.CHILDSTATUS === '貸出中' || child.CHILDSTATUS === '返却済'" class="mb-1 small text-muted">
              貸出日：{{ child.CHILDCHECKOUTDATE ?? '-' }}
              <span v-if="child.CHILDSTATUS === '返却済'">／ 返却日：{{ child.CHILDRETURNDATE ?? '-' }}</span>
            </p>

            <p v-if="child.CHILDSTATUS !== '整備中'" class="mb-1 small text-muted">
              <template v-if="child.CHILDSTATUS === '返却済' && child.CARDSTATUS === '返却済'">
                使用終了（{{ child.CHILDLIMITDATE ?? '-' }}迄）
              </template>
              <template v-else>
                使用可能期間：{{ child.CHILDSTARTDATE ?? '-' }} ～ {{ child.CHILDLIMITDATE ?? '-' }}
                <span v-if="isOverdue(child)" class="text-danger ms-1">（期限超過）</span>
              </template>
            </p>
            <p v-if="isParentLimitBeforeChild(child)" class="mb-1 small text-muted">
              （親カード期限：{{ child.CARDLIMITDATE }}）
            </p>

            <div class="d-flex justify-content-between align-items-center mt-2">
              <button class="btn btn-link btn-sm p-0" @click.stop="toggleHistory(child)">
                履歴{{ expandedChildId === child.CHILDID ? "▲" : "▼" }}
              </button>
              <div class="d-flex gap-2" v-if="canAssign">
                <button
                  v-if="isCheckoutable(child)"
                  class="btn btn-sm btn-warning"
                  @click.stop="openCheckoutModal(child)"
                >
                  <i class="fas fa-hand-holding"></i> 貸出
                </button>
                <button
                  v-else-if="child.CHILDSTATUS === '貸出中'"
                  class="btn btn-sm btn-success"
                  @click.stop="returnCard(child)"
                >
                  <i class="fas fa-undo"></i> 返却
                </button>
              </div>
            </div>

            <div v-if="expandedChildId === child.CHILDID" class="mt-2 border-top pt-2" @click.stop>
              <div v-if="historyLoading === child.CHILDID" class="text-center text-muted small py-1">
                <i class="fas fa-spinner fa-spin"></i> 読み込み中...
              </div>
              <template v-else>
                <div v-if="(historyCache[child.CHILDID] || []).length === 0" class="small text-muted">貸出記録がありません</div>
                <div v-for="h in (historyCache[child.CHILDID] || [])" :key="h.ID" class="small border-bottom py-1">
                  {{ h.Status }}／{{ h.MinisterName || "-" }}<br />
                  貸出:{{ h.CheckoutDate || "-" }} ／ 期限:{{ h.LimitDate || "-" }} ／ 返却:{{ h.ReturnDate || "-" }}
                  <span v-if="h.Description">／{{ h.Description }}</span>
                </div>
              </template>
            </div>

          </div>
        </div>
      </div>
    </div>

    <div v-if="filteredCards.length === 0 && !loading" class="text-center text-muted mt-5">
      <i class="fas fa-inbox fa-3x mb-3"></i>
      <p>表示するカードがありません</p>
    </div>

  </main>

  <!-- 貸出／修正モーダル -->
  <div
    class="modal fade"
    :class="{ show: assignTarget }"
    :style="assignTarget ? 'display:block' : 'display:none'"
    tabindex="-1"
    role="dialog"
    @click.self="closeAssignModal"
  >
    <div class="modal-dialog" role="document">
      <div class="modal-content" v-if="assignTarget">

        <div class="modal-header">
          <h5 class="modal-title">
            {{ assignMode === 'checkout' ? '貸出' : '修正' }}：
            区域No.{{ assignTarget.CARDNO }}-{{ assignTarget.CHILDNO }} {{ assignTarget.CHILDBLOCK }}
          </h5>
          <button type="button" class="btn-close" @click="closeAssignModal"></button>
        </div>

        <div class="modal-body">
          <div class="row g-2 align-items-center">
            <div class="col-6">奉仕者</div>
            <div class="col-6">
              <select class="form-select form-select-sm" v-model="selectedMinisterId">
                <option value="">-選択-</option>
                <option v-for="m in ministers" :key="m.UserID" :value="m.UserID">{{ m.UserName }}</option>
              </select>
            </div>

            <div class="col-6">貸出日</div>
            <div class="col-6">
              <input type="date" class="form-control form-control-sm" v-model="assignCheckoutDate" />
            </div>

            <div class="col-6">期限日</div>
            <div class="col-6">
              <input type="date" class="form-control form-control-sm" v-model="assignLimitDate" />
            </div>
            <div class="col-6">（最大）</div>
            <div class="col-6">{{ assignTarget.CARDLIMITDATE ?? '-' }}</div>

            <div class="col-6">メモ</div>
            <div class="col-6">
              <textarea class="form-control form-control-sm" v-model="assignDescription" rows="3" maxlength="128"></textarea>
            </div>
          </div>

          <p v-if="assignError" class="text-danger small mt-2">{{ assignError }}</p>
        </div>

        <div class="modal-footer">
          <button
            v-if="assignMode === 'fix' && assignTarget.CHILDSTATUS === '貸出中'"
            class="btn btn-outline-danger me-auto"
            @click="cancelCheckout"
            :disabled="assigning"
          >
            貸出を取り消す
          </button>
          <button class="btn btn-secondary" @click="closeAssignModal">閉じる</button>
          <button class="btn btn-primary" @click="submitAssign" :disabled="assigning">
            <span v-if="assigning"><i class="fas fa-spinner fa-spin"></i> 処理中...</span>
            <span v-else>{{ assignMode === 'checkout' ? '登録' : '更新' }}</span>
          </button>
        </div>

      </div>
    </div>
  </div>
  <div v-if="assignTarget" class="modal-backdrop fade show"></div>

  <!-- 一括貸出モーダル（#108） -->
  <div
    class="modal fade"
    :class="{ show: showBulkCheckoutModal }"
    :style="showBulkCheckoutModal ? 'display:block' : 'display:none'"
    tabindex="-1"
    role="dialog"
    @click.self="closeBulkCheckoutModal"
  >
    <div class="modal-dialog" role="document">
      <div class="modal-content" v-if="showBulkCheckoutModal">

        <div class="modal-header">
          <h5 class="modal-title">一括貸出（{{ selectedChildIds.length }}件選択中）</h5>
          <button type="button" class="btn-close" @click="closeBulkCheckoutModal"></button>
        </div>

        <div class="modal-body">
          <p class="text-muted small">
            選択したカードのうち「貸出可能」または「返却済」のものだけに、同じ内容で一括貸出します。
          </p>
          <div class="row g-2 align-items-center">
            <div class="col-6">奉仕者</div>
            <div class="col-6">
              <select class="form-select form-select-sm" v-model="bulkMinisterId">
                <option value="">-選択-</option>
                <option v-for="m in ministers" :key="m.UserID" :value="m.UserID">{{ m.UserName }}</option>
              </select>
            </div>

            <div class="col-6">貸出日</div>
            <div class="col-6">
              <input type="date" class="form-control form-control-sm" v-model="bulkCheckoutDate" />
            </div>

            <div class="col-6">期限日</div>
            <div class="col-6">
              <input type="date" class="form-control form-control-sm" v-model="bulkLimitDate" />
            </div>

            <div class="col-6">メモ</div>
            <div class="col-6">
              <textarea class="form-control form-control-sm" v-model="bulkDescription" rows="3" maxlength="128"></textarea>
            </div>
          </div>

          <p v-if="bulkError" class="text-danger small mt-2 mb-0">{{ bulkError }}</p>
          <p v-if="bulkResultMessage" class="small mt-2 mb-0">{{ bulkResultMessage }}</p>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeBulkCheckoutModal">閉じる</button>
          <button class="btn btn-primary" @click="submitBulkCheckout" :disabled="bulkProcessing">
            <span v-if="bulkProcessing"><i class="fas fa-spinner fa-spin"></i> 処理中...（{{ bulkProcessedCount }} / {{ selectedChildIds.length }}件）</span>
            <span v-else>一括貸出を実行</span>
          </button>
        </div>

      </div>
    </div>
  </div>
  <div v-if="showBulkCheckoutModal" class="modal-backdrop fade show"></div>

</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/store/authStore.js";
import GroupViewSwitcher from "@/components/GroupViewSwitcher.vue";
import { GROUP_VIEWS, setLastGroupView } from "@/services/groupViewPreference.js";
import {
  getGroupChildList, getMinisterOptions, assignChildMinister,
  returnChildCard, cancelChildCheckout, getChildUsageHistory,
  importChildUsageHistoryBatch, getChildUsageHistoryExportPage,
} from "@/services/api.js";
import CsvImportExportPanel from "@/components/CsvImportExportPanel.vue";

const router    = useRouter();
const authStore = useAuthStore();

const loading   = ref(false);
const cards     = ref([]);
const ministers = ref([]);

const filterMinisterId = ref("");
const filterStatus     = ref("");
const overdueOnly      = ref(false);

const assignTarget       = ref(null);
const assignMode         = ref("checkout"); // "checkout" | "fix"
const selectedMinisterId = ref("");
const assignCheckoutDate = ref("");
const assignLimitDate    = ref("");
const assignDescription  = ref("");
const assigning          = ref(false);
const assignError        = ref("");

// 貸出履歴アコーディオン（一度に1件のみ展開。CardListView.vueと同じ挙動）
const expandedChildId = ref(null);
const historyCache    = ref({});
const historyLoading  = ref(null);

// ---- 一括貸出・返却（#108） ----
const selectedChildIds     = ref([]);
const showBulkCheckoutModal = ref(false);
const bulkMinisterId        = ref("");
const bulkCheckoutDate      = ref("");
const bulkLimitDate         = ref("");
const bulkDescription       = ref("");
const bulkProcessing        = ref(false);
const bulkProcessedCount    = ref(0);
const bulkError             = ref("");
const bulkResultMessage     = ref("");

// 権限のあるユーザーのみ割当変更が可能（MainMenuViewの「グループページ」表示条件と同じ閾値）
const canAssign = computed(() => authStore.userRole >= 1010);
// CSVインポート/エクスポートは区域係/Gr監督以上(role>=1100)のみ（#8）
const canCsv = computed(() => authStore.userRole >= 1100);

const filteredCards = computed(() => {
  return cards.value.filter(c => {
    if (filterMinisterId.value && c.MINISTER !== filterMinisterId.value) return false;
    if (filterStatus.value && c.CHILDSTATUS !== filterStatus.value) return false;
    if (overdueOnly.value && !isOverdue(c)) return false;
    return true;
  });
});

// カードの色ラベル（赤/青/黄/緑/白/★）をCSS色に変換する（区域リスト画面と同一の配色）
const COLOR_MAP = { 赤: "#ffb6c1", 青: "#87cefa", 黄: "#ffd700", 緑: "#00FF00", "★": "#00FF00" };
function colorBg(color) {
  return COLOR_MAP[color] || "#e0e0e0";
}

function isOverdue(child) {
  if (!child.CHILDLIMITDATE) return false;
  return child.CHILDSTATUS === "貸出中" && child.CHILDLIMITDATE < new Date().toISOString().slice(0, 10);
}

// ステータスに関わらず、使用期限を過ぎたカードを一覧で薄く表示するための判定
function isPastLimit(child) {
  if (!child.CHILDLIMITDATE) return false;
  return child.CHILDLIMITDATE < new Date().toISOString().slice(0, 10);
}

// 親カード（区域カード）の使用期限日より子カードの使用期限日の方が後になっている場合に警告表示する
function isParentLimitBeforeChild(child) {
  return !!(child.CARDLIMITDATE && child.CHILDLIMITDATE && child.CARDLIMITDATE < child.CHILDLIMITDATE);
}

// 貸出可能・返却済で、かつ使用期限が到来していない子カードは「貸出」ボタンで貸し出せるようにする
function isCheckoutable(child) {
  if (child.CHILDSTATUS !== "貸出可能" && child.CHILDSTATUS !== "返却済") return false;
  if (!child.CHILDLIMITDATE) return true;
  return child.CHILDLIMITDATE >= new Date().toISOString().slice(0, 10);
}

function statusBadgeClass(status) {
  const map = {
    "貸出中":   "badge bg-warning text-dark",
    "貸出可能": "badge bg-success",
    "返却済":   "badge bg-info text-dark",
    "整備中":   "badge bg-secondary",
  };
  return map[status] || "badge bg-light text-dark";
}

async function fetchData() {
  loading.value = true;
  try {
    const [cardsRes, ministersRes] = await Promise.all([
      getGroupChildList(authStore.userGroup),
      getMinisterOptions(authStore.userGroup),
    ]);
    if (cardsRes.status === "success") {
      cards.value = cardsRes.cards || [];
      const stillExists = new Set(cards.value.map(c => c.CHILDID));
      selectedChildIds.value = selectedChildIds.value.filter(id => stillExists.has(id));
    }
    if (ministersRes.status === "success") ministers.value = ministersRes.ministers || [];
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

async function refresh() {
  await fetchData();
}

// 貸出履歴アコーディオンの開閉（一度に1件のみ展開）
async function toggleHistory(child) {
  if (expandedChildId.value === child.CHILDID) {
    expandedChildId.value = null;
    return;
  }
  expandedChildId.value = child.CHILDID;
  if (historyCache.value[child.CHILDID]) return;

  historyLoading.value = child.CHILDID;
  try {
    const res = await getChildUsageHistory(child.CARDNO, child.CHILDNO);
    historyCache.value[child.CHILDID] = res.status === "success" ? res.history : [];
  } catch (e) {
    console.error(e);
    historyCache.value[child.CHILDID] = [];
  } finally {
    historyLoading.value = null;
  }
}

function openChildMap(child) {
  router.push({
    name:   "childMap",
    params: { cardNo: child.CARDNO, childNo: child.CHILDNO },
  });
}

// 「貸出」ボタン：新規に貸し出す（奉仕者未選択・貸出日は今日を初期値にする）
function openCheckoutModal(child) {
  assignMode.value          = "checkout";
  assignTarget.value        = child;
  selectedMinisterId.value  = "";
  assignCheckoutDate.value  = new Date().toISOString().slice(0, 10);
  assignLimitDate.value     = child.CHILDLIMITDATE || "";
  assignDescription.value   = "";
  assignError.value         = "";
}

// ステータスピルのクリック：既存の貸出内容を修正する（貸出中なら貸出取消も可能）
function openFixModal(child) {
  assignMode.value          = "fix";
  assignTarget.value        = child;
  selectedMinisterId.value  = child.MINISTER || "";
  assignCheckoutDate.value  = child.CHILDCHECKOUTDATE || "";
  assignLimitDate.value     = child.CHILDLIMITDATE || "";
  assignDescription.value   = child.DESCRIPTION || "";
  assignError.value         = "";
}

// 返却：確認ダイアログの後、モーダルを介さず即座にステータスを返却済にする
async function returnCard(child) {
  if (!confirm(`${child.CARDNO}-${child.CHILDNO}のカードを返却します。よろしいですか？`)) return;
  try {
    const res = await returnChildCard(child.CHILDID);
    if (res.status === "success") {
      const idx = cards.value.findIndex(c => c.CHILDID === child.CHILDID);
      if (idx !== -1) {
        cards.value[idx].CHILDSTATUS       = res.child?.CHILDSTATUS ?? "返却済";
        cards.value[idx].CHILDCHECKOUTDATE = res.child?.CHILDCHECKOUTDATE ?? cards.value[idx].CHILDCHECKOUTDATE;
      }
      delete historyCache.value[child.CHILDID];
    } else {
      alert(res.message || "返却に失敗しました");
    }
  } catch (e) {
    alert(e.message);
  }
}

function closeAssignModal() {
  assignTarget.value = null;
}

async function submitAssign() {
  if (!assignTarget.value) return;

  if (!selectedMinisterId.value) {
    assignError.value = "貸し出す奉仕者名を選択してください。";
    return;
  }
  if (assignCheckoutDate.value && assignLimitDate.value && assignCheckoutDate.value > assignLimitDate.value) {
    assignError.value = "期限日は貸出日以降に設定してください。";
    return;
  }
  if (assignTarget.value.CARDLIMITDATE && assignLimitDate.value && assignLimitDate.value > assignTarget.value.CARDLIMITDATE) {
    assignError.value = "期限日は親カードの使用期限日（最大）を超えないように設定してください。";
    return;
  }

  assigning.value   = true;
  assignError.value = "";
  try {
    const res = await assignChildMinister(assignTarget.value.CHILDID, {
      ministerId:   selectedMinisterId.value || null,
      limitDate:    assignLimitDate.value || null,
      checkoutDate: assignCheckoutDate.value || null,
      description:  assignDescription.value,
    });
    if (res.status === "success") {
      const idx = cards.value.findIndex(c => c.CHILDID === assignTarget.value.CHILDID);
      if (idx !== -1) {
        cards.value[idx].MINISTER          = res.child?.MINISTER          ?? (selectedMinisterId.value || null);
        cards.value[idx].MINISTERNAME      = res.child?.MINISTERNAME      ?? (ministers.value.find(m => m.UserID === selectedMinisterId.value)?.UserName ?? "");
        if (res.child?.CHILDSTATUS)        cards.value[idx].CHILDSTATUS       = res.child.CHILDSTATUS;
        if (res.child?.CHILDSTARTDATE)     cards.value[idx].CHILDSTARTDATE    = res.child.CHILDSTARTDATE;
        if (res.child?.CHILDLIMITDATE)     cards.value[idx].CHILDLIMITDATE    = res.child.CHILDLIMITDATE;
        if (res.child?.CHILDCHECKOUTDATE)  cards.value[idx].CHILDCHECKOUTDATE = res.child.CHILDCHECKOUTDATE;
        cards.value[idx].DESCRIPTION = res.child?.DESCRIPTION ?? assignDescription.value;
      }
      delete historyCache.value[assignTarget.value.CHILDID];
      closeAssignModal();
    } else {
      assignError.value = res.message || "更新に失敗しました";
    }
  } catch (e) {
    assignError.value = e.message;
  } finally {
    assigning.value = false;
  }
}

// 貸出取消：貸出中の子カードを、親カードの使用期限日に応じて貸出可能／返却済に戻す
async function cancelCheckout() {
  if (!assignTarget.value) return;
  if (!confirm("取消を実行してもよろしいですか？")) return;

  assigning.value = true;
  try {
    const res = await cancelChildCheckout(assignTarget.value.CHILDID);
    if (res.status === "success") {
      const idx = cards.value.findIndex(c => c.CHILDID === assignTarget.value.CHILDID);
      if (idx !== -1) {
        cards.value[idx].CHILDSTATUS       = res.child?.CHILDSTATUS       ?? cards.value[idx].CHILDSTATUS;
        cards.value[idx].MINISTER          = res.child?.MINISTER          ?? null;
        cards.value[idx].MINISTERNAME      = res.child?.MINISTERNAME      ?? "";
        cards.value[idx].CHILDCHECKOUTDATE = res.child?.CHILDCHECKOUTDATE ?? cards.value[idx].CHILDCHECKOUTDATE;
      }
      delete historyCache.value[assignTarget.value.CHILDID];
      closeAssignModal();
    } else {
      assignError.value = res.message || "取消に失敗しました";
    }
  } catch (e) {
    assignError.value = e.message;
  } finally {
    assigning.value = false;
  }
}

// 一括貸出モーダルを開く（選択中のカードから初期値を推測する）
function openBulkCheckoutModal() {
  if (selectedChildIds.value.length === 0) return;

  // 選択中に「貸出中」のカードが含まれる場合は、除外して処理する旨を先に知らせる（#109）
  const targets = cards.value.filter(c => selectedChildIds.value.includes(c.CHILDID));
  if (targets.some(c => c.CHILDSTATUS === "貸出中")) {
    alert("貸出中のカードを除外した上で貸出処理を行います。");
  }

  bulkMinisterId.value     = "";
  bulkCheckoutDate.value   = new Date().toISOString().slice(0, 10);
  bulkLimitDate.value      = "";
  bulkDescription.value    = "";
  bulkError.value          = "";
  bulkResultMessage.value  = "";
  showBulkCheckoutModal.value = true;
}

function closeBulkCheckoutModal() {
  showBulkCheckoutModal.value = false;
}

// 一括貸出：選択中のうち「貸出可能」「返却済」（かつ期限内）のカードにのみ、同じ内容で貸出登録する
async function submitBulkCheckout() {
  if (!bulkMinisterId.value) {
    bulkError.value = "貸し出す奉仕者名を選択してください。";
    return;
  }
  if (bulkCheckoutDate.value && bulkLimitDate.value && bulkCheckoutDate.value > bulkLimitDate.value) {
    bulkError.value = "期限日は貸出日以降に設定してください。";
    return;
  }

  const targets = cards.value.filter(c => selectedChildIds.value.includes(c.CHILDID));
  const eligible = targets.filter(isCheckoutable);
  const skipped  = targets.length - eligible.length;

  bulkProcessing.value     = true;
  bulkProcessedCount.value = 0;
  bulkError.value          = "";
  bulkResultMessage.value  = "";
  let overLimitCount = 0;
  let failedCount     = 0;

  try {
    for (const child of eligible) {
      // 期限日は各カードの親カード使用期限日（最大）を超えないようにする（単発貸出と同じ制約）
      const limitDate = (child.CARDLIMITDATE && bulkLimitDate.value && bulkLimitDate.value > child.CARDLIMITDATE)
        ? child.CARDLIMITDATE
        : (bulkLimitDate.value || child.CHILDLIMITDATE || null);
      if (child.CARDLIMITDATE && bulkLimitDate.value && bulkLimitDate.value > child.CARDLIMITDATE) overLimitCount++;

      const res = await assignChildMinister(child.CHILDID, {
        ministerId:   bulkMinisterId.value,
        limitDate,
        checkoutDate: bulkCheckoutDate.value || null,
        description:  bulkDescription.value,
      });

      if (res.status === "success") {
        const idx = cards.value.findIndex(c => c.CHILDID === child.CHILDID);
        if (idx !== -1) {
          cards.value[idx].MINISTER          = res.child?.MINISTER          ?? bulkMinisterId.value;
          cards.value[idx].MINISTERNAME      = res.child?.MINISTERNAME      ?? (ministers.value.find(m => m.UserID === bulkMinisterId.value)?.UserName ?? "");
          if (res.child?.CHILDSTATUS)        cards.value[idx].CHILDSTATUS       = res.child.CHILDSTATUS;
          if (res.child?.CHILDSTARTDATE)     cards.value[idx].CHILDSTARTDATE    = res.child.CHILDSTARTDATE;
          if (res.child?.CHILDLIMITDATE)     cards.value[idx].CHILDLIMITDATE    = res.child.CHILDLIMITDATE;
          if (res.child?.CHILDCHECKOUTDATE)  cards.value[idx].CHILDCHECKOUTDATE = res.child.CHILDCHECKOUTDATE;
          cards.value[idx].DESCRIPTION = res.child?.DESCRIPTION ?? bulkDescription.value;
        }
        delete historyCache.value[child.CHILDID];
      } else {
        failedCount++;
      }
      bulkProcessedCount.value++;
    }

    const parts = [`${eligible.length - failedCount}件を貸出しました`];
    if (skipped > 0)      parts.push(`${skipped}件は貸出可能でないためスキップしました`);
    if (overLimitCount > 0) parts.push(`${overLimitCount}件は期限日を親カードの上限に合わせました`);
    if (failedCount > 0)  parts.push(`${failedCount}件は失敗しました`);
    bulkResultMessage.value = parts.join("／");

    if (failedCount === 0) {
      selectedChildIds.value = [];
      closeBulkCheckoutModal();
    }
  } catch (e) {
    bulkError.value = e.message;
  } finally {
    bulkProcessing.value = false;
  }
}

// 一括返却：選択中のうち「貸出中」のカードのみ返却する
async function bulkReturn() {
  if (selectedChildIds.value.length === 0) return;

  const targets  = cards.value.filter(c => selectedChildIds.value.includes(c.CHILDID));
  const eligible = targets.filter(c => c.CHILDSTATUS === "貸出中");
  const skipped  = targets.length - eligible.length;

  if (eligible.length === 0) {
    alert("選択したカードの中に、貸出中のものがありません。");
    return;
  }
  if (!confirm(`${eligible.length}件のカードを返却します。よろしいですか？${skipped > 0 ? `（貸出中でない${skipped}件はスキップされます）` : ""}`)) return;

  let failedCount = 0;
  for (const child of eligible) {
    try {
      const res = await returnChildCard(child.CHILDID);
      if (res.status === "success") {
        const idx = cards.value.findIndex(c => c.CHILDID === child.CHILDID);
        if (idx !== -1) {
          cards.value[idx].CHILDSTATUS       = res.child?.CHILDSTATUS ?? "返却済";
          cards.value[idx].CHILDCHECKOUTDATE = res.child?.CHILDCHECKOUTDATE ?? cards.value[idx].CHILDCHECKOUTDATE;
        }
        delete historyCache.value[child.CHILDID];
      } else {
        failedCount++;
      }
    } catch (e) {
      console.error(e);
      failedCount++;
    }
  }

  selectedChildIds.value = [];
  if (failedCount > 0) alert(`${failedCount}件の返却に失敗しました。`);
}

// ---- CSVインポート／エクスポート（子カード使用履歴, #5-2） ----
// 使用履歴は貸出サイクルごとの記録を積み上げていく履歴データのため、
// CSVインポートは常に追加（INSERT）のみで、更新・削除は行わない。
const USAGE_HISTORY_CSV_COLUMNS = [
  "id", "card_no", "child_no", "status", "minister",
  "checkout_date", "limit_date", "return_date", "description", "operator", "timestamp",
];

// テンプレート内はscript setupのref/computedが自動アンラップされるため、
// 名前付き関数として切り出し、通常のscript setupコードから明示的に
// .valueでアクセスする（DetailCsvView.vueと同じ理由）。
function getUsageHistoryExportFilters() {
  return { cardNos: [...new Set(filteredCards.value.map(c => c.CARDNO))] };
}

const EXPORT_PAGE_SIZE = 1000;

// importTarget指定時、実際のエクスポートはジョブ方式（CsvImportExportPanel側）を
// 使うため、この関数はプロップの都合上残しているだけで呼ばれない
// （DetailCsvView.vue等の他画面と同じ既存の慣習）。
async function exportUsageHistoryCsvRows() {
  const rows = [];
  let afterId = 0;
  for (;;) {
    const res = await getChildUsageHistoryExportPage(getUsageHistoryExportFilters(), afterId, EXPORT_PAGE_SIZE);
    rows.push(...(res.rows || []));
    if (!res.hasMore) break;
    afterId = res.lastId;
  }
  return rows;
}

async function importUsageHistoryCsvBatch(rows) {
  return importChildUsageHistoryBatch(rows);
}

onMounted(() => {
  setLastGroupView(GROUP_VIEWS.CHILD_LIST);
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

.cardno-badge {
  border: 2px solid #007bff;
  border-radius: 8px;
  padding: 2px 8px;
  font-weight: bold;
  margin-right: 6px;
  font-size: 14px;
  color: #212529;
}

.card-past-limit {
  background-color: #e9ecef;
  opacity: 0.85;
}
</style>
