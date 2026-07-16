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
      <h2><i class="far fa-newspaper"></i> お知らせの投稿</h2>
    </div>

    <!-- 権限なし -->
    <div v-if="!authorized" class="alert alert-danger text-center">
      このページを表示する権限がありません。（入力奉仕者権限が必要です）
    </div>

    <template v-else>
      <div class="d-flex justify-content-end mb-3">
        <button class="btn btn-primary" @click="openCreateModal">
          <i class="fas fa-plus-circle"></i> 新規作成
        </button>
      </div>

      <div class="table-responsive">
        <table class="table table-sm table-striped align-middle">
          <thead class="table-secondary">
            <tr>
              <th>掲載日</th>
              <th>掲載終了日</th>
              <th>タイトル</th>
              <th>ステータス</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in announcements" :key="a.ID">
              <td>{{ a.PublishDate }}</td>
              <td>{{ a.PublishEndDate ?? "-" }}</td>
              <td>
                {{ a.Title }}
                <div v-if="a.RevisionRequest" class="small text-danger mt-1">
                  <i class="fas fa-exclamation-circle"></i> 修正依頼：{{ a.RevisionRequest }}
                </div>
              </td>
              <td><span :class="statusBadgeClass(a.Status)">{{ a.Status }}</span></td>
              <td class="text-nowrap">
                <button
                  class="btn btn-sm alert-primary"
                  :disabled="!isEditable(a)"
                  :title="isEditable(a) ? '' : '掲載中／掲載終了の記事は編集できません'"
                  @click="openEditModal(a)"
                >
                  編集
                </button>
              </td>
            </tr>
            <tr v-if="announcements.length === 0">
              <td colspan="5" class="text-center text-muted py-4">投稿したお知らせがありません</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </main>

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
          <h5 class="modal-title">{{ isNew ? "お知らせの新規作成" : "お知らせの編集" }}</h5>
          <button type="button" class="btn-close" @click="closeModal"></button>
        </div>

        <div class="modal-body">
          <div class="row g-2">
            <div class="col-6">
              <label class="form-label small">掲載日</label>
              <input type="date" class="form-control" v-model="form.PublishDate" />
            </div>
            <div class="col-6">
              <label class="form-label small">掲載終了日（任意）</label>
              <input type="date" class="form-control" v-model="form.PublishEndDate" />
            </div>

            <div class="col-12">
              <label class="form-label small">記事タイトル</label>
              <input type="text" class="form-control" v-model="form.Title" placeholder="例）マイページの表示を変更しました" />
            </div>

            <div class="col-12">
              <label class="form-label small">記事本文</label>
              <RichTextEditor v-model="form.Body" />
            </div>

            <div class="col-6">
              <label class="form-label small">掲載ステータス</label>
              <select class="form-select" v-model="form.Status">
                <option value="掲載待ち">掲載待ち（管理者の承認を待つ）</option>
                <option value="掲載中止">掲載中止（取り下げる）</option>
              </select>
              <div class="form-text">「掲載中」への変更は管理者の承認によってのみ行われます。</div>
            </div>
          </div>

          <p v-if="saveError" class="text-danger mt-2 small">{{ saveError }}</p>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeModal">閉じる</button>
          <button class="btn btn-primary" @click="handleSave" :disabled="saving">
            <span v-if="saving"><i class="fas fa-spinner fa-spin"></i> 保存中...</span>
            <span v-else>{{ isNew ? "登録" : "更新" }}</span>
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
import { getMyAnnouncements, upsertMyAnnouncement } from "@/services/api.js";
import RichTextEditor from "@/components/RichTextEditor.vue";

const router    = useRouter();
const authStore = useAuthStore();

const authorized = computed(() => authStore.userRole >= 1001);

const loading       = ref(false);
const announcements = ref([]);

async function fetchAnnouncements() {
  loading.value = true;
  try {
    const res = await getMyAnnouncements();
    if (res.status === "success") announcements.value = res.announcements || [];
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

function isEditable(a) {
  return a.Status !== "掲載中" && a.Status !== "掲載終了";
}

const STATUS_BADGES = {
  "掲載待ち": "badge bg-secondary",
  "掲載中":   "badge bg-success",
  "掲載中止": "badge bg-warning text-dark",
  "掲載終了": "badge bg-light text-dark border",
};
function statusBadgeClass(status) {
  return STATUS_BADGES[status] || "badge bg-light text-dark";
}

// ---- 編集／新規作成モーダル ----
const showModal = ref(false);
const isNew     = ref(false);
const saving    = ref(false);
const saveError = ref("");

function blankForm() {
  return {
    ID:             null,
    PublishDate:    new Date().toISOString().slice(0, 10),
    PublishEndDate: "",
    Title:          "",
    Body:           "",
    Status:         "掲載待ち",
  };
}

const form = ref(blankForm());

function openCreateModal() {
  isNew.value     = true;
  form.value      = blankForm();
  saveError.value = "";
  showModal.value = true;
}

function openEditModal(a) {
  isNew.value = false;
  form.value  = {
    ID:             a.ID,
    PublishDate:    a.PublishDate,
    PublishEndDate: a.PublishEndDate ?? "",
    Title:          a.Title,
    Body:           a.Body,
    Status:         a.Status === "掲載待ち" || a.Status === "掲載中止" ? a.Status : "掲載待ち",
  };
  saveError.value = "";
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
}

async function handleSave() {
  if (!form.value.Title.trim()) {
    saveError.value = "記事タイトルを入力してください";
    return;
  }
  if (!form.value.PublishDate) {
    saveError.value = "掲載日を入力してください";
    return;
  }
  saving.value    = true;
  saveError.value = "";
  try {
    const res = await upsertMyAnnouncement({
      ...form.value,
      PublishEndDate: form.value.PublishEndDate || null,
    });
    if (res.status === "success") {
      await fetchAnnouncements();
      showModal.value = false;
    } else {
      saveError.value = res.message || "保存に失敗しました";
    }
  } catch (e) {
    saveError.value = e.message;
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  if (authorized.value) fetchAnnouncements();
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
