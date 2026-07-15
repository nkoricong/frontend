// src/store/authStore.js
// ログインユーザー状態をアプリ全体で共有する（Pinia ストア）

import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { watchAuthState, logout as firebaseLogout } from "@/services/auth.js";
import { getLoginUserInformation } from "@/services/api.js";

const USER_INFO_CACHE_KEY = "ekuiki_last_user_info";

function readCachedUserInfo() {
  try {
    return JSON.parse(localStorage.getItem(USER_INFO_CACHE_KEY));
  } catch {
    return null;
  }
}

function writeCachedUserInfo(info) {
  try {
    localStorage.setItem(USER_INFO_CACHE_KEY, JSON.stringify(info));
  } catch {
    // ストレージ不可でも致命的ではないため無視
  }
}

export const useAuthStore = defineStore("auth", () => {
  // ---- State ----
  const firebaseUser = ref(null);   // Firebase User オブジェクト
  const userInfo     = ref(null);   // Worker から取得した user_master 情報
  const loading      = ref(true);

  // ---- Getters ----
  const isLoggedIn  = computed(() => !!firebaseUser.value);
  const userName    = computed(() => userInfo.value?.userName   ?? "");
  const userEmail   = computed(() => firebaseUser.value?.email  ?? "");
  const userGroup   = computed(() => userInfo.value?.group      ?? "");
  const userRole    = computed(() => userInfo.value?.role       ?? 0);
  const userId      = computed(() => userInfo.value?.uid        ?? null);

  // ---- Actions ----

  /** Firebase 認証状態を監視して初期化する（main.js で1回呼ぶ） */
  function init() {
    return new Promise(resolve => {
      watchAuthState(async fbUser => {
        firebaseUser.value = fbUser;

        if (fbUser) {
          try {
            const info = await getLoginUserInformation();
            if (info.status === "success") {
              userInfo.value = info;
              writeCachedUserInfo(info);
            } else {
              userInfo.value = null;
            }
          } catch {
            // ネットワーク不可等で取得できない場合は、同一ユーザーの前回取得分があれば流用する
            const cached = readCachedUserInfo();
            userInfo.value = cached?.email?.toLowerCase() === fbUser.email?.toLowerCase() ? cached : null;
          }
        } else {
          userInfo.value = null;
        }

        loading.value = false;
        resolve();
      });
    });
  }

  /** ログアウト */
  async function logout() {
    await firebaseLogout();
    firebaseUser.value = null;
    userInfo.value     = null;
    try {
      localStorage.removeItem(USER_INFO_CACHE_KEY);
    } catch {
      // ストレージ不可でも致命的ではないため無視
    }
  }

  /** ログイン後に userInfo を手動でセットする（LoginView から利用） */
  function setUserInfo(info) {
    userInfo.value = info;
    writeCachedUserInfo(info);
  }

  return {
    firebaseUser, userInfo, loading,
    isLoggedIn, userName, userEmail, userGroup, userRole, userId,
    init, logout, setUserInfo,
  };
});
