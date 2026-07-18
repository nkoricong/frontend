// src/utils/csv.js
// CSVの生成・パースに関する共通ロジック（#102, #103）

/** CSV1セル分の値をエスケープする */
export function toCsvField(value) {
  const s = value == null ? "" : String(value);
  return /["\r\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * 列名配列とオブジェクト配列からCSVテキストを生成する（先頭にBOM付き、UTF-8）。
 * @param {string[]} columns
 * @param {Array<Object>} rows
 * @returns {string}
 */
export function buildCsv(columns, rows) {
  const lines = [columns.map(toCsvField).join(",")];
  for (const row of rows) {
    lines.push(columns.map(col => toCsvField(row[col])).join(","));
  }
  // 先頭にBOMを付け、Excelで文字化けしないUTF-8として保存する
  return "\uFEFF" + lines.join("\r\n");
}

/** CSVテキストをBlobとして生成し、ブラウザでファイルダウンロードさせる */
export function downloadCsv(content, filename) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// カンマ区切り・ダブルクォート対応のCSV行パーサー
function parseCsvLine(line) {
  const cells = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

/**
 * ヘッダー行付きCSVテキストを、列名をキーとするオブジェクト配列にパースする。
 * 列の並びではなく列名で対応付けるため、列順の入れ替えに強い。
 * @param {string} text
 * @returns {Array<Object<string, string>>}
 */
export function parseCsvWithHeader(text) {
  const lines = text.split(/\r\n|\r|\n/).filter(l => l.length > 0);
  if (lines.length < 2) return [];
  const header = parseCsvLine(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const cells = parseCsvLine(line);
    const obj = {};
    header.forEach((col, i) => { obj[col] = (cells[i] ?? "").trim(); });
    return obj;
  });
}
