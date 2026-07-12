<template>
  <!-- Bootstrap 5 モーダル（貸出／返却／修正の3モード共通） -->
  <div
    class="modal fade"
    :class="{ show: modelValue }"
    :style="modelValue ? 'display:block' : 'display:none'"
    tabindex="-1"
    role="dialog"
    @click.self="close"
  >
    <div class="modal-dialog modal-lg modal-dialog-scrollable" role="document">
      <div class="modal-content">

        <div class="modal-header">
          <h5 class="modal-title">
            {{ modalTitle }}
            <small class="text-muted ms-2">{{ card?.CardNo }}番 {{ card?.TownName }}</small>
          </h5>
          <button type="button" class="btn-close" @click="close"></button>
        </div>

        <div class="modal-body">
          <p class="mb-3">{{ modalMessage }}</p>

          <div class="row g-2">

            <div class="col-6" v-if="mode !== 'checkout'">
              <label class="form-label small">ステータス</label>
              <input class="form-control form-control-sm" :value="card?.Status" disabled />
            </div>

            <div class="col-6">
              <label class="form-label small">使用開始年月</label>
              <select
                v-if="mode === 'checkout'"
                class="form-select form-select-sm"
                v-model="form.Term"
                @change="onTermChange"
              >
                <option v-for="t in termOptions" :key="t.value" :value="t.value">{{ t.label }}</option>
              </select>
              <input v-else class="form-control form-control-sm" :value="termLabel" disabled />
            </div>

            <div class="col-6">
              <label class="form-label small">貸出先グループ</label>
              <select v-if="mode === 'checkout'" class="form-select form-select-sm" v-model="form.Group">
                <option v-for="g in groups" :key="g" :value="g">{{ g }}</option>
              </select>
              <input v-else class="form-control form-control-sm" :value="form.Group" disabled />
            </div>

            <div class="col-6">
              <label class="form-label small">責任者</label>
              <select
                v-if="mode === 'checkout' || mode === 'fix'"
                class="form-select form-select-sm"
                v-model.number="form.Arrenger"
              >
                <option v-for="u in users" :key="u.ID" :value="u.ID">{{ u.UserName }}</option>
              </select>
              <input v-else class="form-control form-control-sm" :value="arrengerDisplayName" disabled />
            </div>

            <div class="col-6" v-if="mode === 'checkout' || mode === 'fix'">
              <label class="form-label small">貸出日</label>
              <input type="date" class="form-control form-control-sm" v-model="form.CheckoutDate" />
            </div>

            <div class="col-6" v-if="mode === 'checkout' || mode === 'fix'">
              <label class="form-label small">使用期限</label>
              <input type="date" class="form-control form-control-sm" v-model="form.LimitDate" />
            </div>
            <div class="col-6" v-else-if="mode === 'return'">
              <label class="form-label small">使用期限</label>
              <input class="form-control form-control-sm" :value="form.LimitDate" disabled />
            </div>

            <div class="col-6" v-if="mode === 'return' || (mode === 'fix' && card?.Status === '返却済')">
              <label class="form-label small">返却日</label>
              <input
                type="date"
                class="form-control form-control-sm"
                v-model="form.ReturnDate"
                @change="onReturnDateChange"
              />
            </div>

            <div class="col-6" v-if="mode === 'fix' && card?.Status === '返却済'">
              <label class="form-label small">次回使用可能日</label>
              <input type="date" class="form-control form-control-sm" v-model="form.NextAvailableDate" />
            </div>

            <div class="col-12">
              <label class="form-label small">メモ</label>
              <textarea
                class="form-control form-control-sm"
                v-model="form.Description"
                rows="2"
                maxlength="128"
              ></textarea>
            </div>

            <div class="col-6" v-if="mode === 'fix'">
              <label class="form-label small">更新日時</label>
              <input class="form-control form-control-sm" :value="card?.Timestamp" disabled />
            </div>
            <div class="col-6" v-if="mode === 'fix'">
              <label class="form-label small">更新者</label>
              <input class="form-control form-control-sm" :value="card?.Operator" disabled />
            </div>
          </div>

          <p v-if="saveError" class="text-danger mt-2 small">{{ saveError }}</p>

          <!-- 整備中ステータスは元テンプレートにも更新ボタンが存在しない（レガシーの仕様上のギャップ） -->
          <p v-if="mode === 'fix' && card?.Status === '整備中'" class="text-muted small mt-2">
            整備中のカードはメモ以外の項目を修正できません。「完了」操作はカード一覧の操作ボタンから行ってください。
          </p>
        </div>

        <div class="modal-footer">
          <button
            v-if="mode === 'fix' && card?.Status === '返却済'"
            class="btn btn-outline-warning"
            @click="submit('revert')"
            :disabled="saving"
          >
            貸出中に戻す
          </button>
          <button
            v-if="mode === 'fix' && card?.Status === '貸出中'"
            class="btn btn-outline-danger"
            @click="cancelCheckout"
            :disabled="saving"
          >
            貸出を取り消す
          </button>
          <button
            v-if="mode === 'checkout' || mode === 'return' || (mode === 'fix' && card?.Status !== '整備中')"
            class="btn btn-primary"
            @click="submit('save')"
            :disabled="saving"
          >
            <span v-if="saving"><i class="fas fa-spinner fa-spin"></i> 保存中...</span>
            <span v-else>{{ mode === 'fix' ? '更新' : '登録' }}</span>
          </button>
          <button class="btn btn-secondary" @click="close">閉じる</button>
        </div>

      </div>
    </div>
  </div>
  <div v-if="modelValue" class="modal-backdrop fade show"></div>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { upsertCardList, cancelCardCheckout } from "@/services/api.js";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  card:       { type: Object, default: null },
  mode:       { type: String, default: "fix" }, // 'checkout' | 'return' | 'fix'
  groups:     { type: Array, default: () => [] },
  users:      { type: Array, default: () => [] },
});

const emit = defineEmits(["update:modelValue", "saved"]);

const saving    = ref(false);
const saveError = ref("");
const form      = ref({});

const termOptions = computed(() => generateTermOptions(3));

const modalTitle = computed(() => ({
  checkout: "貸出",
  return:   "返却",
  fix:      "修正",
}[props.mode] || "その他"));

const modalMessage = computed(() => {
  if (!props.card) return "";
  const base = `${props.card.CardNo}番：${props.card.TownName}の区域カードを`;
  if (props.mode === "checkout") return base + "「貸出中」にします。";
  if (props.mode === "return")   return base + "「返却済」にします。";
  return base + "の入出庫情報を修正します。";
});

const termLabel = computed(() => (form.value.Term ? isoToTermLabel(form.value.Term) : ""));

// 返却モード等、責任者が読み取り専用表示になる場合はIDをユーザー名に変換して表示する
const arrengerDisplayName = computed(() => {
  const id = form.value.Arrenger;
  return props.users.find(u => Number(u.ID) === Number(id))?.UserName ?? id ?? "-";
});

watch(() => props.modelValue, (open) => {
  if (!open || !props.card) return;
  saveError.value = "";
  initForm();
});

function initForm() {
  const c     = props.card;
  const today = todayISO();

  if (props.mode === "checkout") {
    const term = termOptions.value[0].value;
    form.value = {
      Term:              term,
      Group:             props.groups[0] ?? c.Group,
      Arrenger:          c.Arrenger ?? props.users[0]?.ID ?? null,
      CheckoutDate:      today,
      LimitDate:         computeLimitDate(term, c.Color),
      ReturnDate:        "",
      NextAvailableDate: "",
      Description:       "",
    };
  } else if (props.mode === "return") {
    form.value = {
      Term:              c.Term,
      Group:             c.Group,
      Arrenger:          c.Arrenger,
      CheckoutDate:      c.CheckoutDate,
      LimitDate:         c.LimitDate,
      ReturnDate:        today,
      NextAvailableDate: computeNextAvailableDate(today, c.Color),
      Description:       c.Description ?? "",
    };
  } else {
    // fix（修正）：現在の値を初期表示。返却済のときだけ返却日・次回使用可能日も編集可能にする
    form.value = {
      Term:              c.Term,
      Group:             c.Group,
      Arrenger:          c.Arrenger,
      CheckoutDate:      c.CheckoutDate,
      LimitDate:         c.LimitDate,
      ReturnDate:        c.ReturnDate || (c.Status === "返却済" ? today : ""),
      NextAvailableDate: c.NextAvailableDate || "",
      Description:       c.Description ?? "",
    };
  }
}

// 使用開始年月を変更したら使用期限を再計算する
function onTermChange() {
  form.value.LimitDate = computeLimitDate(form.value.Term, props.card.Color);
}

// 返却日を変更したら次回使用可能日を再計算する
function onReturnDateChange() {
  form.value.NextAvailableDate = computeNextAvailableDate(form.value.ReturnDate, props.card.Color);
}

async function submit(action) {
  if (!props.card) return;
  saving.value    = true;
  saveError.value = "";

  try {
    let targetStatus = props.card.Status;
    if (props.mode === "checkout")        targetStatus = "貸出中";
    else if (props.mode === "return")     targetStatus = "返却済";
    else if (action === "revert")         targetStatus = "貸出中"; // 修正-返却取消

    const record = {
      ...props.card,
      ...form.value,
      Status: targetStatus,
    };

    if (action === "revert" || props.mode === "checkout") {
      record.ReturnDate        = "";
      record.NextAvailableDate = "";
    }

    const res = await upsertCardList(record);
    if (res.status === "success") {
      emit("saved", res.card || record);
      emit("update:modelValue", false);
    } else {
      saveError.value = res.message || "保存に失敗しました";
    }
  } catch (e) {
    saveError.value = e.message;
  } finally {
    saving.value = false;
  }
}

// 「削除-貸出取消」：直近の貸出履歴を削除し、前回の状態（通常は返却済）に復元する
async function cancelCheckout() {
  if (!props.card) return;
  if (!confirm("取消を実行してもよろしいですか？")) return;

  saving.value    = true;
  saveError.value = "";
  try {
    const res = await cancelCardCheckout(props.card.CardNo);
    if (res.status === "success") {
      emit("saved", res.card);
      emit("update:modelValue", false);
    } else {
      saveError.value = res.message || "取消に失敗しました";
    }
  } catch (e) {
    saveError.value = e.message;
  } finally {
    saving.value = false;
  }
}

function close() {
  emit("update:modelValue", false);
}

// ----------------------------------------------------------------
// 日付ユーティリティ
// ----------------------------------------------------------------

function pad(n) { return String(n).padStart(2, "0"); }

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function firstDayISO(y, m) { return `${y}-${pad(m)}-01`; }

function lastDayISO(y, m) {
  const d = new Date(y, m, 0); // month(1-indexed)日=0 → その月の末日
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isoToTermLabel(iso) {
  if (!iso) return "";
  const [y, m] = iso.split("-");
  return `${y}年${m}月`;
}

function generateTermOptions(count) {
  const opts = [];
  const now  = new Date();
  let y = now.getFullYear();
  let m = now.getMonth() + 1;
  for (let i = 0; i < count; i++) {
    opts.push({ value: firstDayISO(y, m), label: `${y}年${pad(m)}月` });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return opts;
}

// 区域カードの色ごとの使用期限を計算する（ORIGINAL/CardList.html の getLimitDate を移植）
// 色ごとに4か月周期の休眠期間があり、周期の終端月の末日が使用期限になる（★は休眠なし＝当月末）
function computeLimitDate(termISO, color) {
  const d = new Date(termISO);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;

  switch (color) {
    case "白":
    case "緑":
      if (m < 5) return lastDayISO(y, 4);
      if (m < 9) return lastDayISO(y, 8);
      return lastDayISO(y, 12);
    case "黄":
      if (m < 2)  return lastDayISO(y, 1);
      if (m >= 10) return lastDayISO(y + 1, 1);
      if (m < 6)  return lastDayISO(y, 5);
      return lastDayISO(y, 9);
    case "青":
      if (m < 3)  return lastDayISO(y, 2);
      if (m >= 11) return lastDayISO(y + 1, 2);
      if (m < 7)  return lastDayISO(y, 6);
      return lastDayISO(y, 10);
    case "赤":
      if (m < 4)  return lastDayISO(y, 3);
      if (m >= 12) return lastDayISO(y + 1, 3);
      if (m < 8)  return lastDayISO(y, 7);
      return lastDayISO(y, 11);
    case "★":
      return lastDayISO(y, m); // 重点カードは休眠なし、当月末が使用期限
    default:
      return lastDayISO(y, m);
  }
}

// 区域カードの色ごとの次回使用可能日を計算する（ORIGINAL/CardList.html の getNextAvailableDate を移植）
// 元コードの★分岐は未定義変数を参照するバグがあったため、コメントの意図通り「休眠なし＝翌月1日」として実装している
function computeNextAvailableDate(returnISO, color) {
  const d = new Date(returnISO);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;

  switch (color) {
    case "白":
    case "緑":
      if (m < 2)  return firstDayISO(y, 2);
      if (m >= 10) return firstDayISO(y + 1, 2);
      if (m < 6)  return firstDayISO(y, 6);
      return firstDayISO(y, 10);
    case "黄":
      if (m < 3)  return firstDayISO(y, 3);
      if (m >= 11) return firstDayISO(y + 1, 3);
      if (m < 7)  return firstDayISO(y, 7);
      return firstDayISO(y, 11);
    case "青":
      if (m < 4)  return firstDayISO(y, 4);
      if (m >= 12) return firstDayISO(y + 1, 4);
      if (m < 8)  return firstDayISO(y, 8);
      return firstDayISO(y, 12);
    case "赤":
      if (m < 5)  return firstDayISO(y, 5);
      if (m >= 9) return firstDayISO(y + 1, 1);
      return firstDayISO(y, 9);
    case "★": {
      const nm = m === 12 ? 1 : m + 1;
      const ny = m === 12 ? y + 1 : y;
      return firstDayISO(ny, nm);
    }
    default:
      return firstDayISO(y, m);
  }
}
</script>
