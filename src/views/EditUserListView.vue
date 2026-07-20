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

    <div class="text-center my-3">
      <h2><i class="far fa-list-alt"></i> ユーザーリストの編集</h2>
    </div>

    <!-- 権限なし -->
    <div v-if="!authorized" class="alert alert-danger text-center">
      このページを表示する権限がありません。（管理者権限が必要です）
    </div>

    <template v-else>

      <!-- 検索・フィルタバー -->
      <div class="row g-2 align-items-end mb-3">
        <div class="col-12 col-md-4">
          <label class="form-label small mb-0">氏名で検索</label>
          <input type="text" class="form-control" v-model="searchName" placeholder="例）真理太郎" />
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label small mb-0">グループ</label>
          <select class="form-select" v-model="searchGroup">
            <option value="">全て</option>
            <option v-for="g in groupOptions" :key="g" :value="g">{{ g }}</option>
          </select>
        </div>
        <div class="col-6 col-md-3">
          <label class="form-label small mb-0">役割</label>
          <select class="form-select" v-model="searchRole">
            <option value="">全て</option>
            <option value="9001">管理者(9001+)</option>
            <option value="1100">区域係/Gr監督(1100+)</option>
            <option value="1010">Gr内係(1010+)</option>
            <option value="1001">設定可(1001+)</option>
          </select>
        </div>
        <div class="col-12 col-md-2 text-md-end">
          <button class="btn btn-primary w-100" @click="openCreateModal">
            <i class="fas fa-plus-circle"></i> 新規作成
          </button>
        </div>
      </div>

      <div class="mb-2 d-flex justify-content-between align-items-center flex-wrap gap-2">
        <strong>件数：{{ filteredUsers.length }}件</strong>
        <CsvImportExportPanel
          title="ユーザーマスタ"
          :columns="CSV_COLUMNS"
          :batch-size="5"
          :has-delete-sync-option="true"
          format-template-filename="ユーザーマスタCSVフォーマット.csv"
          export-filename="ユーザーマスタ.csv"
          :export-rows="exportCsvRows"
          :import-batch="importCsvBatch"
          :delete-missing-rows="deleteMissingCsvRows"
          :extract-existing-keys="() => users.map(u => Number(u.ID))"
          :extract-csv-key="row => Number(row.ID)"
          @imported="fetchUsers"
        />
      </div>

      <!-- ユーザー一覧テーブル -->
      <div class="table-responsive">
        <table class="table table-sm table-striped align-middle">
          <thead class="table-secondary">
            <tr>
              <th>UserID</th>
              <th>氏名</th>
              <th>ローマ字</th>
              <th>グループ</th>
              <th>役割</th>
              <th>Site</th>
              <th>メール</th>
              <th>状態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in filteredUsers" :key="u.ID">
              <td>{{ u.UserID }}</td>
              <td><b>{{ u.UserName }}</b> {{ u.BS }}</td>
              <td>{{ u.UserKana }}</td>
              <td>{{ u.Group }}</td>
              <td>
                <span :class="roleBadgeClass(u.Role)">{{ roleLabel(u.Role) }}</span>
                <span class="text-muted small">（{{ u.Role }}）</span>
              </td>
              <td>{{ u.Site }}</td>
              <td>
                <span v-if="isFlagOn(u.Mail1FLG) && u.Mail1" class="badge bg-light text-dark border me-1" :title="u.Mail1">Mail1</span>
                <span v-if="isFlagOn(u.Mail2FLG) && u.Mail2" class="badge bg-light text-dark border me-1" :title="u.Mail2">Mail2</span>
                <span v-if="isFlagOn(u.Mail3FLG) && u.Mail3" class="badge bg-light text-dark border me-1" :title="u.Mail3">Mail3</span>
              </td>
              <td>
                <span v-if="isFlagOn(u.StopFLG)" class="badge bg-danger">停止中</span>
                <span v-else class="badge bg-success">有効</span>
              </td>
              <td class="text-nowrap">
                <button class="btn btn-sm alert-primary me-1" @click="openEditModal(u)">編集</button>
                <button class="btn btn-sm btn-warning" @click="handleDelete(u)">削除</button>
              </td>
            </tr>
            <tr v-if="filteredUsers.length === 0">
              <td colspan="9" class="text-center text-muted py-4">該当するユーザーがいません</td>
            </tr>
          </tbody>
        </table>
      </div>

    </template>
  </main>

  <!-- ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++ -->
  <!-- +++ 編集／新規作成モーダル ++++++++++++++++++++++++++++++++++++++++++++ -->
  <!-- ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++ -->
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
          <h5 class="modal-title">{{ isNew ? 'ユーザーの新規作成' : 'ユーザー情報の編集' }}</h5>
          <button type="button" class="btn-close" @click="closeModal"></button>
        </div>

        <div class="modal-body">
          <div class="row g-2">

            <div class="col-12" v-if="!isNew">
              <span class="text-muted small">ID：{{ form.ID }}</span>
            </div>

            <div class="col-8">
              <label class="form-label small">氏名</label>
              <input type="text" class="form-control" v-model="form.UserName" placeholder="例）真理太郎" />
            </div>
            <div class="col-4">
              <label class="form-label small">敬称</label>
              <select class="form-select" v-model="form.BS">
                <option value="兄弟">兄弟</option>
                <option value="姉妹">姉妹</option>
                <option value="さん">さん</option>
              </select>
            </div>

            <div class="col-12">
              <label class="form-label small">ローマ字表記（UserKana）</label>
              <input type="text" class="form-control" v-model="form.UserKana" placeholder="ex) ShinriTaro" />
            </div>

            <div class="col-6">
              <label class="form-label small">UserID</label>
              <input type="text" class="form-control" v-model="form.UserID" placeholder="ex) user@gmail.com" />
            </div>
            <div class="col-6">
              <label class="form-label small">Authority</label>
              <input type="number" class="form-control" v-model.number="form.Authority" />
            </div>

            <div class="col-6">
              <label class="form-label small">グループ</label>
              <input type="text" class="form-control" v-model="form.Group" list="groupDatalist" placeholder="例）1班" />
              <datalist id="groupDatalist">
                <option v-for="g in groupOptions" :key="g" :value="g" />
              </datalist>
            </div>
            <div class="col-6">
              <label class="form-label small">Site</label>
              <input type="text" class="form-control" v-model="form.Site" />
            </div>

            <div class="col-12">
              <label class="form-label small">役割（Role）</label>
              <input type="number" class="form-control" v-model.number="form.Role" />
              <div class="form-text">
                9001以上：管理者設定 ／ 1100以上：区域リスト ／ 1010以上：グループページ ／ 1001以上：設定
              </div>
            </div>

            <div class="col-12">
              <div class="form-check">
                <input type="checkbox" class="form-check-input" id="stopFlag" v-model="form.StopFLG" :true-value="1" :false-value="0" />
                <label class="form-check-label" for="stopFlag">このユーザーを停止する</label>
              </div>
              <div class="form-text">
                停止すると、UserID・メール1〜3に対応するFirebase Authenticationアカウントが無効化され、ログインできなくなります。
              </div>
            </div>

            <div class="col-12"><hr /></div>

            <!-- メールアドレス x3 -->
            <div class="col-12" v-for="n in 3" :key="n">
              <label class="form-label small">メール{{ n }}（ログイン照合用）</label>
              <div class="input-group">
                <div class="input-group-text">
                  <input type="checkbox" class="form-check-input mt-0" v-model="form['Mail' + n + 'FLG']" :true-value="1" :false-value="0" />
                </div>
                <input type="email" class="form-control" v-model="form['Mail' + n]" placeholder="ex) user@example.com" />
              </div>
            </div>
            <div class="col-12">
              <small class="text-muted">チェックを入れたメールアドレスのいずれかが、Firebaseログインのメールアドレスと一致するユーザーがログインできます。</small>
            </div>

            <div class="col-12">
              <label class="form-label small">
                初期パスワード{{ isNew ? "" : "（未入力可）" }}
              </label>
              <input
                type="text"
                class="form-control"
                v-model="form.InitialPassword"
                placeholder="6文字以上"
              />
              <div class="form-text">
                UserID・メール1〜3のうち、Firebase Authenticationにまだ存在しないメールアドレスがあれば、このパスワードで新規作成します。
                {{ isNew ? "" : "既に存在するアカウントのパスワードは変更されません（変更する場合は下のパスワードリセットを使用してください）。" }}
              </div>
            </div>

            <!-- パスワードリセット（Firebase Authentication） -->
            <template v-if="!isNew">
              <div class="col-12"><hr /></div>
              <div class="col-12">
                <label class="form-label small">パスワードリセット／初期パスワード設定（Firebase Authentication）</label>
                <div class="row g-2">
                  <div class="col-12 col-sm-5">
                    <select class="form-select form-select-sm" v-model="resetTargetEmail">
                      <option value="">対象のメールアドレスを選択</option>
                      <option v-for="opt in resetEmailOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                    </select>
                  </div>
                  <div class="col-8 col-sm-4">
                    <input
                      type="text"
                      class="form-control form-control-sm"
                      v-model="resetNewPassword"
                      placeholder="新しいパスワード（6文字以上）"
                    />
                  </div>
                  <div class="col-4 col-sm-3">
                    <button
                      class="btn btn-sm btn-outline-warning w-100"
                      @click="handleResetPassword"
                      :disabled="resettingPassword"
                    >
                      {{ resettingPassword ? "処理中..." : "リセット" }}
                    </button>
                  </div>
                </div>
                <p v-if="resetMessage" class="small mt-1" :class="resetError ? 'text-danger' : 'text-success'">{{ resetMessage }}</p>
              </div>
            </template>

          </div>

          <p v-if="saveError" class="text-danger mt-2 small">{{ saveError }}</p>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeModal">閉じる</button>
          <button class="btn btn-primary" @click="handleSave" :disabled="saving">
            <span v-if="saving"><i class="fas fa-spinner fa-spin"></i> 保存中...</span>
            <span v-else>{{ isNew ? '登録' : '更新' }}</span>
          </button>
        </div>

      </div>
    </div>
  </div>
  <div v-if="showModal" class="modal-backdrop fade show"></div>

</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/store/authStore.js";
import {
  getUserMasterList, upsertUser, deleteUser, resetFirebaseUserPassword,
  importUserMasterBatch, deleteUserMasterBatch,
} from "@/services/api.js";
import CsvImportExportPanel from "@/components/CsvImportExportPanel.vue";

const router    = useRouter();
const authStore = useAuthStore();

const authorized = computed(() => authStore.userRole >= 9001);

const loading = ref(false);
const users   = ref([]);

const searchName  = ref("");
const searchGroup = ref("");
const searchRole  = ref("");

const groupOptions = computed(() => {
  const set = new Set(users.value.map(u => u.Group).filter(Boolean));
  return [...set].sort();
});

const filteredUsers = computed(() => {
  return users.value.filter(u => {
    if (searchName.value && !`${u.UserName ?? ""}${u.UserKana ?? ""}`.includes(searchName.value)) return false;
    if (searchGroup.value && u.Group !== searchGroup.value) return false;
    if (searchRole.value && !(Number(u.Role ?? 0) >= Number(searchRole.value))) return false;
    return true;
  });
});

function isFlagOn(flg) {
  return flg === 1 || flg === "1" || flg === true;
}

function roleLabel(role) {
  const r = Number(role ?? 0);
  if (r >= 9001) return "管理者";
  if (r >= 1100) return "区域係/Gr監督";
  if (r >= 1010) return "Gr内係";
  if (r >= 1001) return "入力奉仕者";
  if (r >= 1000) return "奉仕者";
  return "権限なし";
}

function roleBadgeClass(role) {
  const r = Number(role ?? 0);
  if (r >= 9001) return "badge bg-danger";
  if (r >= 1100) return "badge bg-primary";
  if (r >= 1010) return "badge bg-warning text-dark";
  if (r >= 1001) return "badge bg-secondary";
  return "badge bg-light text-dark";
}

async function fetchUsers() {
  loading.value = true;
  try {
    const res = await getUserMasterList({});
    if (res.status === "success") {
      users.value = res.users || [];
    }
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

// ---- 編集／新規作成モーダル ----
const showModal = ref(false);
const isNew     = ref(false);
const saving    = ref(false);
const saveError = ref("");

function blankForm() {
  return {
    ID:       null,
    UserID:   "",
    UserKana: "",
    UserName: "",
    BS:       "兄弟",
    Authority: 0,
    Mail1FLG: 0, Mail1: "",
    Mail2FLG: 0, Mail2: "",
    Mail3FLG: 0, Mail3: "",
    Group:    "",
    Role:     1000,
    Site:     "",
    StopFLG:  0,
    InitialPassword: "",
  };
}

const form = ref(blankForm());

function openCreateModal() {
  isNew.value     = true;
  form.value      = blankForm();
  saveError.value = "";
  resetPasswordFormState();
  showModal.value = true;
}

// ---- パスワードリセット（Firebase Authentication） ----
const resetTargetEmail  = ref("");
const resetNewPassword  = ref("");
const resettingPassword = ref(false);
const resetMessage      = ref("");
const resetError        = ref(false);

const resetEmailOptions = computed(() => {
  const opts = [];
  if (form.value.UserID) opts.push({ value: form.value.UserID, label: `UserID: ${form.value.UserID}` });
  if (form.value.Mail1)  opts.push({ value: form.value.Mail1,  label: `メール1: ${form.value.Mail1}` });
  if (form.value.Mail2)  opts.push({ value: form.value.Mail2,  label: `メール2: ${form.value.Mail2}` });
  if (form.value.Mail3)  opts.push({ value: form.value.Mail3,  label: `メール3: ${form.value.Mail3}` });
  return opts;
});

function resetPasswordFormState() {
  resetTargetEmail.value  = "";
  resetNewPassword.value  = "";
  resetMessage.value      = "";
  resetError.value        = false;
}

async function handleResetPassword() {
  resetMessage.value = "";
  resetError.value   = false;

  if (!resetTargetEmail.value) {
    resetMessage.value = "対象のメールアドレスを選択してください";
    resetError.value   = true;
    return;
  }
  if (!resetNewPassword.value || resetNewPassword.value.length < 6) {
    resetMessage.value = "パスワードは6文字以上で入力してください";
    resetError.value   = true;
    return;
  }

  resettingPassword.value = true;
  try {
    const res = await resetFirebaseUserPassword(resetTargetEmail.value, resetNewPassword.value);
    if (res.status === "success") {
      resetMessage.value     = "パスワードをリセットしました";
      resetError.value       = false;
      resetNewPassword.value = "";
    } else {
      resetMessage.value = res.message || "リセットに失敗しました";
      resetError.value   = true;
    }
  } catch (e) {
    resetMessage.value = e.message;
    resetError.value   = true;
  } finally {
    resettingPassword.value = false;
  }
}

function openEditModal(user) {
  isNew.value     = false;
  form.value      = { ...blankForm(), ...user };
  saveError.value = "";
  resetPasswordFormState();
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
}

// バックエンドから返るfirebaseSync（作成・削除・スキップ・エラー件数）を、admin向けの要約メッセージにする
function describeFirebaseSync(firebaseSync) {
  if (!firebaseSync) return "";
  const parts = [];
  const synced = firebaseSync.synced;
  if (synced) {
    if (synced.created?.length)         parts.push(`Firebaseアカウントを新規作成：${synced.created.join(", ")}`);
    if (synced.skipped?.length)         parts.push(`初期パスワード未入力のため未作成：${synced.skipped.join(", ")}`);
    if (synced.disabledUpdated?.length) parts.push(`有効/無効状態を更新：${synced.disabledUpdated.join(", ")}`);
    if (synced.errors?.length)          parts.push(`同期エラー：${synced.errors.join(" / ")}`);
  }
  const removed = firebaseSync.removed;
  if (removed) {
    if (removed.deleted?.length) parts.push(`Firebaseアカウントを削除：${removed.deleted.join(", ")}`);
    if (removed.errors?.length)  parts.push(`削除エラー：${removed.errors.join(" / ")}`);
  }
  // deleteUser の場合、firebaseSync自体が削除結果そのもの
  if (firebaseSync.deleted?.length) parts.push(`Firebaseアカウントを削除：${firebaseSync.deleted.join(", ")}`);
  if (firebaseSync.errors?.length)  parts.push(`削除エラー：${firebaseSync.errors.join(" / ")}`);
  return parts.join("\n");
}

async function handleSave() {
  if (!form.value.UserName) {
    saveError.value = "氏名は必須です";
    return;
  }
  if (isNew.value && (!form.value.InitialPassword || form.value.InitialPassword.length < 6)) {
    saveError.value = "新規作成時は初期パスワード（6文字以上）を入力してください";
    return;
  }
  saving.value    = true;
  saveError.value = "";
  try {
    const res = await upsertUser({ ...form.value });
    if (res.status === "success") {
      await fetchUsers();
      showModal.value = false;
      const summary = describeFirebaseSync(res.firebaseSync);
      if (summary) alert(summary);
    } else {
      saveError.value = res.message || "保存に失敗しました";
    }
  } catch (e) {
    saveError.value = e.message;
  } finally {
    saving.value = false;
  }
}

async function handleDelete(user) {
  if (!confirm(`「${user.UserName}」を削除してもよろしいですか？（UserID・メール1〜3のFirebaseアカウントも削除されます）`)) return;
  loading.value = true;
  try {
    const res = await deleteUser(user.ID);
    if (res.status === "success") {
      users.value = users.value.filter(u => u.ID !== user.ID);
      const summary = describeFirebaseSync(res.firebaseSync);
      if (summary) alert(summary);
    } else {
      alert(res.message || "削除に失敗しました");
    }
  } catch (e) {
    console.error(e);
    alert(e.message);
  } finally {
    loading.value = false;
  }
}

// ---- CSVインポート／エクスポート（ユーザーマスタ, #7） ----
// InitialPassword列はCSV上にのみ存在し、Supabaseには保存しない。
// 指定した行はWorker側のupsertUserと同じロジックでFirebase Authenticationアカウントを
// 新規作成する（既存の「初期パスワード」機能と同じ仕様）。
const CSV_COLUMNS = [
  "ID", "UserID", "UserKana", "UserName", "BS", "Authority",
  "Mail1FLG", "Mail1", "Mail2FLG", "Mail2", "Mail3FLG", "Mail3",
  "Group", "Role", "Site", "StopFLG", "InitialPassword",
];

function exportCsvRows() {
  return users.value.map(u => ({
    ID: u.ID, UserID: u.UserID, UserKana: u.UserKana, UserName: u.UserName,
    BS: u.BS, Authority: u.Authority,
    Mail1FLG: u.Mail1FLG, Mail1: u.Mail1, Mail2FLG: u.Mail2FLG, Mail2: u.Mail2,
    Mail3FLG: u.Mail3FLG, Mail3: u.Mail3,
    Group: u.Group, Role: u.Role, Site: u.Site, StopFLG: u.StopFLG,
    InitialPassword: "", // パスワードはSupabaseに保持しないため常に空欄
  }));
}

async function importCsvBatch(rows) {
  return importUserMasterBatch(rows);
}

async function deleteMissingCsvRows(missingIds) {
  const res = await deleteUserMasterBatch(missingIds);
  return res.deleted?.length ?? 0;
}

onMounted(() => {
  if (authorized.value) fetchUsers();
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
