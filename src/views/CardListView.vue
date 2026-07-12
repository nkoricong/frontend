<template>
  <!-- ローディング -->
  <div v-if="loading" class="loading-overlay">
    <div class="text-center">
      <div class="spinner-border text-primary" style="width:3rem;height:3rem;" role="status"></div>
      <p class="mt-3">区域リストを読み込み中...</p>
    </div>
  </div>

  <main role="main" class="container-fluid py-3">

    <!-- ヘッダー -->
    <header class="sticky-top bg-white mb-2 py-2 border-bottom">
      <div class="d-flex justify-content-between align-items-center">
        <button class="btn btn-link p-0 text-center" @click="router.push({ name: 'mainMenu' })">
          <i class="fas fa-arrow-circle-left fa-2x"></i>
          <div class="small">戻る</div>
        </button>
        <div class="text-center flex-grow-1" style="font-size:22px; font-weight:700;">区域リスト</div>
        <button class="btn btn-link p-0 text-center" @click="router.push({ name: 'mainMenu' })">
          <i class="fas fa-home fa-2x"></i>
          <div class="small">ホーム</div>
        </button>
      </div>
    </header>

    <div class="container">

      <!-- フィルタパネル -->
      <div class="card shadow-sm mb-3">
        <div class="card-body">
          <h6 class="mb-3"><i class="fas fa-filter"></i> リスト絞込</h6>

          <div class="row g-2 align-items-end">

            <div class="col-6 col-md-2">
              <label class="form-label small mb-1">グループ</label>
              <select class="form-select form-select-sm" v-model="filterGroup">
                <option value="ALL">全グループ</option>
                <option v-for="g in groupOptions" :key="g" :value="g">{{ g }}</option>
              </select>
            </div>

            <div class="col-6 col-md-2">
              <label class="form-label small mb-1">色</label>
              <select class="form-select form-select-sm" v-model="filterColor">
                <option value="ALL">全色</option>
                <option v-for="c in colorOptions" :key="c" :value="c">{{ c }}</option>
              </select>
            </div>

            <div class="col-6 col-md-2">
              <label class="form-label small mb-1">区域番号（From）</label>
              <input type="number" class="form-control form-control-sm" v-model.number="cardNoMin" min="1" placeholder="指定なし" />
            </div>

            <div class="col-6 col-md-2">
              <label class="form-label small mb-1">区域番号（To）</label>
              <input type="number" class="form-control form-control-sm" v-model.number="cardNoMax" min="1" placeholder="指定なし" />
            </div>

            <div class="col-6 col-md-2">
              <label class="form-label small mb-1">ステータス</label>
              <select class="form-select form-select-sm" v-model="filterStatus">
                <option value="ALL">全ステータス</option>
                <option value="貸出可能">貸出可能</option>
                <option value="返却済">返却済</option>
                <option value="貸出中">貸出中</option>
                <option value="整備中">整備中</option>
              </select>
            </div>

            <div class="col-6 col-md-2">
              <label class="form-label small mb-1">使用可否</label>
              <select class="form-select form-select-sm" v-model="filterUsability">
                <option value="ALL">問わず</option>
                <option value="使用可能">使用可能分のみ</option>
                <option value="使用不可">使用可能日未到来のみ</option>
              </select>
            </div>

            <div class="col-12 col-md-8">
              <label class="form-label small mb-1">地区・町名で検索</label>
              <input
                type="text"
                class="form-control form-control-sm"
                v-model="searchText"
                placeholder="地区名・町名の一部を入力"
              />
            </div>

            <div class="col-12 col-md-4 d-flex justify-content-end">
              <button class="btn btn-primary btn-sm w-100" @click="fetchData" :disabled="loading">
                <i class="fas fa-sync-alt"></i> 最新情報に更新
              </button>
            </div>

          </div>
        </div>
      </div>

      <div class="d-flex justify-content-between align-items-center mb-2">
        <h6 class="mb-0">表示中の枚数：{{ filteredCards.length }}枚</h6>
      </div>

      <!-- テーブル形式（PC） -->
      <div class="d-none d-md-block">
        <table class="table table-sm table-hover align-middle bg-white">
          <thead class="table-light">
            <tr>
              <th class="text-center">No.</th>
              <th>地区・町名</th>
              <th class="text-center">ステータス</th>
              <th class="text-center">枚数</th>
              <th>グループ／責任者</th>
              <th>貸出・期限</th>
              <th>メモ</th>
              <th class="text-center">履歴</th>
              <th v-if="canEdit" class="text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="card in filteredCards" :key="card.CardNo">
              <tr>
                <td class="text-center">
                  <span class="cardno-chip" :style="{ backgroundColor: colorBg(card.Color) }">{{ card.CardNo }}</span>
                </td>
                <td>
                  <button class="btn btn-link p-0 text-start fw-bold" @click="openCardMap(card)">
                    {{ card.TownName || card.Area }}
                  </button>
                  <div class="small text-muted">{{ card.Area }}（{{ card.Childs ?? 0 }}枚）</div>
                </td>
                <td class="text-center">
                  <button
                    class="btn btn-sm rounded-pill"
                    :style="statusPillStyle(card.Status)"
                    :disabled="!canEdit || savingCardNo === card.CardNo"
                    @click="openEditModal(card)"
                  >
                    {{ card.Status }}
                  </button>
                </td>
                <td class="text-center">{{ card.Childs ?? 0 }}</td>
                <td>
                  <div class="small">{{ card.Group || "-" }}</div>
                  <div class="small text-muted">責:{{ card.ArrengerName || card.Arrenger || "-" }}</div>
                </td>
                <td>
                  <div class="small">開始:{{ formatTerm(card.Term) }} ／ 貸出:{{ card.CheckoutDate || "-" }}</div>
                  <div v-if="card.Status === '貸出中'" class="small" :class="{ 'text-danger fw-bold': isOverdue(card) }">
                    使用期限:{{ card.LimitDate || "-" }}
                  </div>
                  <div v-else-if="card.Status === '返却済'" class="small" :class="{ 'text-danger fw-bold': card.Renew == 1 }">
                    次回使用可能日:{{ card.NextAvailableDate || "-" }}<span v-if="card.Renew == 1">※休眠期間不足</span>
                  </div>
                </td>
                <td class="small">{{ card.Description }}</td>
                <td class="text-center">
                  <button class="btn btn-link btn-sm p-0" @click="toggleHistory(card)">
                    履歴{{ expandedCardNo === card.CardNo ? "▲" : "▼" }}
                  </button>
                </td>
                <td v-if="canEdit" class="text-center">
                  <div v-if="card.Status === '返却済'" class="d-flex flex-column gap-1">
                    <button class="btn btn-sm btn-warning" :disabled="savingCardNo === card.CardNo" @click="openCheckoutModal(card)">貸出</button>
                    <button class="btn btn-sm btn-secondary" :disabled="savingCardNo === card.CardNo" @click="directChangeStatus(card, '整備中')">整備</button>
                  </div>
                  <div v-else-if="card.Status === '貸出中'">
                    <button class="btn btn-sm btn-info text-white" :disabled="savingCardNo === card.CardNo" @click="openReturnModal(card)">返却</button>
                  </div>
                  <div v-else-if="card.Status === '整備中'">
                    <button class="btn btn-sm btn-success" :disabled="savingCardNo === card.CardNo" @click="directChangeStatus(card, '返却済')">完了</button>
                  </div>
                </td>
              </tr>
              <tr v-if="expandedCardNo === card.CardNo">
                <td :colspan="canEdit ? 8 : 7" class="bg-light">
                  <div v-if="historyLoading === card.CardNo" class="text-center text-muted py-2">
                    <i class="fas fa-spinner fa-spin"></i> 履歴を読み込み中...
                  </div>
                  <table v-else class="table table-sm mb-0">
                    <thead>
                      <tr>
                        <th>開始年月</th><th>ステータス</th><th>Gr</th><th>責任者</th><th>貸出日</th><th>返却日</th><th>メモ</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="h in (historyCache[card.CardNo] || [])" :key="h.ID">
                        <td>{{ formatTerm(h.Term) }}</td>
                        <td>{{ h.Status }}</td>
                        <td>{{ h.Group }}</td>
                        <td>{{ h.ArrengerName }}</td>
                        <td>{{ h.CheckoutDate || "-" }}</td>
                        <td>{{ h.ReturnDate || "-" }}</td>
                        <td>{{ h.Description }}</td>
                      </tr>
                      <tr v-if="(historyCache[card.CardNo] || []).length === 0">
                        <td colspan="7" class="text-center text-muted">使用記録がありません</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- カード形式（スマホ） -->
      <div class="d-md-none">
        <div v-for="card in filteredCards" :key="card.CardNo" class="card shadow-sm mb-2" :style="{ borderLeft: `6px solid ${colorBg(card.Color)}` }">
          <div class="card-body py-2 px-3">
            <div class="d-flex justify-content-between align-items-start mb-1">
              <h6 class="mb-0">
                <span class="cardno-chip" :style="{ backgroundColor: colorBg(card.Color) }">{{ card.CardNo }}</span>
                <button class="btn btn-link p-0" @click="openCardMap(card)">{{ card.TownName || card.Area }}</button>
              </h6>
              <button
                class="btn btn-sm rounded-pill"
                :style="statusPillStyle(card.Status)"
                :disabled="!canEdit || savingCardNo === card.CardNo"
                @click="openEditModal(card)"
              >
                {{ card.Status }}
              </button>
            </div>

            <p class="mb-1 small text-muted">{{ card.Area }}／{{ card.Childs ?? 0 }}枚／{{ card.Group || "-" }}／責:{{ card.ArrengerName || card.Arrenger || "-" }}</p>

            <p v-if="card.Description" class="mb-1 small">{{ card.Description }}</p>

            <p class="mb-1 small">
              開始:{{ formatTerm(card.Term) }} ／ 貸出:{{ card.CheckoutDate || "-" }}<br />
              <span v-if="card.Status === '貸出中'" :class="{ 'text-danger fw-bold': isOverdue(card) }">
                使用期限:{{ card.LimitDate || "-" }}
              </span>
              <span v-else-if="card.Status === '返却済'" :class="{ 'text-danger fw-bold': card.Renew == 1 }">
                次回使用可能日:{{ card.NextAvailableDate || "-" }}<span v-if="card.Renew == 1">※休眠期間不足</span>
              </span>
            </p>

            <div v-if="canEdit" class="d-flex gap-2 mt-2">
              <template v-if="card.Status === '返却済'">
                <button class="btn btn-sm btn-warning" :disabled="savingCardNo === card.CardNo" @click="openCheckoutModal(card)">貸出</button>
                <button class="btn btn-sm btn-secondary" :disabled="savingCardNo === card.CardNo" @click="directChangeStatus(card, '整備中')">整備</button>
              </template>
              <template v-else-if="card.Status === '貸出中'">
                <button class="btn btn-sm btn-info text-white" :disabled="savingCardNo === card.CardNo" @click="openReturnModal(card)">返却</button>
              </template>
              <template v-else-if="card.Status === '整備中'">
                <button class="btn btn-sm btn-success" :disabled="savingCardNo === card.CardNo" @click="directChangeStatus(card, '返却済')">完了</button>
              </template>
            </div>

            <div class="mt-2">
              <button class="btn btn-link btn-sm p-0" @click="toggleHistory(card)">
                履歴{{ expandedCardNo === card.CardNo ? "▲" : "▼" }}
              </button>
              <div v-if="expandedCardNo === card.CardNo" class="mt-1 border-top pt-2">
                <div v-if="historyLoading === card.CardNo" class="text-center text-muted small py-1">
                  <i class="fas fa-spinner fa-spin"></i> 読み込み中...
                </div>
                <template v-else>
                  <div v-if="(historyCache[card.CardNo] || []).length === 0" class="small text-muted">使用記録がありません</div>
                  <div v-for="h in (historyCache[card.CardNo] || [])" :key="h.ID" class="small border-bottom py-1">
                    {{ formatTerm(h.Term) }}／{{ h.Status }}／{{ h.Group }}／責:{{ h.ArrengerName }}<br />
                    貸出:{{ h.CheckoutDate || "-" }} ／ 返却:{{ h.ReturnDate || "-" }}
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
        <p>表示する区域カードがありません</p>
      </div>

    </div>
  </main>

  <CardEditModal
    v-model="showModal"
    :card="modalCard"
    :mode="modalMode"
    :groups="groups"
    :users="users"
    @saved="onSaved"
  />
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/store/authStore.js";
import { getCardList, getGroupMaster, getUserMaster, upsertCardList, getCardUsageHistory } from "@/services/api.js";
import CardEditModal from "@/components/CardEditModal.vue";

// 区域リスト画面へのメニュー表示（MainMenuView.vue）と同じ閾値。
// レガシー版には区域リスト内での編集操作を別ロールで制限する記述が見当たらなかったため、
// 一旦は「ページにアクセスできるロールは編集もできる」として同じ閾値を採用している。
const EDIT_ROLE_THRESHOLD = 1100;

const router    = useRouter();
const authStore = useAuthStore();

const cards   = ref([]);
const groups  = ref([]);
const users   = ref([]);
const loading = ref(false);

const filterGroup     = ref("ALL");
const filterColor     = ref("ALL");
const filterStatus    = ref("ALL");
const filterUsability = ref("ALL");
const cardNoMin       = ref(null);
const cardNoMax       = ref(null);
const searchText      = ref("");

const showModal     = ref(false);
const modalCard     = ref(null);
const modalMode     = ref("fix"); // 'checkout' | 'return' | 'fix'
const savingCardNo  = ref(null);

// 貸出履歴アコーディオン（一度に1件のみ展開。オリジナル版のbootstrapアコーディオンと同じ挙動）
const expandedCardNo = ref(null);
const historyCache   = ref({});
const historyLoading = ref(null);

const colorOptions = ["赤", "白", "黄", "青", "緑", "★"];

const canEdit = computed(() => authStore.userRole >= EDIT_ROLE_THRESHOLD);

const groupOptions = computed(() => {
  const set = new Set(groups.value);
  cards.value.forEach(c => { if (c.Group) set.add(c.Group); });
  return [...set].sort();
});

// 貸出可能＝返却済かつ次回使用可能日が翌月1日以前（ORIGINAL/CardList.html getCardList の Opt4=='貸出可能' 判定を移植）
function isAvailableForLoan(card) {
  if (card.Status !== "返却済" || !card.NextAvailableDate) return false;
  return new Date(card.NextAvailableDate) <= nextMonthFirstDate();
}

// 使用可否（次回使用可能日が翌月1日以前かどうか）
function isUsable(card) {
  if (!card.NextAvailableDate) return false;
  return new Date(card.NextAvailableDate) <= nextMonthFirstDate();
}

function nextMonthFirstDate() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth() + 1, 1);
}

function isOverdue(card) {
  if (card.Status !== "貸出中" || !card.LimitDate) return false;
  return new Date(card.LimitDate) < new Date(new Date().toDateString());
}

const filteredCards = computed(() => {
  return cards.value.filter(card => {
    if (filterGroup.value !== "ALL" && card.Group !== filterGroup.value) return false;
    if (filterColor.value !== "ALL" && card.Color !== filterColor.value) return false;
    if (cardNoMin.value != null && cardNoMin.value !== "" && card.CardNo < cardNoMin.value) return false;
    if (cardNoMax.value != null && cardNoMax.value !== "" && card.CardNo > cardNoMax.value) return false;

    if (filterStatus.value === "貸出可能") {
      if (!isAvailableForLoan(card)) return false;
    } else if (filterStatus.value !== "ALL" && card.Status !== filterStatus.value) {
      return false;
    }

    if (filterUsability.value === "使用可能" && !isUsable(card)) return false;
    if (filterUsability.value === "使用不可" && isUsable(card)) return false;

    if (searchText.value) {
      const kw = searchText.value.toLowerCase();
      const hay = `${card.Area ?? ""}${card.TownName ?? ""}`.toLowerCase();
      if (!hay.includes(kw)) return false;
    }

    return true;
  });
});

// 区域カードの色に応じた背景色（ORIGINAL/シート操作.js getColorCode を移植。★の色コードは元コードのまま緑と同一）
function colorBg(color) {
  const map = { 赤: "#ffb6c1", 青: "#87cefa", 黄: "#ffd700", 緑: "#00FF00", "★": "#00FF00" };
  return map[color] || "#e0e0e0";
}

// ステータスピルの色（オリジナル版のBootstrap4色をそのまま踏襲。BS5のutilityクラスでは
// bg-info/bg-successの色調がBS4と異なるため、hex直指定で色を合わせている）
const STATUS_COLORS = {
  "貸出中": { bg: "#ffc107", color: "#212529" },
  "返却済": { bg: "#17a2b8", color: "#fff" },
  "整備中": { bg: "#6c757d", color: "#fff" },
  "完了":   { bg: "#28a745", color: "#fff" },
};

function statusPillStyle(status) {
  const c = STATUS_COLORS[status] || STATUS_COLORS["整備中"];
  return { backgroundColor: c.bg, color: c.color };
}

function formatTerm(term) {
  if (!term) return "-";
  const [y, m] = String(term).split("-");
  return m ? `${y}年${m}月` : term;
}

function openCardMap(card) {
  router.push({ name: "cardMap", params: { cardNo: card.CardNo } });
}

function openEditModal(card) {
  modalCard.value = card;
  modalMode.value = "fix";
  showModal.value = true;
}

function openCheckoutModal(card) {
  modalCard.value = card;
  modalMode.value = "checkout";
  showModal.value = true;
}

function openReturnModal(card) {
  modalCard.value = card;
  modalMode.value = "return";
  showModal.value = true;
}

function applyUpdatedCard(updated) {
  const idx = cards.value.findIndex(c => c.CardNo === updated.CardNo);
  if (idx !== -1) cards.value[idx] = { ...cards.value[idx], ...updated };
}

function onSaved(updatedCard) {
  applyUpdatedCard(updatedCard);
  // ステータスが変わると履歴も変わるため、キャッシュを破棄して再表示時に取り直す
  if (updatedCard?.CardNo != null) delete historyCache.value[updatedCard.CardNo];
}

// 貸出履歴アコーディオンの開閉（一度に1件のみ展開）
async function toggleHistory(card) {
  if (expandedCardNo.value === card.CardNo) {
    expandedCardNo.value = null;
    return;
  }
  expandedCardNo.value = card.CardNo;
  if (historyCache.value[card.CardNo]) return;

  historyLoading.value = card.CardNo;
  try {
    const res = await getCardUsageHistory(card.CardNo);
    historyCache.value[card.CardNo] = res.status === "success" ? res.history : [];
  } catch (e) {
    console.error(e);
    historyCache.value[card.CardNo] = [];
  } finally {
    historyLoading.value = null;
  }
}

// 整備／完了のようにモーダルを介さない直接ステータス変更（ORIGINAL/CardList.html changeCardStatus を移植）
async function directChangeStatus(card, targetStatus) {
  savingCardNo.value = card.CardNo;
  try {
    const record = { ...card, Status: targetStatus };
    const res = await upsertCardList(record);
    if (res.status === "success") {
      applyUpdatedCard(res.card || record);
    }
  } catch (e) {
    console.error(e);
  } finally {
    savingCardNo.value = null;
  }
}

async function fetchData() {
  loading.value = true;
  try {
    const [cardRes, groupRes, userRes] = await Promise.all([
      getCardList(),
      getGroupMaster(),
      getUserMaster(),
    ]);
    if (cardRes.status === "success")  cards.value  = cardRes.cards  || [];
    if (groupRes.status === "success") groups.value = groupRes.groups || [];
    if (userRes.status === "success")  users.value  = userRes.users  || [];
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

onMounted(fetchData);
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

.cardno-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  padding: 2px 8px;
  border: 1px solid rgba(0,0,0,0.15);
  border-radius: 8px;
  font-weight: bold;
  font-size: 14px;
  color: #333;
  margin-right: 6px;
}
</style>
