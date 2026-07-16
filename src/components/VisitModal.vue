<template>
  <!-- Bootstrap 5 モーダル -->
  <div
    class="modal fade"
    :class="{ show: modelValue }"
    :style="modelValue ? 'display:block' : 'display:none'"
    tabindex="-1"
    role="dialog"
    @click.self="$emit('update:modelValue', false)"
  >
    <div class="modal-dialog modal-lg modal-dialog-scrollable" role="document">
      <div class="modal-content">

        <!-- ヘッダー -->
        <div class="modal-header">
          <h5 class="modal-title">
            住戸 #{{ house?.HousingNo }} {{ mode === 'history' ? '訪問履歴' : '訪問記録' }}
            <small class="text-muted ms-2">{{ house?.BuildingName }} {{ house?.RoomNo }}</small>
          </h5>
          <button type="button" class="btn-close" @click="$emit('update:modelValue', false)"></button>
        </div>

        <!-- ボディ -->
        <div class="modal-body">

          <!-- 訪問履歴タイムライン -->
          <template v-if="mode === 'history'">
            <div v-if="house?.VRecord && house.VRecord.length > 0" class="visit-record-timeline mb-3">
              <div
                v-for="r in sortedVRecord"
                :key="r.VisitID"
                class="visit-record-item"
              >
                <div class="d-flex justify-content-between align-items-start">
                  <div>
                    <span class="badge bg-secondary me-1">{{ r.VisitDate }}</span>
                    <span class="badge bg-light text-dark me-1">{{ r.Time }}</span>
                    <strong class="badge" :style="resultBadgeStyle(r.Result)">{{ r.Result }}</strong>
                    <span v-if="r.Minister" class="ms-1 small text-muted">（{{ r.Minister }}）</span>
                  </div>
                  <button
                    class="btn btn-sm btn-outline-danger"
                    @click="deleteRecord(r)"
                    :disabled="saving || (!isPendingRecord(r) && !online)"
                  >
                    <i class="fas fa-trash-alt"></i>
                  </button>
                </div>
                <span v-if="isPendingRecord(r)" class="badge bg-warning text-dark">未同期</span>
                <p v-if="r.Comment" class="mb-0 small">{{ r.Comment }}</p>
                <p v-if="r.Note"    class="mb-0 small text-muted">{{ r.Note }}</p>
              </div>
            </div>
            <p v-else class="text-muted small">訪問履歴はありません</p>
          </template>

          <!-- 新規登録フォーム -->
          <div v-else class="row g-2">

            <div class="col-6">
              <label class="form-label small">訪問日</label>
              <input type="date" class="form-control form-control-sm" v-model="form.VisitDate" />
            </div>

            <div class="col-12">
              <label class="form-label small d-block">時間帯</label>
              <div class="form-check form-check-inline" v-for="t in TIME_OPTIONS" :key="t">
                <input class="form-check-input" type="radio" :id="`time-${t}`" :value="t" v-model="form.Time">
                <label class="form-check-label small" :for="`time-${t}`">{{ t }}</label>
              </div>
            </div>

            <div class="col-12">
              <label class="form-label small d-block">結果</label>
              <div class="form-check form-check-inline" v-for="r in RESULT_OPTIONS" :key="r">
                <input class="form-check-input" type="radio" :id="`result-${r}`" :value="r" v-model="form.Result">
                <label class="form-check-label small" :for="`result-${r}`">{{ r }}</label>
              </div>
            </div>

            <div class="col-6">
              <label class="form-label small">担当者</label>
              <div v-if="offlineUser" class="form-control form-control-sm bg-light">
                {{ form.Minister || "-" }}
              </div>
              <select v-else class="form-select form-select-sm" v-model="form.Minister">
                <option value="">選択してください</option>
                <option v-for="u in users" :key="u.ID" :value="u.UserName">{{ u.UserName }}</option>
              </select>
            </div>

            <div class="col-12">
              <label class="form-label small">コメント</label>
              <textarea class="form-control form-control-sm" v-model="form.Comment" rows="2"></textarea>
            </div>

            <div class="col-12">
              <label class="form-label small">メモ</label>
              <textarea class="form-control form-control-sm" v-model="form.Note" rows="2"></textarea>
            </div>

            <!-- NG フラグ -->
            <div class="col-12">
              <div class="form-check">
                <input class="form-check-input" type="checkbox" id="ngCheck" v-model="ngFlagEnabled" />
                <label class="form-check-label small" for="ngCheck">訪問不可（NG）に設定する</label>
              </div>
            </div>

          </div>

          <p v-if="saveError" class="text-danger mt-2 small">{{ saveError }}</p>
        </div>

        <!-- フッター -->
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="$emit('update:modelValue', false)">閉じる</button>
          <button v-if="mode !== 'history'" class="btn btn-primary" @click="submitRecord" :disabled="saving">
            <span v-if="saving"><i class="fas fa-spinner fa-spin"></i> 保存中...</span>
            <span v-else><i class="fas fa-save"></i> 保存</span>
          </button>
        </div>

      </div>
    </div>
  </div>
  <div v-if="modelValue" class="modal-backdrop fade show"></div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { upsertVisitRecord, deleteVisitRecord, getUserMaster } from "@/services/api.js";
import { useAuthStore } from "@/store/authStore.js";
import { useOnlineStatus, isOnline, queueOfflineVisit, removeOfflineVisit } from "@/services/offline.js";

const props = defineProps({
  modelValue:  { type: Boolean, default: false },
  house:       { type: Object, default: null },
  mode:        { type: String, default: "add" }, // 'add' | 'history'
  childId:     { type: [String, Number], default: null },
  // オフラインモード（未ログインでのキャッシュ閲覧含む）で子カードを開いている場合、
  // その子カードをオフライン化した時点のユーザー情報。指定時は担当者選択欄の代わりに
  // このユーザー名を固定表示し、選択操作を不要にする。
  offlineUser: { type: Object, default: null },
});

const online = useOnlineStatus();

function isPendingRecord(r) {
  return typeof r.VisitID === "string" && r.VisitID.startsWith("local_");
}

const emit = defineEmits(["update:modelValue", "saved", "deleted"]);

const authStore = useAuthStore();

const TIME_OPTIONS   = ["9時以前", "9時〜12時", "12時〜13時", "13時〜16時", "16時〜18時", "18時以降"];
const RESULT_OPTIONS = ["済", "済(投函)", "済(留守録)", "不在", "訪問不可"];

// 訪問結果ごとの背景色（済=緑, 不在=薄い灰色, 拒否=赤）
const RESULT_COLORS = {
  "済":        { bg: "#28a745", color: "#fff" },
  "済(投函)":  { bg: "#28a745", color: "#fff" },
  "済(留守録)": { bg: "#28a745", color: "#fff" },
  "不在":      { bg: "#e9ecef", color: "#212529" },
  "訪問不可":   { bg: "#dc3545", color: "#fff" },
  "拒否":      { bg: "#dc3545", color: "#fff" },
};

function resultBadgeStyle(result) {
  const c = RESULT_COLORS[result];
  return c ? { backgroundColor: c.bg, color: c.color } : {};
}

const saving        = ref(false);
const saveError     = ref("");
const ngFlagEnabled = ref(false);
const users         = ref([]);

const form = ref({
  VisitDate: new Date().toISOString().slice(0, 10),
  Time:      "",
  Result:    "",
  Minister:  "",
  Comment:   "",
  Note:      "",
});

onMounted(async () => {
  // オフラインモードでは担当者欄は固定表示のみのため、ユーザー一覧の取得は不要
  if (props.offlineUser) return;

  try {
    const res = await getUserMaster();
    if (res.status === "success") users.value = res.users || [];
  } catch (e) {
    console.error(e);
  }
  // オフライン等で取得できなかった場合、担当者選択にログイン中の自分だけは出す
  if (users.value.length === 0 && authStore.userName) {
    users.value = [{ ID: authStore.userId ?? 0, UserName: authStore.userName }];
  }
});

// モーダルが開くたびにフォームをリセット（担当者はログインユーザー、
// オフラインモードではオフライン化した時点のユーザーを初期値にする）
watch(() => props.modelValue, (v) => {
  if (v) {
    form.value = {
      VisitDate: new Date().toISOString().slice(0, 10),
      Time:      "",
      Result:    "",
      Minister:  props.offlineUser?.userName || authStore.userName || "",
      Comment:   "",
      Note:      "",
    };
    ngFlagEnabled.value = false;
    saveError.value     = "";
  }
});

// VRecord を日付降順にソート
const sortedVRecord = computed(() => {
  return [...(props.house?.VRecord || [])].sort((a, b) =>
    b.VisitDate?.localeCompare(a.VisitDate ?? "") ?? 0
  );
});

async function submitRecord() {
  if (!form.value.VisitDate || !form.value.Result) {
    saveError.value = "訪問日と結果は必須です";
    return;
  }
  saving.value    = true;
  saveError.value = "";

  const record = {
    CardNo:    props.house.CardNo,
    ChildNo:   props.house.ChildNo,
    HousingNo: props.house.HousingNo,
    NGFlag:    ngFlagEnabled.value ? "不可" : "",
    ...form.value,
  };

  // オフライン時は端末内にキューイングし、Supabaseへは同期時にまとめて書き込む
  if (!isOnline()) {
    const result = queueOfflineVisit(props.childId, record, props.house);
    saving.value = false;
    if (!result) {
      saveError.value = "オフラインのため保存できません（この子カードはオフライン保存されていません）";
      return;
    }
    emit("saved", { house: props.house, visitStatus: result.visitStatus, offline: true });
    emit("update:modelValue", false);
    return;
  }

  try {
    const res = await upsertVisitRecord(record);
    if (res.status === "success") {
      emit("saved", { house: props.house, visitStatus: res.visitStatus, offline: false });
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

async function deleteRecord(record) {
  if (!confirm("この訪問記録を削除しますか？")) return;

  // 未同期（オフラインでローカルにのみ存在）の記録はネット不要でそのまま削除する
  if (isPendingRecord(record)) {
    const result = removeOfflineVisit(props.childId, record.VisitID, props.house);
    emit("deleted", { house: props.house, visitStatus: result?.visitStatus ?? props.house?.VisitStatus, offline: true });
    emit("update:modelValue", false);
    return;
  }

  if (!isOnline()) {
    saveError.value = "オフラインのため、この記録は削除できません";
    return;
  }

  saving.value = true;
  try {
    const res = await deleteVisitRecord(record.VisitID);
    if (res.status === "success") {
      emit("deleted", { house: props.house, visitStatus: res.visitStatus, offline: false });
      emit("update:modelValue", false);
    }
  } catch (e) {
    saveError.value = e.message;
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.visit-record-timeline {
  border-left: 3px solid #6c757d;
  margin-left: 0.5rem;
  padding-left: 0.75rem;
}

.visit-record-item {
  margin-bottom: 0.75rem;
  position: relative;
}

.visit-record-item::before {
  content: "";
  position: absolute;
  left: -1.1rem;
  top: 0.3rem;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: #6c757d;
}
</style>
