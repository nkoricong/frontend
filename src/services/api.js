// src/services/api.js
// Cloudflare Worker への API 呼び出しを集約するサービスモジュール
//
// すべての認証付きリクエストは callWorker() を経由する。
// Firebase ID Token の取得・付与を自動で行う。

import { getIdToken } from "./auth.js";

const WORKER_URL = import.meta.env.VITE_WORKER_URL || "https://ekuikidev.dhidaka2000.workers.dev";

// ----------------------------------------------------------------
// 共通ヘルパー
// ----------------------------------------------------------------

/**
 * Worker に POST リクエストを送る（認証あり）
 * @param {object} body  - funcName を含むリクエストボディ
 * @returns {Promise<object>}
 */
async function callWorker(body) {
  const token = await getIdToken();
  const res   = await fetch(WORKER_URL, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Worker error ${res.status}: ${text}`);
  }
  return res.json();
}

/**
 * Worker に POST リクエストを送る（認証なし）
 * @param {object} body
 */
async function callWorkerPublic(body) {
  const res = await fetch(WORKER_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Worker error ${res.status}`);
  return res.json();
}

// ----------------------------------------------------------------
// 公開 API（認証不要）
// ----------------------------------------------------------------

/** Firebase API Key を取得する */
export async function getFirebaseConfig() {
  return callWorkerPublic({ funcName: "getFirebaseConfig" });
}

/** ログイン画面のアクセスコードを照合する */
export async function verifySiteAccessCode(code) {
  return callWorkerPublic({ funcName: "verifySiteAccessCode", code });
}

/** ログイン画面のユーザー選択ドロップダウン用一覧を取得する（実メールは含まない） */
export async function getLoginUserOptions(accessCode) {
  return callWorkerPublic({ funcName: "getLoginUserOptions", accessCode });
}

/** 選択されたユーザーIDから実際のメールアドレスを1件だけ解決する */
export async function resolveLoginEmail(userId, accessCode) {
  return callWorkerPublic({ funcName: "resolveLoginEmail", userId, accessCode });
}

/** パスキーログイン用の認証オプションを取得する（未ログイン状態で呼ぶため認証不要） */
export async function getWebauthnAuthenticationOptions(email) {
  return callWorkerPublic({ funcName: "getWebauthnAuthenticationOptions", email });
}

/** パスキー認証レスポンスを検証する（成功時にFirebaseカスタムトークンを受け取る） */
export async function verifyWebauthnAuthentication(email, credential) {
  return callWorkerPublic({ funcName: "verifyWebauthnAuthentication", email, credential });
}

// ----------------------------------------------------------------
// 認証付き API
// ----------------------------------------------------------------

/** ログインユーザー情報を取得する */
export async function getLoginUserInformation() {
  return callWorker({ funcName: "getLoginUserInformation" });
}

/** Google Maps URL を取得する */
export async function getGoogleMapsUrl() {
  return callWorker({ funcName: "getGoogleMapsUrl" });
}

/** ログイン中のユーザーが新しいパスキーを登録するためのオプションを取得する */
export async function getWebauthnRegistrationOptions() {
  return callWorker({ funcName: "getWebauthnRegistrationOptions" });
}

/** パスキー登録レスポンスを検証し、アカウントに紐づけて保存する */
export async function verifyWebauthnRegistration(credential) {
  return callWorker({ funcName: "verifyWebauthnRegistration", credential });
}

/**
 * ログインユーザーに紐づく子カード一覧を取得する（マイページ用）
 */
export async function getFilteredChildCardbyUser() {
  return callWorker({ funcName: "getFilteredChildCardbyUser" });
}

/**
 * 子カード詳細（cardInfo / childInfo / houses）を取得する
 * @param {number} CardNo
 * @param {number} ChildNo
 */
export async function getChildDetail(CardNo, ChildNo) {
  return callWorker({ funcName: "getChildDetail", CardNo, ChildNo });
}

/**
 * 訪問履歴を取得する
 * @param {number} CardNo
 * @param {number} ChildNo
 */
export async function getVisitRecord(CardNo, ChildNo) {
  return callWorker({ funcName: "getVisitRecord", CardNo, ChildNo });
}

/**
 * 訪問記録を登録 / 更新する
 * @param {object} record
 */
export async function upsertVisitRecord(record) {
  return callWorker({ funcName: "upsertVisitRecord", ...record });
}

/**
 * 訪問記録を削除する
 * @param {number} VisitID
 */
export async function deleteVisitRecord(VisitID) {
  return callWorker({ funcName: "deleteVisitRecord", VisitID });
}

// ----------------------------------------------------------------
// 区域リスト（CardList / EditCardList / Settings_EditDetail / ImportKibanCSV）
// ----------------------------------------------------------------

/** 区域カード一覧を取得する */
export async function getCardList(filters = {}) {
  return callWorker({ funcName: "getCardList", ...filters });
}

/** 区域カードを作成/更新する */
export async function upsertCardList(record) {
  return callWorker({ funcName: "upsertCardList", ...record });
}

/** 区域カードを削除する */
export async function deleteCardList(cardNo) {
  return callWorker({ funcName: "deleteCardList", cardNo });
}

/** グループ名一覧を取得する */
export async function getGroupMaster() {
  return callWorker({ funcName: "getGroupMaster" });
}

/** ユーザーマスタ全件を取得する（担当者選択肢・ユーザー管理画面の両方で使用） */
export async function getUserMaster() {
  return callWorker({ funcName: "getUserMaster" });
}

/** ユーザーマスタ全件を取得する（getUserMaster のエイリアス） */
export async function getUserMasterList(filters = {}) {
  return callWorker({ funcName: "getUserMasterList", ...filters });
}

/** 既存の区域No一覧を取得する */
export async function getCardNoOptions() {
  return callWorker({ funcName: "getCardNoOptions" });
}

/** 区域カードの貸出履歴一覧を取得する */
export async function getCardUsageHistory(cardNo) {
  return callWorker({ funcName: "getCardUsageHistory", CardNo: cardNo });
}

/** 貸出を取り消す（直近の貸出履歴を削除し、前回の状態に復元する） */
export async function cancelCardCheckout(cardNo) {
  return callWorker({ funcName: "cancelCardCheckout", CardNo: cardNo });
}

// ----------------------------------------------------------------
// 子カード一覧（CardMap / ChildList / EditChildList）
// ----------------------------------------------------------------

/** 指定した区域Noの親カード情報＋子カード一覧を取得する */
export async function getChildListByCard(CardNo) {
  return callWorker({ funcName: "getChildListByCard", CardNo });
}

/** グループに紐づく子カード一覧を取得する（グループページ用） */
export async function getGroupChildList(group) {
  return callWorker({ funcName: "getGroupChildList", Group: group });
}

/** グループに属する奉仕者（割当候補）一覧を取得する */
export async function getMinisterOptions(group) {
  return callWorker({ funcName: "getMinisterOptions", Group: group });
}

/** 子カードの担当奉仕者を変更する */
export async function assignChildMinister(childId, ministerId, startDate = null, limitDate = null) {
  return callWorker({
    funcName:  "assignChildMinister",
    ChildID:   childId,
    MinisterID: ministerId,
    StartDate: startDate,
    LimitDate: limitDate,
  });
}

/** 子カードを返却する（ステータスを返却済にし、checkout_dateを本日付けにする） */
export async function returnChildCard(childId) {
  return callWorker({ funcName: "returnChildCard", ChildID: childId });
}

/** 返却済の子カードの返却を取り消し、貸出中に戻す（使用期限内の場合のみ） */
export async function cancelChildReturn(childId) {
  return callWorker({ funcName: "cancelChildReturn", ChildID: childId });
}

/** 子カードの共有用ワンタイムトークンを発行する */
export async function createChildShare(childId) {
  return callWorker({ funcName: "createChildShare", ChildID: childId });
}

/** QRコード読取で得たトークンを検証し、共有を確定する（3時間有効） */
export async function claimChildShare(token) {
  return callWorker({ funcName: "claimChildShare", token });
}

/** 受け取った共有を終了する */
export async function endChildShare(shareId) {
  return callWorker({ funcName: "endChildShare", ShareID: shareId });
}

/** 子カード全件を取得する（管理画面用） */
export async function getChildListAll(filters = {}) {
  return callWorker({ funcName: "getChildListAll", ...filters });
}

/** 子カードを作成/更新する */
export async function upsertChildList(record) {
  return callWorker({ funcName: "upsertChildList", ...record });
}

/** 子カードを削除する */
export async function deleteChildList(id) {
  return callWorker({ funcName: "deleteChildList", id });
}

// ----------------------------------------------------------------
// ユーザーリストの編集（管理者設定）
// ----------------------------------------------------------------

/** ユーザーを作成/更新する */
export async function upsertUser(record) {
  return callWorker({ funcName: "upsertUser", ...record });
}

/** ユーザーを削除する */
export async function deleteUser(id) {
  return callWorker({ funcName: "deleteUser", ID: id });
}

/** 指定したメールアドレスのFirebase Authenticationパスワードを管理者権限でリセットする */
export async function resetFirebaseUserPassword(targetEmail, newPassword) {
  return callWorker({ funcName: "resetFirebaseUserPassword", targetEmail, newPassword });
}

/** ログイン画面のアクセスコード現在値を取得する（管理者のみ） */
export async function getSiteAccessCode() {
  return callWorker({ funcName: "getSiteAccessCode" });
}

/** ログイン画面のアクセスコードを変更する（管理者のみ） */
export async function updateSiteAccessCode(code) {
  return callWorker({ funcName: "updateSiteAccessCode", code });
}

// ----------------------------------------------------------------
// 住居リストの編集 / CSVインポート
// ----------------------------------------------------------------

/** 住戸を作成/更新する */
export async function upsertDetail(row) {
  return callWorker({ funcName: "upsertDetail", ...row });
}

/** 住戸を削除する */
export async function deleteDetail(DetailID) {
  return callWorker({ funcName: "deleteDetail", DetailID });
}

/** 住戸の表示順を隣の行と入れ替える */
export async function moveDetailRow(DetailID, direction) {
  return callWorker({ funcName: "moveDetailRow", DetailID, direction });
}

/** 住戸IDを現在の表示順で振り直す */
export async function renumberDetailList(CardNo, ChildNo) {
  return callWorker({ funcName: "renumberDetailList", CardNo, ChildNo });
}

/** 住居表示住所CSVを取り込む */
export async function importKibanCsv({ cardNo, childNo, rows }) {
  return callWorker({ funcName: "importKibanCsv", cardNo, childNo, rows });
}

// ----------------------------------------------------------------
// お知らせ（ホーム画面掲載記事）
// ----------------------------------------------------------------

/** ホーム画面用：現在掲載中のお知らせ一覧を取得する */
export async function getActiveAnnouncements() {
  return callWorker({ funcName: "getActiveAnnouncements" });
}

/** 入力奉仕者向け：自分が投稿したお知らせ一覧を取得する */
export async function getMyAnnouncements() {
  return callWorker({ funcName: "getMyAnnouncements" });
}

/** 入力奉仕者向け：お知らせを新規作成／更新する */
export async function upsertMyAnnouncement(record) {
  return callWorker({ funcName: "upsertMyAnnouncement", ...record });
}

/** 管理者向け：お知らせ全件を取得する */
export async function getAllAnnouncements() {
  return callWorker({ funcName: "getAllAnnouncements" });
}

/** 管理者向け：お知らせを承認して掲載中にする */
export async function approveAnnouncement(id) {
  return callWorker({ funcName: "approveAnnouncement", ID: id });
}

/** 管理者向け：お知らせに修正依頼を送る（掲載待ちへ差し戻す） */
export async function requestAnnouncementRevision(id, comment) {
  return callWorker({ funcName: "requestAnnouncementRevision", ID: id, Comment: comment });
}

/** 管理者向け：お知らせの掲載を中止する */
export async function discontinueAnnouncement(id) {
  return callWorker({ funcName: "discontinueAnnouncement", ID: id });
}

/** 管理者向け：お知らせを削除する */
export async function deleteAnnouncement(id) {
  return callWorker({ funcName: "deleteAnnouncement", ID: id });
}

/**
 * KML ファイルを取得する
 * @param {string}      file
 * @param {string|null} ChildNo
 */
export async function getKml(file, ChildNo = null) {
  const url = new URL(`${WORKER_URL}/getKml`);
  url.searchParams.set("file", file);
  if (ChildNo) url.searchParams.set("ChildNo", ChildNo);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`KML fetch error ${res.status}`);
  return res.text();
}

/**
 * google.maps.KmlLayer に渡す公開URLを組み立てる（Google側が直接fetchするため認証不要のURL文字列を返す）。
 * @param {string}      file
 * @param {number|string|null} childNo  指定時は2桁ゼロ埋めして該当区画のみに絞り込む
 */
export function getKmlUrl(file, childNo = null) {
  const url = new URL(`${WORKER_URL}/getKml`);
  url.searchParams.set("file", file);
  if (childNo != null && childNo !== "") {
    url.searchParams.set("ChildNo", String(childNo).padStart(2, "0"));
  }
  return url.toString();
}
