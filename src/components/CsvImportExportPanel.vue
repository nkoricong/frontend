<template>
  <div class="d-flex flex-wrap gap-2">
    <button class="btn btn-outline-secondary btn-sm" @click="downloadFormat">
      <i class="fas fa-file-csv"></i> CSVフォーマット
    </button>
    <button class="btn btn-outline-secondary btn-sm" :disabled="exporting" @click="runExport">
      <i class="fas fa-file-export"></i> {{ exporting ? "エクスポート中..." : "エクスポート" }}
    </button>
    <button class="btn btn-outline-primary btn-sm" @click="openImportModal">
      <i class="fas fa-file-import"></i> インポート
    </button>
  </div>

  <!-- インポートモーダル -->
  <div
    class="modal fade"
    :class="{ show: showModal }"
    :style="showModal ? 'display:block' : 'display:none'"
    tabindex="-1"
    role="dialog"
    @click.self="closeImportModal"
  >
    <div class="modal-dialog modal-lg" role="document">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">{{ title }} — CSVインポート</h5>
          <button type="button" class="btn-close" @click="closeImportModal"></button>
        </div>
        <div class="modal-body">
          <div v-if="hasLegacyFormat" class="mb-3">
            <label class="form-label small mb-1">CSVフォーマット</label>
            <div class="d-flex gap-3">
              <div class="form-check">
                <input class="form-check-input" type="radio" id="fmt-current" value="current" v-model="format">
                <label class="form-check-label" for="fmt-current">現アプリ用</label>
              </div>
              <div class="form-check">
                <input class="form-check-input" type="radio" id="fmt-legacy" value="legacy" v-model="format">
                <label class="form-check-label" for="fmt-legacy">旧アプリ用（GAS版）</label>
              </div>
            </div>
          </div>

          <div v-if="importModes.length > 0" class="mb-3">
            <label class="form-label small mb-1">インポートモード</label>
            <div class="d-flex gap-3">
              <div class="form-check" v-for="m in importModes" :key="m.value">
                <input class="form-check-input" type="radio" :id="'mode-' + m.value" :value="m.value" v-model="importMode">
                <label class="form-check-label" :for="'mode-' + m.value">{{ m.label }}</label>
              </div>
            </div>
          </div>

          <div v-if="hasDeleteSyncOption" class="mb-3">
            <label class="form-label small mb-1">CSVに無い既存データの扱い</label>
            <div class="d-flex gap-3">
              <div class="form-check">
                <input class="form-check-input" type="radio" id="del-keep" :value="false" v-model="deleteMissing">
                <label class="form-check-label" for="del-keep">そのまま残す（追加・上書きのみ）</label>
              </div>
              <div class="form-check">
                <input class="form-check-input" type="radio" id="del-sync" :value="true" v-model="deleteMissing">
                <label class="form-check-label" for="del-sync">削除する（完全同期）</label>
              </div>
            </div>
          </div>

          <div class="mb-3">
            <input type="file" class="form-control" accept=".csv" @change="onFileChange">
          </div>
          <p v-if="parseMessage" class="small" :class="parseRows.length > 0 ? 'text-muted' : 'text-danger'">{{ parseMessage }}</p>

          <div v-if="previewRows.length > 0" class="table-responsive mb-3" style="max-height:300px;">
            <table class="table table-sm table-bordered">
              <thead>
                <tr><th v-for="c in previewColumns" :key="c">{{ c }}</th></tr>
              </thead>
              <tbody>
                <tr v-for="(row, i) in previewRows" :key="i">
                  <td v-for="c in previewColumns" :key="c">{{ row[c] }}</td>
                </tr>
              </tbody>
            </table>
            <p class="small text-muted">先頭{{ previewRows.length }}件のプレビュー（全{{ parseRows.length }}件）</p>
          </div>

          <div v-if="importing" class="mb-3">
            <div class="progress" style="height:20px;">
              <div class="progress-bar" :style="{ width: importProgressPercent + '%' }">{{ importedCount }} / {{ parseRows.length }}</div>
            </div>
            <p v-if="retryMessage" class="small text-warning mt-1 mb-0">{{ retryMessage }}</p>
          </div>

          <p v-if="resultMessage" class="small" :class="resultOk ? 'text-success' : 'text-danger'" style="white-space:pre-wrap;">{{ resultMessage }}</p>
        </div>
        <div class="modal-footer">
          <button v-if="importing" class="btn btn-outline-danger" @click="requestCancel" :disabled="cancelRequested">
            {{ cancelRequested ? "キャンセル中..." : "キャンセル" }}
          </button>
          <button v-else class="btn btn-secondary" @click="closeImportModal">閉じる</button>
          <button
            class="btn btn-primary"
            :disabled="parseRows.length === 0 || importing"
            @click="runImport"
          >
            <span v-if="importing"><i class="fas fa-spinner fa-spin"></i> インポート中...</span>
            <span v-else>インポート実行</span>
          </button>
        </div>
      </div>
    </div>
  </div>
  <div v-if="showModal" class="modal-backdrop fade show"></div>
</template>

<script setup>
import { ref, computed } from "vue";
import { buildCsv, downloadCsv, parseCsvWithHeader } from "@/utils/csv.js";

const props = defineProps({
  title:               { type: String, required: true },
  columns:             { type: Array,  required: true },
  legacyColumns:       { type: Array,  default: () => [] },
  hasLegacyFormat:      { type: Boolean, default: false },
  hasDeleteSyncOption:  { type: Boolean, default: false },
  batchSize:            { type: Number, default: 200 },
  formatTemplateFilename: { type: String, required: true },
  exportFilename:       { type: String, required: true },
  // (format) => Promise<object[]>  現在の全件データを、format(current/legacy)に応じた
  //   列構成のオブジェクト配列で返す
  exportRows:           { type: Function, required: true },
  // (rows, {format}) => Promise<{updated?, inserted?, errors?, warnings?}>
  //   1バッチ分の取り込みをWorker APIに送る
  importBatch:          { type: Function, required: true },
  // (missingKeys) => Promise<void>  完全同期モードでCSVに無い既存データを削除する
  //   （hasDeleteSyncOptionがtrueの画面のみ必須）
  deleteMissingRows:    { type: Function, default: null },
  // 既存の全件データから、CSVの各行に対応する自然キーの配列を取り出す
  //   （完全同期モードで「CSVに無いキー」を計算するために使用）
  extractExistingKeys:  { type: Function, default: null },
  extractCsvKey:        { type: Function, default: null },
  // [{value, label}]  指定するとインポートモード選択ラジオボタンを表示する
  importModes:          { type: Array, default: () => [] },
  // ({format, mode}) => Promise<void>  バッチループの直前に一度だけ呼ばれるフック
  //   （総入替モードの事前削除等、バッチ処理の外側で1回だけ行いたい処理用）
  beforeImport:         { type: Function, default: null },
});

const emit = defineEmits(["imported"]);

const format         = ref("current");
const importMode     = ref("");
const deleteMissing  = ref(false);
const parseRows      = ref([]);
const parseMessage   = ref("");
const showModal      = ref(false);
const importing      = ref(false);
const importedCount  = ref(0);
const resultMessage  = ref("");
const resultOk       = ref(false);
const exporting      = ref(false);
const retryMessage   = ref("");
const cancelRequested = ref(false);

const CANCELLED = Symbol("cancelled");

// Cloudflare Workers（Freeプラン）のCPU時間/レート制限に一時的に抵触した
// バッチ呼び出しを、間隔を空けてリトライする。待機中もキャンセル可能。
const MAX_RETRIES  = 8;
const BASE_DELAY_MS = 2000;
const MAX_DELAY_MS  = 30000;

function requestCancel() {
  cancelRequested.value = true;
}

function sleepCancellable(ms) {
  return new Promise(resolve => {
    const deadline = Date.now() + ms;
    (function tick() {
      if (cancelRequested.value || Date.now() >= deadline) resolve();
      else setTimeout(tick, 200);
    })();
  });
}

async function importBatchWithRetry(batch, opts) {
  let attempt = 0;
  for (;;) {
    if (cancelRequested.value) throw CANCELLED;
    try {
      const res = await props.importBatch(batch, opts);
      retryMessage.value = "";
      return res;
    } catch (e) {
      attempt++;
      if (cancelRequested.value) throw CANCELLED;
      if (attempt > MAX_RETRIES) throw e;
      const delaySec = Math.round(Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS) / 1000);
      retryMessage.value = `一時的なエラーのため${delaySec}秒後に再試行します（${attempt}/${MAX_RETRIES}回目）：${e.message}`;
      await sleepCancellable(delaySec * 1000);
      if (cancelRequested.value) throw CANCELLED;
    }
  }
}

const previewColumns = computed(() => (format.value === "legacy" && props.hasLegacyFormat ? props.legacyColumns : props.columns));
const previewRows    = computed(() => parseRows.value.slice(0, 10));
const importProgressPercent = computed(() => parseRows.value.length === 0 ? 0 : Math.round((importedCount.value / parseRows.value.length) * 100));

function downloadFormat() {
  const cols = format.value === "legacy" && props.hasLegacyFormat ? props.legacyColumns : props.columns;
  downloadCsv(buildCsv(cols, []), props.formatTemplateFilename);
}

async function runExport() {
  exporting.value = true;
  try {
    const rows = await props.exportRows(format.value);
    const cols = format.value === "legacy" && props.hasLegacyFormat ? props.legacyColumns : props.columns;
    downloadCsv(buildCsv(cols, rows), props.exportFilename);
  } catch (e) {
    console.error(e);
    alert("エクスポートに失敗しました：" + e.message);
  } finally {
    exporting.value = false;
  }
}

function openImportModal() {
  showModal.value     = true;
  parseRows.value      = [];
  parseMessage.value   = "";
  resultMessage.value  = "";
  deleteMissing.value  = false;
  importMode.value     = props.importModes[0]?.value ?? "";
  cancelRequested.value = false;
  retryMessage.value    = "";
}

function closeImportModal() {
  if (importing.value) return;
  showModal.value = false;
}

async function onFileChange(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = "";
  if (!file) return;

  resultMessage.value = "";
  try {
    const text = await file.text();
    const rows = parseCsvWithHeader(text);
    parseRows.value = rows;
    parseMessage.value = rows.length > 0
      ? `${rows.length}件のデータを読み込みました。内容を確認して「インポート実行」を押してください。`
      : "有効なデータ行が見つかりませんでした。ヘッダー行と列構成を確認してください。";
  } catch (e) {
    console.error(e);
    parseRows.value = [];
    parseMessage.value = "ファイルの読み込みに失敗しました。";
  }
}

async function runImport() {
  if (parseRows.value.length === 0) return;

  if (props.hasDeleteSyncOption && deleteMissing.value) {
    if (!confirm("CSVに存在しない既存データは削除されます。よろしいですか？")) return;
  } else {
    if (!confirm(`${parseRows.value.length}件のデータを取り込みます。よろしいですか？`)) return;
  }

  if (importMode.value === "replace") {
    const typed = prompt("既存の全データを削除してCSVの内容に総入替します。よろしければ「削除して入替」と入力してください。");
    if (typed !== "削除して入替") return;
  }

  importing.value      = true;
  importedCount.value  = 0;
  resultMessage.value  = "";
  cancelRequested.value = false;
  retryMessage.value    = "";
  const aggregate = { updated: 0, inserted: 0, errors: [], warnings: [] };

  try {
    if (props.beforeImport) await props.beforeImport({ format: format.value, mode: importMode.value });

    for (let i = 0; i < parseRows.value.length; i += props.batchSize) {
      if (cancelRequested.value) throw CANCELLED;
      const batch = parseRows.value.slice(i, i + props.batchSize);
      const res = await importBatchWithRetry(batch, { format: format.value, mode: importMode.value });
      aggregate.updated  += res.updated  ?? 0;
      aggregate.inserted += res.inserted ?? 0;
      if (res.errors)   aggregate.errors.push(...res.errors);
      if (res.warnings) aggregate.warnings.push(...res.warnings);
      importedCount.value = Math.min(i + props.batchSize, parseRows.value.length);
    }

    let deletedCount = 0;
    if (props.hasDeleteSyncOption && deleteMissing.value && props.deleteMissingRows && props.extractExistingKeys && props.extractCsvKey) {
      const existingKeys = await props.extractExistingKeys();
      const csvKeys = new Set(parseRows.value.map(props.extractCsvKey));
      const missingKeys = existingKeys.filter(k => !csvKeys.has(k));
      if (missingKeys.length > 0) {
        deletedCount = await props.deleteMissingRows(missingKeys);
      }
    }

    resultOk.value = true;
    const parts = [`更新${aggregate.updated}件・新規${aggregate.inserted}件`];
    if (deletedCount > 0) parts.push(`削除${deletedCount}件`);
    if (aggregate.warnings.length > 0) parts.push(`警告${aggregate.warnings.length}件:\n` + aggregate.warnings.join("\n"));
    if (aggregate.errors.length > 0) {
      resultOk.value = false;
      parts.push(`エラー${aggregate.errors.length}件:\n` + aggregate.errors.join("\n"));
    }
    resultMessage.value = `インポートが完了しました。（${parts.join(" / ")}）`;
    parseRows.value = [];
    emit("imported");
  } catch (e) {
    if (e === CANCELLED) {
      resultOk.value = false;
      resultMessage.value = `ユーザーの操作によりキャンセルしました（${importedCount.value}件まで完了）。`;
    } else {
      console.error(e);
      resultOk.value = false;
      resultMessage.value = `インポートに失敗しました（${importedCount.value}件まで完了）：${e.message}`;
    }
  } finally {
    importing.value      = false;
    cancelRequested.value = false;
    retryMessage.value    = "";
  }
}

</script>
