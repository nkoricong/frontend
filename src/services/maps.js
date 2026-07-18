// src/services/maps.js
// Google Maps JavaScript API の初期化ロジックを集約

import { getGoogleMapsUrl } from "./api.js";

let _mapsLoaded = false;
let _loadPromise = null;

/**
 * Google Maps API を動的にロードする（1回だけ）
 * @returns {Promise<void>}
 */
export async function loadGoogleMaps() {
  if (_mapsLoaded) return;
  if (_loadPromise)  return _loadPromise;

  _loadPromise = (async () => {
    const { mapUrl } = await getGoogleMapsUrl();

    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src   = mapUrl;
      script.async = true;
      script.defer = true;
      script.onload  = resolve;
      script.onerror = () => reject(new Error("Google Maps load failed"));
      document.head.appendChild(script);
    });

    _mapsLoaded = true;
  })();

  return _loadPromise;
}

/**
 * 地図を初期化して google.maps.Map インスタンスを返す
 * @param {HTMLElement} container
 * @param {{ lat: number, lng: number }} center
 * @param {number} zoom
 * @returns {google.maps.Map}
 */
export function createMap(container, center, zoom = 16) {
  return new google.maps.Map(container, {
    center,
    zoom,
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    // Ctrl+スクロールや2本指操作を不要にし、通常のスクロール／1本指でズーム・パンできるようにする
    gestureHandling: "greedy",
  });
}

/**
 * マーカーを生成して地図に追加する。
 * AdvancedMarkerElement は Map ID が無いと警告が出る／環境によって
 * 描画が不安定になるため、Map ID 不要な classic Marker を使用する。
 * アイコンは赤いピンではなく、円（●）で表示する（デフォルトは黄色）。
 * @param {google.maps.Map} map
 * @param {{ lat: number, lng: number }} position
 * @param {string} title
 * @param {string} fillColor
 * @param {string} strokeColor
 * @returns {google.maps.Marker}
 */
export function addMarker(map, position, title = "", fillColor = "#FFD700", strokeColor = "#B8860B") {
  return new google.maps.Marker({
    map,
    position,
    title,
    icon: {
      path:         google.maps.SymbolPath.CIRCLE,
      scale:        8,
      fillColor,
      fillOpacity:  1,
      strokeColor,
      strokeWeight: 1.5,
    },
  });
}

/**
 * マーカーの強調表示（フォーカス中）用アイコンに切り替える／元に戻す。
 * 塗り色はステータス別の色（#101）を保ったまま、サイズと枠線でフォーカス状態を表現する。
 * @param {google.maps.Marker} marker
 * @param {boolean} focused
 * @param {string} fillColor
 * @param {string} strokeColor
 */
export function setMarkerFocused(marker, focused, fillColor = "#FFD700", strokeColor = "#B8860B") {
  marker.setIcon({
    path:         google.maps.SymbolPath.CIRCLE,
    scale:        focused ? 11 : 8,
    fillColor,
    fillOpacity:  1,
    strokeColor,
    strokeWeight: focused ? 2.5 : 1.5,
  });
  marker.setZIndex(focused ? 999 : undefined);
}

/**
 * KML テキストから KmlLayer を作成して地図に追加する
 * @param {google.maps.Map} map
 * @param {string}          kmlUrl  - R2 / Storage 上の KML URL
 * @returns {google.maps.KmlLayer}
 */
export function addKmlLayer(map, kmlUrl) {
  const layer = new google.maps.KmlLayer({
    url:             kmlUrl,
    map,
    preserveViewport: false,
  });
  return layer;
}
