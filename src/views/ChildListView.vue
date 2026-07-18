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

    <!-- リスト絞込 -->
    <div class="row g-2 align-items-end mb-3">
      <div class="col-auto">
        <label class="form-label small mb-0">奉仕者</label>
        <select class="form-select form-select-sm" v-model="filterMinisterId">
          <option value="">全奉仕者</option>
          <option v-for="m in ministers" :key="m.ID" :value="m.ID">{{ m.UserName }}</option>
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

    <div class="mb-2"><h5>表示中の枚数：{{ filteredCards.length }}枚</h5></div>

    <!-- カード一覧 -->
    <div class="row g-3">
      <div class="col-12 col-sm-6" v-for="child in filteredCards" :key="child.CHILDID">
        <div class="card shadow-sm h-100">
          <div class="card-body" role="button" @click="openChildMap(child)">

            <div class="d-flex justify-content-between align-items-start mb-1">
              <h5 class="card-title mb-0">
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

            <div class="d-flex justify-content-end gap-2 mt-2" v-if="canAssign">
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
                <option v-for="m in ministers" :key="m.ID" :value="m.ID">{{ m.UserName }}</option>
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

</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/store/authStore.js";
import {
  getGroupChildList, getMinisterOptions, assignChildMinister,
  returnChildCard, cancelChildCheckout,
} from "@/services/api.js";

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

// 権限のあるユーザーのみ割当変更が可能（MainMenuViewの「グループページ」表示条件と同じ閾値）
const canAssign = computed(() => authStore.userRole >= 1010);

const filteredCards = computed(() => {
  return cards.value.filter(c => {
    if (filterMinisterId.value && Number(c.MINISTER) !== Number(filterMinisterId.value)) return false;
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
    if (cardsRes.status === "success")     cards.value     = cardsRes.cards     || [];
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
        cards.value[idx].MINISTERNAME      = res.child?.MINISTERNAME      ?? (ministers.value.find(m => Number(m.ID) === Number(selectedMinisterId.value))?.UserName ?? "");
        if (res.child?.CHILDSTATUS)        cards.value[idx].CHILDSTATUS       = res.child.CHILDSTATUS;
        if (res.child?.CHILDSTARTDATE)     cards.value[idx].CHILDSTARTDATE    = res.child.CHILDSTARTDATE;
        if (res.child?.CHILDLIMITDATE)     cards.value[idx].CHILDLIMITDATE    = res.child.CHILDLIMITDATE;
        if (res.child?.CHILDCHECKOUTDATE)  cards.value[idx].CHILDCHECKOUTDATE = res.child.CHILDCHECKOUTDATE;
        cards.value[idx].DESCRIPTION = res.child?.DESCRIPTION ?? assignDescription.value;
      }
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

onMounted(fetchData);
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
</style>
