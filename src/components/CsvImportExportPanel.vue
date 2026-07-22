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

          <div v-if="!currentJobId" class="mb-3">
            <input type="file" class="form-control" accept=".csv" @change="onFileChange">
          </div>
          <p v-if="!currentJobId && parseMessage" class="small" :class="parseRows.length > 0 ? 'text-muted' : 'text-danger'">{{ parseMessage }}</p>

          <div v-if="!currentJobId && previewRows.length > 0" class="table-responsive mb-3" style="max-height:300px;">
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

          <div v-if="currentJobId" class="alert alert-info small">
            バックグラウンドで実行中です（GitHub Actions）。このモーダルを閉じたり画面を離れても処理は継続され、再度開けば進捗が表示されます。
          </div>

          <div v-if="importing" class="mb-3">
            <div class="progress" style="height:20px;">
              <div class="progress-bar" :style="{ width: importProgressPercent + '%' }">{{ importedCount }} / {{ parseRows.length }}</div>
            </div>
            <p v-if="retryMessage" class="small text-warning mt-1 mb-0">{{ retryMessage }}</p>
            <p v-if="currentJobId && jobStatus" class="small text-muted mt-1 mb-0">状態: {{ jobStatus }}</p>
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
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { buildCsv, downloadCsv, parseCsvWithHeader } from "@/utils/csv.js";
import { startCsvImportJob, getCsvImportJobStatus, cancelCsvImportJob } from "@/services/api.js";

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
  // 指定すると、Worker上での同期バッチ処理の代わりにGitHub Actionsへジョブを
  // 投入する非同期方式になる（#18）。値はWorker側のtarget識別子（例:"detail"）。
  importTarget:         { type: String, default: null },
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
const rawCsvText     = ref("");

const CANCELLED = Symbol("cancelled");

// ------------------------------------------------------------------
// ジョブ方式（GitHub Actionsでバックグラウンド実行, #18）
// importTargetが指定されている画面はこちらを使う。ジョブIDをlocalStorageに
// 保持し、モーダルを閉じたり画面を離れても、再度開けば進捗表示を再開できる。
// ------------------------------------------------------------------
const currentJobId = ref(null);
const jobStatus    = ref(null); // "queued"|"running"|"completed"|"failed"|"cancelled"
let pollTimer = null;

const jobStorageKey = computed(() => `csvImportJob:${props.importTarget}`);

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(pollJobStatus, 2500);
}

async function pollJobStatus() {
  if (!currentJobId.value) return;
  let res;
  try {
    res = await getCsvImportJobStatus(currentJobId.value);
  } catch (e) {
    return; // 一時的な通信エラーは無視して次回ポーリングに任せる
  }
  if (res.status !== "success") return;

  const job = res.job;
  jobStatus.value     = job.status;
  importedCount.value = job.processed ?? 0;
  if (job.total != null) parseRows.value = new Array(job.total).fill(null);

  if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
    stopPolling();
    importing.value      = false;
    cancelRequested.value = false;
    localStorage.removeItem(jobStorageKey.value);

    if (job.status === "completed") {
      resultOk.value = job.errors.length === 0;
      const parts = [`更新${job.updated}件・新規${job.inserted}件`];
      if (job.errors.length > 0) parts.push(`エラー${job.errors.length}件:\n` + job.errors.join("\n"));
      resultMessage.value = `インポートが完了しました。（${parts.join(" / ")}）`;
      parseRows.value = [];
      emit("imported");
    } else if (job.status === "cancelled") {
      resultOk.value = false;
      resultMessage.value = `ユーザーの操作によりキャンセルしました（${job.processed}件まで完了）。`;
    } else {
      resultOk.value = false;
      resultMessage.value = `インポートに失敗しました（${job.processed}件まで完了）：${(job.errors || []).join(" / ")}`;
    }
  }
}

async function runJobImport() {
  const jobRes = await startCsvImportJob(props.importTarget, rawCsvText.value, format.value, importMode.value);
  if (jobRes.status !== "success") {
    throw new Error(jobRes.message || "ジョブの開始に失敗しました");
  }
  currentJobId.value = jobRes.jobId;
  jobStatus.value     = "queued";
  localStorage.setItem(jobStorageKey.value, jobRes.jobId);
  startPolling();
}

// 画面を離れて戻ってきた場合（コンポーネント再マウント）に、実行中のジョブが
// あればポーリングを自動再開する。
onMounted(() => {
  if (!props.importTarget) return;
  const savedJobId = localStorage.getItem(jobStorageKey.value);
  if (savedJobId) {
    currentJobId.value = savedJobId;
    importing.value    = true;
    startPolling();
  }
});

onBeforeUnmount(() => {
  stopPolling();
});

// Cloudflare Workers（Freeプラン）のCPU時間・サブリクエスト数・リクエスト
// サイズ等の制限は、いずれも即時解除（クールダウン無し）で次のリクエストは
// 通常通り実行できる。エラー発生時は下記4段階でバッチサイズを縮小しながら
// リトライし、成功後は縮小サイズのまま3000件投入できたら通常サイズへ復帰する。
// 回数の上限は設けず、ユーザーがキャンセルするまで無限にリトライし続ける
// （待機中もキャンセル可能）。
function retryTier(retryCount) {
  if (retryCount <= 5)  return { batchSize: props.batchSize,                           delayMs: 3000  };
  if (retryCount <= 10) return { batchSize: Math.max(1, Math.round(props.batchSize / 2)),  delayMs: 6000  };
  if (retryCount <= 15) return { batchSize: Math.max(1, Math.round(props.batchSize / 4)),  delayMs: 12000 };
  return                       { batchSize: Math.max(1, Math.round(props.batchSize / 10)), delayMs: 15000 };
}

function requestCancel() {
  cancelRequested.value = true;
  if (currentJobId.value) {
    cancelCsvImportJob(currentJobId.value).catch(() => {});
  }
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

/**
 * parseRows全体を、エラー時は段階的にバッチサイズを縮小しながら最後まで
 * 取り込む。呼び出しごとの結果をaggregateに積算し、importedCount/
 * retryMessageを更新する。
 */
async function importAllWithAdaptiveRetry(opts, aggregate) {
  let i = 0;
  let retryCount = 0;
  let recoveredCount = 0;

  while (i < parseRows.value.length) {
    if (cancelRequested.value) throw CANCELLED;

    const tier  = retryTier(retryCount);
    const batch = parseRows.value.slice(i, i + tier.batchSize);

    try {
      const res = await props.importBatch(batch, opts);
      retryMessage.value = "";
      aggregate.updated  += res.updated  ?? 0;
      aggregate.inserted += res.inserted ?? 0;
      if (res.errors)   aggregate.errors.push(...res.errors);
      if (res.warnings) aggregate.warnings.push(...res.warnings);

      i += batch.length;
      importedCount.value = Math.min(i, parseRows.value.length);

      if (retryCount > 0) {
        recoveredCount += batch.length;
        if (recoveredCount >= 3000) {
          retryCount     = 0;
          recoveredCount = 0;
        }
      }
    } catch (e) {
      if (cancelRequested.value) throw CANCELLED;
      retryCount++;
      recoveredCount = 0;
      const nextTier = retryTier(retryCount);
      retryMessage.value = `一時的なエラーのため${nextTier.delayMs / 1000}秒後に再試行します（${retryCount}回目、バッチサイズ${nextTier.batchSize}件、キャンセルするまで続けます）：${e.message}`;
      await sleepCancellable(nextTier.delayMs);
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
    rawCsvText.value = text;
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

  if (props.importTarget) {
    try {
      if (props.beforeImport) await props.beforeImport({ format: format.value, mode: importMode.value });
      await runJobImport();
      // 完了/失敗/キャンセルの表示はpollJobStatus側が行う（importing.valueもそちらで解除する）
    } catch (e) {
      console.error(e);
      resultOk.value      = false;
      resultMessage.value = `インポートの開始に失敗しました：${e.message}`;
      importing.value     = false;
    }
    return;
  }

  const aggregate = { updated: 0, inserted: 0, errors: [], warnings: [] };

  try {
    if (props.beforeImport) await props.beforeImport({ format: format.value, mode: importMode.value });

    await importAllWithAdaptiveRetry({ format: format.value, mode: importMode.value }, aggregate);

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
