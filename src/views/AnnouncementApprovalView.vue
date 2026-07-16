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
      <h2><i class="far fa-newspaper"></i> お知らせの掲載承認</h2>
    </div>

    <!-- 権限なし -->
    <div v-if="!authorized" class="alert alert-danger text-center">
      このページを表示する権限がありません。（管理者権限が必要です）
    </div>

    <template v-else>
      <div class="row g-2 align-items-end mb-3">
        <div class="col-6 col-md-3">
          <label class="form-label small mb-0">ステータス</label>
          <select class="form-select" v-model="filterStatus">
            <option value="">全て</option>
            <option value="掲載待ち">掲載待ち</option>
            <option value="掲載中">掲載中</option>
            <option value="掲載中止">掲載中止</option>
            <option value="掲載終了">掲載終了</option>
          </select>
        </div>
      </div>

      <div class="mb-2"><strong>件数：{{ filteredAnnouncements.length }}件</strong></div>

      <div v-for="a in filteredAnnouncements" :key="a.ID" class="card shadow-sm mb-3">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start mb-1">
            <h5 class="mb-0">{{ a.Title }}</h5>
            <span :class="statusBadgeClass(a.Status)">{{ a.Status }}</span>
          </div>
          <p class="small text-muted mb-2">
            掲載日: {{ a.PublishDate }} ／ 終了日: {{ a.PublishEndDate ?? "-" }}
            ／ 投稿者: {{ a.PostedByName }}
          </p>

          <button class="btn btn-sm btn-outline-secondary mb-2" @click="toggleExpand(a.ID)">
            {{ expanded[a.ID] ? "本文を閉じる" : "本文を表示" }}
          </button>
          <div v-if="expanded[a.ID]" class="announcement-body border rounded p-2 mb-2" v-html="sanitize(a.Body)"></div>

          <p v-if="a.RevisionRequest" class="small text-danger mb-2">
            <i class="fas fa-exclamation-circle"></i> 修正依頼済み：{{ a.RevisionRequest }}
          </p>

          <div class="d-flex flex-wrap gap-2">
            <button
              class="btn btn-sm btn-success"
              :disabled="a.RawStatus === '掲載中' || busyId === a.ID"
              @click="handleApprove(a)"
            >
              <i class="fas fa-check"></i> 承認
            </button>
            <button
              class="btn btn-sm btn-outline-warning"
              :disabled="busyId === a.ID"
              @click="handleRequestRevision(a)"
            >
              <i class="fas fa-edit"></i> 修正依頼
            </button>
            <button
              class="btn btn-sm btn-outline-secondary"
              :disabled="a.RawStatus === '掲載中止' || busyId === a.ID"
              @click="handleDiscontinue(a)"
            >
              <i class="fas fa-ban"></i> 掲載中止
            </button>
            <button
              class="btn btn-sm btn-outline-danger"
              :disabled="busyId === a.ID"
              @click="handleDelete(a)"
            >
              <i class="fas fa-trash-alt"></i> 削除
            </button>
          </div>
        </div>
      </div>

      <div v-if="filteredAnnouncements.length === 0" class="text-center text-muted py-5">
        該当するお知らせがありません
      </div>
    </template>
  </main>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import DOMPurify from "dompurify";
import { useAuthStore } from "@/store/authStore.js";
import {
  getAllAnnouncements, approveAnnouncement, requestAnnouncementRevision,
  discontinueAnnouncement, deleteAnnouncement,
} from "@/services/api.js";

const router    = useRouter();
const authStore = useAuthStore();

const authorized = computed(() => authStore.userRole >= 9001);

const loading       = ref(false);
const announcements = ref([]);
const filterStatus  = ref("");
const expanded      = ref({});
const busyId        = ref(null);

const filteredAnnouncements = computed(() => {
  if (!filterStatus.value) return announcements.value;
  return announcements.value.filter(a => a.Status === filterStatus.value);
});

function toggleExpand(id) {
  expanded.value[id] = !expanded.value[id];
}

function sanitize(html) {
  return DOMPurify.sanitize(html || "", {
    ALLOWED_TAGS: ["b", "strong", "i", "em", "u", "a", "span", "br", "p", "div"],
    ALLOWED_ATTR: ["href", "style", "target", "rel"],
  });
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

async function fetchAnnouncements() {
  loading.value = true;
  try {
    const res = await getAllAnnouncements();
    if (res.status === "success") announcements.value = res.announcements || [];
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

async function handleApprove(a) {
  if (!confirm(`「${a.Title}」を承認し、掲載中にしますか？`)) return;
  busyId.value = a.ID;
  try {
    const res = await approveAnnouncement(a.ID);
    if (res.status === "success") await fetchAnnouncements();
    else alert(res.message || "承認に失敗しました");
  } catch (e) {
    alert(e.message);
  } finally {
    busyId.value = null;
  }
}

async function handleRequestRevision(a) {
  const comment = prompt(`「${a.Title}」への修正依頼内容を入力してください`, a.RevisionRequest || "");
  if (comment === null) return;
  if (!comment.trim()) {
    alert("修正依頼の内容を入力してください");
    return;
  }
  busyId.value = a.ID;
  try {
    const res = await requestAnnouncementRevision(a.ID, comment);
    if (res.status === "success") await fetchAnnouncements();
    else alert(res.message || "修正依頼の送信に失敗しました");
  } catch (e) {
    alert(e.message);
  } finally {
    busyId.value = null;
  }
}

async function handleDiscontinue(a) {
  if (!confirm(`「${a.Title}」の掲載を中止しますか？`)) return;
  busyId.value = a.ID;
  try {
    const res = await discontinueAnnouncement(a.ID);
    if (res.status === "success") await fetchAnnouncements();
    else alert(res.message || "掲載中止に失敗しました");
  } catch (e) {
    alert(e.message);
  } finally {
    busyId.value = null;
  }
}

async function handleDelete(a) {
  if (!confirm(`「${a.Title}」を削除します。よろしいですか？（元に戻せません）`)) return;
  busyId.value = a.ID;
  try {
    const res = await deleteAnnouncement(a.ID);
    if (res.status === "success") {
      announcements.value = announcements.value.filter(x => x.ID !== a.ID);
    } else {
      alert(res.message || "削除に失敗しました");
    }
  } catch (e) {
    alert(e.message);
  } finally {
    busyId.value = null;
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

.announcement-body {
  background: #f9fafb;
}
</style>
