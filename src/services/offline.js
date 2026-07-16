// src/services/offline.js
// 子カードのオフライン利用（マイページ／子カード画面）を支えるローカルストレージ層。
//
// 「オフラインで使用」が有効な子カードは、区域カード情報・住戸一覧・訪問履歴・
// 静止地図画像を localStorage にキャッシュし、ネット未接続時でも
// ChildMapView の閲覧・結果登録ができるようにする。
// 未同期の訪問結果は pendingVisits に貯め、オンライン復帰後に同期する。

import { ref, onMounted, onUnmounted } from "vue";
import { getGoogleMapsUrl, upsertVisitRecord } from "./api.js";

const INDEX_KEY         = "ekuiki_offline_index";
const CHILD_KEY_PREFIX  = "ekuiki_offline_child_";

const TIME_ORDER = {
  "9時以前":    1,
  "9時〜12時":  2,
  "12時〜13時": 3,
  "13時〜16時": 4,
  "16時〜18時": 5,
  "18時以降":   6,
};

// ------------------------------------------------------------------
// オンライン状態
// ------------------------------------------------------------------

export function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

/** オンライン/オフライン状態を監視するリアクティブなref（コンポーネント内で使用） */
export function useOnlineStatus() {
  const online = ref(isOnline());
  function update() { online.value = isOnline(); }
  onMounted(() => {
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
  });
  onUnmounted(() => {
    window.removeEventListener("online", update);
    window.removeEventListener("offline", update);
  });
  return online;
}

// ------------------------------------------------------------------
// インデックス（オフライン化済みの子カード一覧）
// ------------------------------------------------------------------

function readIndex() {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY)) || [];
  } catch {
    return [];
  }
}

function writeIndex(index) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

export function getOfflineIndex() {
  return readIndex();
}

export function isChildOffline(childId) {
  return readIndex().some(e => String(e.childId) === String(childId));
}

export function findOfflineEntryByCard(cardNo, childNo) {
  return readIndex().find(e => String(e.cardNo) === String(cardNo) && String(e.childNo) === String(childNo)) ?? null;
}

/** オフライン化済みの子カードが1件でもあるか */
export function hasOfflineData() {
  return readIndex().length > 0;
}

/**
 * オフライン保存済みの子カード一覧を、マイページ（AssignmentListView）の
 * カード一覧と同じフィールド形式（CARDNO等）に整形して返す。
 * ネット未接続時にマイページ／オフライン専用ページの一覧表示に使う。
 */
export function getOfflineChildRows() {
  return readIndex()
    .map(entry => {
      const data = getOfflineChild(entry.childId);
      if (!data) return null;
      const c  = data.cardInfo  || {};
      const ch = data.childInfo || {};
      return {
        CHILDID:           ch.ChildID ?? entry.childId,
        CARDNO:            ch.CardNo  ?? entry.cardNo,
        CHILDNO:           ch.ChildNo ?? entry.childNo,
        CHILDBLOCK:        ch.ChildBlock ?? "",
        COLOR:             c.Color ?? "",
        CHILDSTATUS:       ch.ChildStatus ?? "",
        CHILDHOUSES:       (data.houses || []).length || ch.ChildHouses || 0,
        VISITED:           ch.Visited ?? 0,
        DESCRIPTION:       ch.ChildDescription ?? "",
        CHILDCHECKOUTDATE: ch.ChildCheckoutDate ?? null,
        CHILDLIMITDATE:    ch.ChildLimitDate ?? null,
        AREA:              c.Area ?? "",
        SHARED:            false,
      };
    })
    .filter(Boolean);
}

// ------------------------------------------------------------------
// 子カード単位のオフラインデータ
// ------------------------------------------------------------------

export function getOfflineChild(childId) {
  try {
    const raw = localStorage.getItem(CHILD_KEY_PREFIX + childId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeOfflineChild(childId, data) {
  localStorage.setItem(CHILD_KEY_PREFIX + childId, JSON.stringify(data));
}

/**
 * 子カードをオフライン化する（区域カード情報・住戸一覧・地図画像を保存）。
 * offlineUser（オフライン化した時点のログインユーザー名・UserID・グループ名）も
 * あわせて保存し、完全オフライン／未ログインでの閲覧時にも「誰が使用しているか」を
 * 表示したり、訪問結果登録時の担当者として使えるようにする。
 */
export async function saveOfflineChild(childId, cardNo, childNo, { cardInfo, childInfo, houses, offlineUser }) {
  const mapImage = await fetchStaticMapImage(childInfo, houses).catch(() => null);

  writeOfflineChild(childId, {
    cardInfo,
    childInfo,
    houses,
    mapImage,
    offlineUser: offlineUser || null,
    pendingVisits: [],
    savedAt: new Date().toISOString(),
  });

  const index = readIndex().filter(e => String(e.childId) !== String(childId));
  index.push({ childId, cardNo, childNo, savedAt: new Date().toISOString() });
  writeIndex(index);
}

/**
 * オフライン専用ページ等で表示する「このデバイスをオフライン化したユーザー」情報を返す。
 * 複数の子カードがオフライン化されている場合は、最後に保存されたものを優先する。
 */
export function getOfflineUserInfo() {
  const sorted = [...readIndex()].sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""));
  for (const entry of sorted) {
    const data = getOfflineChild(entry.childId);
    if (data?.offlineUser) return data.offlineUser;
  }
  return null;
}

/** オフラインモードを解除し、保存していたデータを削除する */
export function removeOfflineChild(childId) {
  localStorage.removeItem(CHILD_KEY_PREFIX + childId);
  writeIndex(readIndex().filter(e => String(e.childId) !== String(childId)));
}

// ------------------------------------------------------------------
// 訪問結果（オフライン時の登録・同期）
// ------------------------------------------------------------------

// バックエンド visitService.js の _recalcVisitStatus と同じ規則で
// オフライン時点の暫定ステータスを計算する（checkout_date絞り込みは省略）
function computeVisitStatusOffline(vrecords, ngFlagInput, existingNgFlag) {
  const sorted = [...(vrecords || [])].sort((a, b) => {
    if (a.VisitDate !== b.VisitDate) return (b.VisitDate || "").localeCompare(a.VisitDate || "");
    const ta = TIME_ORDER[a.Time] || 0;
    const tb = TIME_ORDER[b.Time] || 0;
    return tb - ta;
  });

  let newStatus = "未訪問";
  if (sorted.length > 0) {
    const top = sorted[0].Result || "";
    if (top === "訪問不可")      newStatus = "訪問不可";
    else if (top.includes("済")) newStatus = "済";
    else if (top === "不在")     newStatus = "不在";
    else if (top !== "")         newStatus = "不在";
  }

  const effectiveNg = ngFlagInput ?? existingNgFlag;
  if (effectiveNg === "不可") newStatus = "訪問不可";
  return newStatus;
}

/**
 * オフライン中に入力された訪問結果をローカルへキューイングする。
 * house（ChildMapViewのhouses配列内オブジェクト）とオフラインキャッシュの
 * 両方に反映する。対象の子カードがオフライン化されていなければ null を返す。
 */
export function queueOfflineVisit(childId, record, house) {
  const data = getOfflineChild(childId);
  if (!data) return null;

  const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const finalNote = record.NGFlag === "不可" ? `訪問不可が入力された。${record.Note || ""}` : (record.Note || "");

  const vrecord = {
    VisitID:   localId,
    CardNo:    record.CardNo,
    ChildNo:   record.ChildNo,
    HousingNo: record.HousingNo,
    VisitDate: record.VisitDate,
    Time:      record.Time || "",
    Field:     record.Field || "",
    Result:    record.Result || "",
    Minister:  record.Minister || "",
    Comment:   record.Comment || "",
    Note:      finalNote,
    Term:      record.Term || "",
    _pending:  true,
  };

  const targetHouse = (data.houses || []).find(h => h.HousingNo === record.HousingNo);
  let newStatus = "未訪問";
  if (targetHouse) {
    targetHouse.VRecord = [...(targetHouse.VRecord || []), vrecord];
    newStatus = computeVisitStatusOffline(targetHouse.VRecord, record.NGFlag, targetHouse.NGFlag);
    targetHouse.VisitStatus = newStatus;
    if (record.NGFlag !== null && record.NGFlag !== undefined) targetHouse.NGFlag = record.NGFlag || "";
  }

  data.pendingVisits = data.pendingVisits || [];
  data.pendingVisits.push({ ...record, _localId: localId, _createdAt: new Date().toISOString() });
  writeOfflineChild(childId, data);

  if (house) {
    house.VRecord = targetHouse ? targetHouse.VRecord : [...(house.VRecord || []), vrecord];
    house.VisitStatus = newStatus;
  }

  return { visitStatus: newStatus };
}

/** 未同期の訪問記録（ローカルのみ）を削除する */
export function removeOfflineVisit(childId, localId, house) {
  const data = getOfflineChild(childId);
  if (!data) return null;

  data.pendingVisits = (data.pendingVisits || []).filter(p => p._localId !== localId);

  let newStatus = "未訪問";
  for (const h of data.houses || []) {
    h.VRecord = (h.VRecord || []).filter(v => v.VisitID !== localId);
    if (house && h.HousingNo === house.HousingNo) {
      newStatus = computeVisitStatusOffline(h.VRecord, null, h.NGFlag);
      h.VisitStatus = newStatus;
    }
  }
  writeOfflineChild(childId, data);

  if (house) {
    house.VRecord = (house.VRecord || []).filter(v => v.VisitID !== localId);
    house.VisitStatus = newStatus;
  }

  return { visitStatus: newStatus };
}

/** 未同期の訪問結果一覧を返す */
export function getPendingVisits(childId) {
  return getOfflineChild(childId)?.pendingVisits || [];
}

/**
 * 未同期の訪問結果をSupabaseへ書き込み、成功した分をローカルから消す。
 * 一部失敗しても、成功分だけ反映して残りは pendingVisits に残す。
 */
export async function syncPendingVisits(childId) {
  const data = getOfflineChild(childId);
  if (!data || !data.pendingVisits?.length) {
    return { status: "success", synced: 0, remaining: 0 };
  }

  let synced = 0;
  const remaining = [];

  for (const record of data.pendingVisits) {
    const { _localId, _createdAt, ...payload } = record;
    try {
      const res = await upsertVisitRecord(payload);
      if (res.status === "success") {
        synced++;
        const realId = res.inserted?.[0]?.row_id;
        for (const h of data.houses || []) {
          h.VRecord = (h.VRecord || []).map(v =>
            v.VisitID === _localId ? { ...v, VisitID: realId ?? v.VisitID, _pending: false } : v
          );
        }
      } else {
        remaining.push(record);
      }
    } catch {
      remaining.push(record);
    }
  }

  data.pendingVisits = remaining;
  writeOfflineChild(childId, data);

  return { status: remaining.length === 0 ? "success" : "partial", synced, remaining: remaining.length };
}

// ------------------------------------------------------------------
// 静止地図画像（Google Static Maps API）
// ------------------------------------------------------------------

async function fetchStaticMapImage(childInfo, houses) {
  if (!childInfo?.ChildLat || !childInfo?.ChildLng) return null;

  const { mapUrl } = await getGoogleMapsUrl();
  const key = new URL(mapUrl).searchParams.get("key");
  if (!key) return null;

  const center = `${childInfo.ChildLat},${childInfo.ChildLng}`;
  const markerParams = (houses || [])
    .filter(h => h.CSVLat && h.CSVLng)
    .slice(0, 40) // URL長制限を考慮して上限を設ける
    .map(h => `markers=color:red%7C${h.CSVLat},${h.CSVLng}`)
    .join("&");

  const staticUrl =
    `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(center)}` +
    `&zoom=16&size=640x400${markerParams ? "&" + markerParams : ""}&key=${key}`;

  const res = await fetch(staticUrl);
  if (!res.ok) return null;
  const blob = await res.blob();
  return blobToDataUrl(blob);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
