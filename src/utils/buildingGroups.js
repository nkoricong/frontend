// src/utils/buildingGroups.js
// 住戸リストを「建物単位」にグルーピングする（#100）。
// 建物マスタから選択されている住戸（BuildingNo あり）や、建物名を直接入力している
// 住戸（BuildingMasterListView.vue の backfillDedupeKey と同じ判定基準）を、
// 同じ建物ごとにアコーディオンでまとめて表示するための下ごしらえを行う。
// 戸建てや建物名未入力の住戸は対象外とし、通常どおり単独行のまま表示する。

function buildingGroupKey(h) {
  if (h.BuildingNo != null) return `master:${h.BuildingNo}`;
  if (!h.BuildingName || h.BuildingCategory === "戸建て") return null;
  return [
    "manual", h.BuildingCategory, h.BuildingName, h.Floors, h.Rooms,
    h.AddressSW, h.CSVTownName, h.CSVCho, h.CSVBanchi,
    h.InputTownName, h.InputCho, h.InputBanchi,
  ].join("|");
}

/**
 * 表示順に並んだ住戸配列を、建物ごとのグループと単独住戸が混在する配列に変換する。
 * 各グループの表示位置は、そのグループに属する最初の住戸の位置を引き継ぐ。
 * @param {Array<Object>} houses
 * @returns {Array<{ type: "building", key: string, houses: Object[] } | { type: "house", house: Object }>}
 */
export function groupHousesByBuilding(houses) {
  const result = [];
  const groupIndexByKey = new Map();

  for (const h of houses) {
    const key = buildingGroupKey(h);
    if (!key) {
      result.push({ type: "house", house: h });
      continue;
    }
    if (groupIndexByKey.has(key)) {
      result[groupIndexByKey.get(key)].houses.push(h);
    } else {
      groupIndexByKey.set(key, result.length);
      result.push({ type: "building", key, houses: [h] });
    }
  }

  return result;
}
