<template>
  <!-- ローディング -->
  <div v-if="parsing" class="loading">
    <i class="fas fa-spinner fa-4x fa-spin"></i>
  </div>

  <main role="main" class="container py-3">

    <!-- ヘッダー -->
    <header class="sticky-top bg-white mb-2 py-2 border-bottom">
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <button class="btn btn-link p-0 text-center" @click="router.push({ name: 'settings' })">
            <i class="fas fa-arrow-circle-left fa-2x"></i>
            <div class="small">戻る</div>
          </button>
        </div>
        <div class="text-center flex-grow-1" style="font-size:22px; font-weight:700;">住居表示住所CSVインポート</div>
        <div>
          <button class="btn btn-link p-0 text-center" @click="router.push({ name: 'mainMenu' })">
            <i class="fas fa-home fa-2x"></i>
            <div class="small">ホーム</div>
          </button>
        </div>
      </div>
    </header>

    <div class="alert alert-secondary">
      <p class="mb-1">国土地理院・電子国土基本図（地名情報）の「住居表示住所」CSV（市区町村単位）をインポートします。</p>
      <p class="mb-1">
        <a href="https://www.gsi.go.jp/kihonjohochousa/jukyo_jusho.html" target="_blank" rel="noopener">ダウンロードサイト</a>
      </p>
      <p class="mb-0">
        取り込んだデータは 町名・番地・号・緯度・経度 に分解して「町名マスタ」として保存され、
        住戸情報の「リストから選択」の選択肢として使われます（カードや子カードに紐づく設定ではありません）。
      </p>
    </div>

    <!-- ファイル選択 -->
    <div class="card mb-3">
      <div class="card-body">
        <h5 class="card-title">CSVファイルの選択</h5>
        <p class="text-muted small mb-2">
          ヘッダー行のない9列のCSV（市区町村コード, 町名, 番地, 号, URL, (空欄), 経度, 緯度, 精度区分）を選択してください。
        </p>
        <input type="file" class="form-control" accept=".csv" @change="onFileChange" />
        <p v-if="parseMessage" class="mt-2 mb-0">{{ parseMessage }}</p>
      </div>
    </div>

    <!-- プレビュー -->
    <div class="card mb-3" v-if="rows.length > 0">
      <div class="card-body">
        <h5 class="card-title">プレビュー（先頭{{ previewRows.length }}件 / 全{{ rows.length }}件）</h5>
        <div class="table-responsive">
          <table class="table table-sm table-bordered">
            <thead>
              <tr>
                <th>市区町村コード</th>
                <th>町名</th>
                <th>番地</th>
                <th>号</th>
                <th>緯度</th>
                <th>経度</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in previewRows" :key="idx">
                <td>{{ row.CityCode }}</td>
                <td>{{ row.Town }}</td>
                <td>{{ row.Cho }}</td>
                <td>{{ row.Banchi }}</td>
                <td>{{ row.Lat }}</td>
                <td>{{ row.Lng }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 実行 -->
    <div class="d-grid mb-3">
      <button
        class="btn btn-primary"
        :disabled="!canImport || importing"
        @click="runImport"
      >
        <span v-if="importing"><i class="fas fa-spinner fa-spin"></i> インポート中... （{{ importedCount }} / {{ rows.length }} 件）</span>
        <span v-else><i class="fas fa-file-import"></i> 町名マスタへインポート実行</span>
      </button>
      <div v-if="importing" class="progress mt-2" style="height:6px;">
        <div class="progress-bar" role="progressbar" :style="{ width: importProgressPercent + '%' }"></div>
      </div>
    </div>

    <div v-if="resultMessage" :class="['alert', resultOk ? 'alert-success' : 'alert-danger']">
      {{ resultMessage }}
    </div>

  </main>
</template>

<script setup>
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { importKibanMasterBatch } from "@/services/api.js";

const router = useRouter();

const parsing  = ref(false);
const rows     = ref([]);
const parseMessage  = ref("");

const importing     = ref(false);
const importedCount = ref(0);
const resultMessage = ref("");
const resultOk      = ref(false);

const previewRows = computed(() => rows.value.slice(0, 20));
const canImport    = computed(() => rows.value.length > 0);
const importProgressPercent = computed(() => {
  if (rows.value.length === 0) return 0;
  return Math.round((importedCount.value / rows.value.length) * 100);
});

// 一度に送るバッチサイズ（Worker側でのタイムアウトを避けるため分割送信する）
const BATCH_SIZE = 2000;

// カンマ区切り・簡易ダブルクォート対応のCSV行パーサー
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

// 国土地理院の住居表示住所CSVはヘッダー行なし・9列固定（列位置は0始まり）：
// 0:市区町村コード 1:町名 2:番地 3:号 4:URL 5:(空欄) 6:経度 7:緯度 8:精度区分
// （ORIGINAL/シート操作.js の kibanCSVtoJSON と同じ列位置。実データで確認済み）
function parseCsvText(text) {
  const lines = text.split(/\r\n|\r|\n/).filter(l => l.length > 0);
  return lines.map(line => {
    const c = parseCsvLine(line);
    return {
      CityCode: (c[0] ?? "").trim(),
      Town:     (c[1] ?? "").trim(),
      Cho:      (c[2] ?? "").trim(),
      Banchi:   (c[3] ?? "").trim(),
      Lng:      (c[6] ?? "").trim(),
      Lat:      (c[7] ?? "").trim(),
    };
  }).filter(r => r.Town);
}

async function onFileChange(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  resultMessage.value = "";
  parsing.value = true;
  try {
    const text = await file.text();
    const parsedRows = parseCsvText(text);
    rows.value = parsedRows;
    parseMessage.value = parsedRows.length > 0
      ? `${parsedRows.length}件のデータを読み込みました。内容を確認して「インポート実行」を押してください。`
      : "有効なデータ行が見つかりませんでした。ファイル形式を確認してください。";
  } catch (e) {
    console.error(e);
    rows.value = [];
    parseMessage.value = "ファイルの読み込みに失敗しました。";
  } finally {
    parsing.value = false;
  }
}

async function runImport() {
  if (!canImport.value) return;

  importing.value     = true;
  importedCount.value = 0;
  resultMessage.value = "";
  try {
    for (let i = 0; i < rows.value.length; i += BATCH_SIZE) {
      const batch = rows.value.slice(i, i + BATCH_SIZE);
      const res = await importKibanMasterBatch(batch);
      if (res.status !== "success") {
        resultOk.value = false;
        resultMessage.value = res.message || `インポートに失敗しました（${importedCount.value}件まで完了）。`;
        return;
      }
      importedCount.value += batch.length;
    }
    resultOk.value = true;
    resultMessage.value = `インポートが完了しました。（${importedCount.value}件）`;
  } catch (e) {
    console.error(e);
    resultOk.value = false;
    resultMessage.value = `インポートに失敗しました（${importedCount.value}件まで完了）。`;
  } finally {
    importing.value = false;
  }
}
</script>

<style scoped>
.loading {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(255,255,255,0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}
</style>
