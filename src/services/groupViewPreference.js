// src/services/groupViewPreference.js
// グループページの3画面（一覧／奉仕者／地図）のうち、最後に使った画面をユーザーのブラウザに
// 記憶しておく（#110）。メインメニューの［グループページ］ボタンはこれを見て遷移先を決める。

const LAST_GROUP_VIEW_KEY = "ekuiki_last_group_view";

export const GROUP_VIEWS = {
  CHILD_LIST:      "childList",
  MINISTER_ASSIGN: "ministerAssign",
  GROUP_MAP:       "groupMap",
};

/** 最後に使ったグループページ画面のルート名を返す（未保存なら一覧画面） */
export function getLastGroupView() {
  const saved = localStorage.getItem(LAST_GROUP_VIEW_KEY);
  return Object.values(GROUP_VIEWS).includes(saved) ? saved : GROUP_VIEWS.CHILD_LIST;
}

/** 現在表示中のグループページ画面を記憶する */
export function setLastGroupView(routeName) {
  localStorage.setItem(LAST_GROUP_VIEW_KEY, routeName);
}
