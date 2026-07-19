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
        <div class="text-center flex-grow-1" style="font-size:22px; font-weight:700;">グループページ（奉仕者）</div>
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
      <GroupViewSwitcher :current="GROUP_VIEWS.MINISTER_ASSIGN" />
    </div>

    <p class="text-muted small">
      奉仕者ごとに、使用期限内で「貸出可能」または「返却済」の子カードを選んで割り当てます。
      貸出日は本日、期限日は各カードに設定済みの値をそのまま使用します。
    </p>

    <!-- 奉仕者一覧 -->
    <div v-for="minister in ministers" :key="minister.ID" class="card shadow-sm mb-3">
      <div class="card-body">
        <h5 class="card-title">{{ minister.UserName }}</h5>

        <div class="mb-2">
          <p class="small text-muted mb-1">現在の貸出中：</p>
          <p v-if="assignedTo(minister).length === 0" class="small text-muted">なし</p>
          <ul v-else class="small mb-0">
            <li v-for="c in assignedTo(minister)" :key="c.CHILDID">
              {{ c.CARDNO }}-{{ c.CHILDNO }} {{ c.CHILDBLOCK }}（期限：{{ c.CHILDLIMITDATE ?? "-" }}）
            </li>
          </ul>
        </div>

        <div v-if="availableCards.length > 0">
          <p class="small text-muted mb-1">割り当てる子カード：</p>
          <div class="d-flex flex-wrap gap-2 mb-2">
            <div v-for="c in availableCards" :key="c.CHILDID" class="form-check">
              <input
                type="checkbox"
                class="form-check-input"
                :id="`m${minister.ID}-c${c.CHILDID}`"
                :value="c.CHILDID"
                v-model="selection[minister.ID]"
              >
              <label class="form-check-label small" :for="`m${minister.ID}-c${c.CHILDID}`">
                {{ c.CARDNO }}-{{ c.CHILDNO }} {{ c.CHILDBLOCK }}
              </label>
            </div>
          </div>
          <button
            class="btn btn-sm btn-warning"
            :disabled="(selection[minister.ID] || []).length === 0 || assigning"
            @click="assignSelected(minister)"
          >
            <i class="fas fa-hand-holding"></i> 割当（{{ (selection[minister.ID] || []).length }}件）
          </button>
        </div>
        <p v-else class="small text-muted mb-0">割り当て可能な子カードがありません。</p>
      </div>
    </div>

    <div v-if="ministers.length === 0 && !loading" class="text-center text-muted mt-5">
      <i class="fas fa-user-slash fa-3x mb-3"></i>
      <p>グループに奉仕者が登録されていません</p>
    </div>

  </main>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/store/authStore.js";
import { getGroupChildList, getMinisterOptions, assignChildMinister } from "@/services/api.js";
import GroupViewSwitcher from "@/components/GroupViewSwitcher.vue";
import { GROUP_VIEWS, setLastGroupView } from "@/services/groupViewPreference.js";

const router    = useRouter();
const authStore = useAuthStore();

const loading   = ref(false);
const cards     = ref([]);
const ministers = ref([]);
const assigning = ref(false);

// 奉仕者ID -> 選択中のCHILDID配列
const selection = reactive({});

// 貸出可能・返却済で、かつ使用期限が到来していない子カードのみ割当対象にする（ChildListView.vueと同じ判定）
function isCheckoutable(child) {
  if (child.CHILDSTATUS !== "貸出可能" && child.CHILDSTATUS !== "返却済") return false;
  if (!child.CHILDLIMITDATE) return true;
  return child.CHILDLIMITDATE >= new Date().toISOString().slice(0, 10);
}

const availableCards = computed(() => cards.value.filter(isCheckoutable));

function assignedTo(minister) {
  return cards.value.filter(c => c.CHILDSTATUS === "貸出中" && Number(c.MINISTER) === Number(minister.ID));
}

async function fetchData() {
  loading.value = true;
  try {
    const [cardsRes, ministersRes] = await Promise.all([
      getGroupChildList(authStore.userGroup),
      getMinisterOptions(authStore.userGroup),
    ]);
    if (cardsRes.status === "success")     cards.value     = cardsRes.cards || [];
    if (ministersRes.status === "success") ministers.value = ministersRes.ministers || [];
    for (const m of ministers.value) {
      if (!selection[m.ID]) selection[m.ID] = [];
    }
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

// 選択した子カードを、この奉仕者へ一括で貸出登録する
async function assignSelected(minister) {
  const ids = selection[minister.ID] || [];
  if (ids.length === 0) return;
  if (!confirm(`${ids.length}件のカードを${minister.UserName}さんに貸し出します。よろしいですか？`)) return;

  const today   = new Date().toISOString().slice(0, 10);
  const targets = cards.value.filter(c => ids.includes(c.CHILDID));

  assigning.value = true;
  let failedCount = 0;
  try {
    for (const child of targets) {
      try {
        const res = await assignChildMinister(child.CHILDID, {
          ministerId:   minister.ID,
          limitDate:    child.CHILDLIMITDATE || null,
          checkoutDate: today,
          description:  child.DESCRIPTION || "",
        });
        if (res.status === "success") {
          const idx = cards.value.findIndex(c => c.CHILDID === child.CHILDID);
          if (idx !== -1) {
            cards.value[idx].MINISTER          = res.child?.MINISTER          ?? minister.ID;
            cards.value[idx].MINISTERNAME      = res.child?.MINISTERNAME      ?? minister.UserName;
            if (res.child?.CHILDSTATUS)        cards.value[idx].CHILDSTATUS       = res.child.CHILDSTATUS;
            if (res.child?.CHILDCHECKOUTDATE)  cards.value[idx].CHILDCHECKOUTDATE = res.child.CHILDCHECKOUTDATE;
          }
        } else {
          failedCount++;
        }
      } catch (e) {
        console.error(e);
        failedCount++;
      }
    }
    selection[minister.ID] = [];
    if (failedCount > 0) alert(`${failedCount}件の貸出に失敗しました。`);
  } finally {
    assigning.value = false;
  }
}

onMounted(() => {
  setLastGroupView(GROUP_VIEWS.MINISTER_ASSIGN);
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
</style>
