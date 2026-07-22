// src/services/mapCenter.js
// 「地図で指定」ピッカーの初期表示位置を解決する共通ロジック（#98）

import { getDefaultMapCenter } from "./api.js";

// 管理者設定が未登録・取得失敗時の最終フォールバック（東京都千代田区）
const FALLBACK_MAP_CENTER = { lat: 35.6812, lng: 139.7671 };

let cachedDefaultCenter = null;
let cachedDefaultCenterPromise = null;

/**
 * 管理者設定の初期表示位置を解決する（未登録・取得失敗時はハードコードの
 * 最終フォールバックを返す）。ポリゴンが無い・読み込み中の地図画面の初期
 * 表示位置に使う（#27）。
 * @returns {Promise<{ lat: number, lng: number }>}
 */
export async function fetchDefaultCenter() {
  if (cachedDefaultCenter) return cachedDefaultCenter;
  if (!cachedDefaultCenterPromise) {
    cachedDefaultCenterPromise = getDefaultMapCenter()
      .then((res) => {
        cachedDefaultCenter = (res.status === "success" && res.lat != null && res.lng != null)
          ? { lat: Number(res.lat), lng: Number(res.lng) }
          : FALLBACK_MAP_CENTER;
        return cachedDefaultCenter;
      })
      .catch(() => {
        cachedDefaultCenter = FALLBACK_MAP_CENTER;
        return cachedDefaultCenter;
      });
  }
  return cachedDefaultCenterPromise;
}

/**
 * 住戸／建物フォームの入力値から「地図で指定」ピッカーの初期表示位置を解決する。
 * 優先順位：
 *   1) 緯度経度が入力済みならその地点
 *   2) 「リストから選択」で号まで選ばれていれば、番地マスタの座標
 *   3) 管理者設定の初期表示位置
 *   4) ハードコードの最終フォールバック
 * @param {{ CSVLat?: any, CSVLng?: any, CSVBanchi?: any }} form
 * @param {Array<{ Banchi: any, Lat?: number, Lng?: number }>} banchiOptions
 * @returns {Promise<{ lat: number, lng: number }>}
 */
export async function resolveMapCenter(form, banchiOptions = []) {
  if (form.CSVLat && form.CSVLng) {
    return { lat: Number(form.CSVLat), lng: Number(form.CSVLng) };
  }

  if (form.CSVBanchi) {
    const b = banchiOptions.find((b) => b.Banchi === form.CSVBanchi);
    if (b && b.Lat != null && b.Lng != null) {
      return { lat: Number(b.Lat), lng: Number(b.Lng) };
    }
  }

  return fetchDefaultCenter();
}

/** 管理者設定画面で初期表示位置を更新した際に、キャッシュ済み値を破棄する */
export function invalidateDefaultMapCenterCache() {
  cachedDefaultCenter = null;
  cachedDefaultCenterPromise = null;
}
