// src/router/index.js
// Vue Router 設定

import { createRouter, createWebHashHistory } from "vue-router";
import { useAuthStore } from "@/store/authStore.js";
import { isOnline, hasOfflineData, findOfflineEntryByCard } from "@/services/offline.js";

// ログイン画面／オフライン専用ページ／子カード画面は、ネット未接続時にも遷移できる
// 必要があるため、他画面のような遅延読込（動的import）にはしない。遅延読込だと、
// 該当チャンクを一度も取得したことがない端末で本当にオフラインの場合、ボタンを押しても
// チャンクのフェッチに失敗して画面遷移が反応しなくなる（#47関連の追加修正）。
import LoginView       from "@/views/LoginView.vue";
import OfflineHomeView from "@/views/OfflineHomeView.vue";
import ChildMapView    from "@/views/ChildMapView.vue";

const routes = [
  {
    path:      "/",
    name:      "login",
    component: LoginView,
    meta:      { public: true },
  },
  {
    path:      "/offline",
    name:      "offlineHome",
    component: OfflineHomeView,
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
    component: ChildMapView,
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
    path:      "/childlist/minister",
    name:      "ministerAssign",
    component: () => import("@/views/MinisterAssignView.vue"),
  },
  {
    path:      "/childlist/map",
    name:      "groupMap",
    component: () => import("@/views/GroupMapView.vue"),
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
    path:      "/settings/building-master",
    name:      "buildingMasterList",
    component: () => import("@/views/BuildingMasterListView.vue"),
  },
  {
    path:      "/settings/announcements",
    name:      "editAnnouncementList",
    component: () => import("@/views/AnnouncementEditListView.vue"),
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
  {
    path:      "/admin/announcements",
    name:      "announcementApproval",
    component: () => import("@/views/AnnouncementApprovalView.vue"),
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

// ナビゲーションガード: 未認証なら / へリダイレクト
// ただし、オフライン保存済みの子カードがある場合は、ログインをスキップして
// オフライン専用ページ（または保存済みの子カード画面）へ誘導する。
router.beforeEach((to) => {
  if (to.meta.public) return true;

  const auth = useAuthStore();
  if (auth.isLoggedIn) return true;

  // オフライン専用ページ等からの遷移で、ローカルに保存済みの子カードを開く場合は、
  // 現在の接続状態に関わらず（navigator.onLineが不正確な場合もあるため）常に許可する。
  if (to.name === "childMap") {
    const entry = findOfflineEntryByCard(to.params.cardNo, to.params.childNo);
    if (entry) return true;
  }

  if (!isOnline() && hasOfflineData()) {
    return { name: "offlineHome" };
  }

  return { name: "login" };
});

export default router;
