<template>
  <div id="app" class="container">

    <!-- ローディング -->
    <div v-if="loading" class="text-center mt-5">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="mt-3">ユーザー情報を取得しています...</p>
    </div>

    <!-- メイン -->
    <div v-else>

      <!-- 上部ユーザー情報バー -->
      <div class="row bg-light mt-3 p-3 align-items-center rounded shadow-sm top-user-bar">
        <div class="col-8">
          <p class="mb-0">
            <strong>{{ authStore.userName }}</strong><br />
            {{ authStore.userEmail }}（{{ authStore.userGroup }}）
          </p>
        </div>
        <div class="col-4 d-flex justify-content-end">
          <button class="btn btn-link text-danger" @click="logout">
            <i class="fas fa-2x fa-door-open"></i><br />終了
          </button>
        </div>
      </div>

      <!-- タイトル -->
      <div class="text-center mb-4">
        <h2><i class="fas fa-home"></i> ホーム</h2>
      </div>

      <!-- メニュー -->
      <div class="row">
        <div class="col-12 col-md-10 col-lg-8 mx-auto">

          <button
            v-if="authStore.userRole >= 1100"
            class="btn btn-info col-12 mb-3 menu-button"
            @click="go('cardlist')"
          >
            <i class="fas fa-2x fa-tasks"></i>
            <h6>区域リスト</h6>
          </button>

          <button
            v-if="authStore.userRole >= 1010"
            class="btn btn-info col-12 mb-3 menu-button"
            @click="go('childlist')"
          >
            <i class="fas fa-2x fa-users"></i>
            <h6>グループページ</h6>
          </button>

          <button
            class="btn btn-primary col-12 mb-3 menu-button"
            @click="router.push({ name: 'assignmentList' })"
          >
            <i class="fas fa-2x fa-street-view"></i>
            <h6>マイページ</h6>
          </button>

          <button
            v-if="authStore.userRole >= 1001"
            class="btn btn-light col-12 mb-3 menu-button"
            @click="go('settings')"
          >
            <i class="fas fa-2x fa-tools"></i>
            <h6>設定</h6>
          </button>

          <button
            v-if="authStore.userRole >= 9001"
            class="btn btn-light col-12 mb-3 menu-button"
            @click="go('admin')"
          >
            <i class="fas fa-2x fa-user-cog"></i>
            <h6>管理者設定</h6>
          </button>

        </div>
      </div>

      <br />

      <!-- お知らせ -->
      <div class="row">
        <div class="col-12 col-md-10 col-lg-8 mx-auto">
          <h5><b>お知らせ</b></h5>
          <div v-if="announcementsLoading" class="text-muted small">読み込み中...</div>
          <template v-else-if="announcements.length > 0">
            <div v-for="a in announcements" :key="a.ID" class="mb-3">
              <h6><b>{{ a.PublishDate }}</b></h6>
              <p class="fw-bold mb-1">{{ a.Title }}</p>
              <div class="announcement-body" v-html="sanitize(a.Body)"></div>
            </div>
          </template>
          <p v-else class="text-muted small">現在、お知らせはありません</p>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import DOMPurify from "dompurify";
import { useAuthStore } from "@/store/authStore.js";
import { getActiveAnnouncements } from "@/services/api.js";
import { getLastGroupView } from "@/services/groupViewPreference.js";

const router    = useRouter();
const authStore = useAuthStore();
const loading   = ref(false);

const announcements        = ref([]);
const announcementsLoading = ref(false);

function sanitize(html) {
  return DOMPurify.sanitize(html || "", {
    ALLOWED_TAGS: ["b", "strong", "i", "em", "u", "a", "span", "br", "p", "div"],
    ALLOWED_ATTR: ["href", "style", "target", "rel"],
  });
}

async function fetchAnnouncements() {
  announcementsLoading.value = true;
  try {
    const res = await getActiveAnnouncements();
    if (res.status === "success") announcements.value = res.announcements || [];
  } catch (e) {
    console.error(e);
  } finally {
    announcementsLoading.value = false;
  }
}

async function logout() {
  await authStore.logout();
  router.push({ name: "login" });
}

onMounted(fetchAnnouncements);

const PAGE_ROUTES = {
  cardlist:  "cardList",
  settings:  "settings",
  admin:     "admins",
};

function go(page) {
  // グループページは3画面あるため、最後に使った画面へ遷移する（#110）
  if (page === "childlist") {
    router.push({ name: getLastGroupView() });
    return;
  }
  const name = PAGE_ROUTES[page];
  if (name) router.push({ name });
}
</script>

<style scoped>
#app {
  max-width: 900px;
  margin: auto;
  padding: 1rem;
}

.menu-button {
  padding-top: 0.6rem !important;
  padding-bottom: 0.6rem !important;
  font-size: 1.1rem;
}

.top-user-bar {
  padding-top: 0.6rem !important;
  padding-bottom: 0.6rem !important;
}

@media (max-width: 512px) {
  body { font-size: 21px; }

  .menu-button {
    padding-top: 1.0rem !important;
    padding-bottom: 1.0rem !important;
    font-size: 1.0rem;
  }

  .top-user-bar {
    padding-top: 1.0rem !important;
    padding-bottom: 1.0rem !important;
  }
}
</style>
