// src/router/index.js
// Vue Router 設定

import { createRouter, createWebHashHistory } from "vue-router";
import { useAuthStore } from "@/store/authStore.js";
import { isOnline, hasOfflineData, findOfflineEntryByCard } from "@/services/offline.js";

const routes = [
  {
    path:      "/",
    name:      "login",
    component: () => import("@/views/LoginView.vue"),
    meta:      { public: true },
  },
  {
    path:      "/offline",
    name:      "offlineHome",
    component: () => import("@/views/OfflineHomeView.vue"),
    meta:      { public: true },
  },
  {
    path:      "/menu",
    name:      "mainMenu",
    component: () => import("@/views/MainMenuView.vue"),
  },
  {
    path:      "/mypage",
    name:      "assignmentList",
    component: () => import("@/views/AssignmentListView.vue"),
  },
  {
    path:      "/childmap/:cardNo/:childNo",
    name:      "childMap",
    component: () => import("@/views/ChildMapView.vue"),
    props:     route => ({
      cardNo:  Number(route.params.cardNo),
      childNo: Number(route.params.childNo),
    }),
  },
  {
    path:      "/cardlist",
    name:      "cardList",
    component: () => import("@/views/CardListView.vue"),
  },
  {
    path:      "/cardmap/:cardNo",
    name:      "cardMap",
    component: () => import("@/views/CardMapView.vue"),
    props:     route => ({ cardNo: Number(route.params.cardNo) }),
  },
  {
    path:      "/childlist",
    name:      "childList",
    component: () => import("@/views/ChildListView.vue"),
  },
  {
    path:      "/settings",
    name:      "settings",
    component: () => import("@/views/SettingsView.vue"),
  },
  {
    path:      "/settings/edit-card-list",
    name:      "editCardList",
    component: () => import("@/views/EditCardListView.vue"),
  },
  {
    path:      "/settings/edit-child-list",
    name:      "editChildList",
    component: () => import("@/views/EditChildListView.vue"),
  },
  {
    path:      "/settings/edit-detail-select",
    name:      "settingsEditDetail",
    component: () => import("@/views/SettingsEditDetailView.vue"),
  },
  {
    path:      "/settings/edit-detail/:cardNo/:childNo",
    name:      "editDetailList",
    component: () => import("@/views/EditDetailListAsyncView.vue"),
    props:     route => ({
      cardNo:  Number(route.params.cardNo),
      childNo: Number(route.params.childNo),
    }),
  },
  {
    path:      "/settings/import-csv",
    name:      "importKibanCSV",
    component: () => import("@/views/ImportKibanCSVView.vue"),
  },
  {
    path:      "/admin",
    name:      "admins",
    component: () => import("@/views/AdminsView.vue"),
  },
  {
    path:      "/admin/edit-user-list",
    name:      "editUserList",
    component: () => import("@/views/EditUserListView.vue"),
  },
  {
    path:      "/admin/site-settings",
    name:      "siteSettings",
    component: () => import("@/views/SiteSettingsView.vue"),
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

// ナビゲーションガード: 未認証なら / へリダイレクト
// ただし、ネット未接続かつオフライン保存済みの子カードがある場合は、
// ログインをスキップしてオフライン専用ページ（または保存済みの子カード画面）へ誘導する。
router.beforeEach((to) => {
  if (to.meta.public) return true;

  const auth = useAuthStore();
  if (auth.isLoggedIn) return true;

  if (!isOnline() && hasOfflineData()) {
    if (to.name === "childMap") {
      const entry = findOfflineEntryByCard(to.params.cardNo, to.params.childNo);
      if (entry) return true;
    }
    return { name: "offlineHome" };
  }

  return { name: "login" };
});

export default router;
