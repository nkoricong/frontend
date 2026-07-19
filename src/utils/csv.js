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

// カンマ区切り・ダブルクォート対応のCSVパーサー。
// ダブルクォートで囲まれたセルの中の改行（セル内改行）はデータの一部として扱い、
// 行区切りとしては解釈しない（#105：改行を含むセルがあると、行区切りだけで
// 事前分割していた旧実装ではそこで行がずれてしまっていた）。
function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i += 2; continue; }
        inQuotes = false;
        i++;
        continue;
      }
      cur += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(cur);
      cur = "";
      i++;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
      i += (ch === "\r" && text[i + 1] === "\n") ? 2 : 1;
      continue;
    }
    cur += ch;
    i++;
  }
  if (cur !== "" || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }

  // 完全に空行（列すべてが空文字）はスキップする
  return rows.filter(r => !(r.length === 1 && r[0] === ""));
}

/**
 * ヘッダー行付きCSVテキストを、列名をキーとするオブジェクト配列にパースする。
 * 列の並びではなく列名で対応付けるため、列順の入れ替えに強い。
 * @param {string} text
 * @returns {Array<Object<string, string>>}
 */
export function parseCsvWithHeader(text) {
  const rows = parseCsvRows(text);
  if (rows.length < 2) return [];
  const header = rows[0].map(h => h.trim());
  return rows.slice(1).map(cells => {
    const obj = {};
    header.forEach((col, i) => { obj[col] = (cells[i] ?? "").trim(); });
    return obj;
  });
}
