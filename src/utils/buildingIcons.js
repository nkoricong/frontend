// src/utils/buildingIcons.js
// 建物種別に応じたFont Awesomeアイコンクラス（ORIGINAL/ChildMap.htmlのBuildingCategory分岐を踏襲）

const BUILDING_ICONS = {
  "店舗":     "fa-store",
  "工場":     "fa-industry",
  "倉庫":     "fa-warehouse",
  "事務所":   "fa-building",
  "各種施設": "fa-building",
  "駐車場":   "fa-parking",
  "空地":     "fa-stop-circle",
};

export function buildingIconClass(buildingCategory) {
  return BUILDING_ICONS[buildingCategory] || null;
}
