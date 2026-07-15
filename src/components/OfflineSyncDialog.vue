<template>
  <div
    class="modal fade"
    :class="{ show: modelValue }"
    :style="modelValue ? 'display:block' : 'display:none'"
    tabindex="-1"
    role="dialog"
    @click.self="close"
  >
    <div class="modal-dialog modal-dialog-scrollable" role="document">
      <div class="modal-content">

        <div class="modal-header">
          <h5 class="modal-title">オフライン中の子カード</h5>
          <button type="button" class="btn-close" @click="close"></button>
        </div>

        <div class="modal-body">
          <p class="small text-muted mb-2">
            {{ childLabel }}
            ／ 未同期の訪問結果：{{ pendingVisits.length }}件
          </p>

          <div v-if="pendingVisits.length > 0" class="pending-list mb-2">
            <div v-for="p in pendingVisits" :key="p._localId" class="pending-item">
              <span class="badge bg-secondary me-1">住戸#{{ p.HousingNo }}</span>
              <span class="badge bg-light text-dark me-1">{{ p.VisitDate }}</span>
              <strong class="me-1">{{ p.Result }}</strong>
              <span v-if="p.Minister" class="small text-muted">（{{ p.Minister }}）</span>
            </div>
          </div>
          <p v-else class="text-muted small">同期待ちの訪問結果はありません</p>

          <p v-if="!online" class="small text-danger mt-2">
            <i class="fas fa-wifi"></i> ネット接続が無いため、同期・解除は行えません
          </p>
          <p v-if="message" class="small mt-2" :class="isError ? 'text-danger' : 'text-success'">{{ message }}</p>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="close">閉じる</button>
          <button class="btn btn-outline-primary" @click="handleSync" :disabled="!online || busy">
            <i class="fas fa-sync-alt"></i> {{ busy === 'sync' ? '同期中...' : '同期' }}
          </button>
          <button class="btn btn-outline-danger" @click="handleRelease" :disabled="!online || busy">
            {{ busy === 'release' ? '処理中...' : 'オフラインモードの解除' }}
          </button>
        </div>

      </div>
    </div>
  </div>
  <div v-if="modelValue" class="modal-backdrop fade show"></div>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import {
  useOnlineStatus, getPendingVisits, syncPendingVisits, removeOfflineChild,
} from "@/services/offline.js";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  childId:    { type: [String, Number], default: null },
  cardNo:     { type: [String, Number], default: null },
  childNo:    { type: [String, Number], default: null },
  childBlock: { type: String, default: "" },
});

const emit = defineEmits(["update:modelValue", "released", "synced"]);

const online   = useOnlineStatus();
const busy     = ref(false); // false | 'sync' | 'release'
const message  = ref("");
const isError  = ref(false);

const pendingVisits = ref([]);

const childLabel = computed(() => `${props.cardNo}-${props.childNo} ${props.childBlock}`);

watch(() => props.modelValue, (v) => {
  if (v) {
    pendingVisits.value = getPendingVisits(props.childId);
    message.value = "";
    isError.value = false;
  }
});

function close() {
  if (busy.value) return;
  emit("update:modelValue", false);
}

async function handleSync() {
  busy.value    = "sync";
  message.value = "";
  try {
    const res = await syncPendingVisits(props.childId);
    pendingVisits.value = getPendingVisits(props.childId);
    if (res.remaining > 0) {
      message.value = `${res.synced}件同期しました（${res.remaining}件は失敗したため残っています）`;
      isError.value = true;
    } else {
      message.value = res.synced > 0 ? `${res.synced}件同期しました` : "同期対象はありませんでした";
      isError.value = false;
    }
    emit("synced");
  } catch (e) {
    message.value = e.message;
    isError.value = true;
  } finally {
    busy.value = false;
  }
}

async function handleRelease() {
  if (!confirm("同期のうえ、この子カードのオフラインモードを解除します。よろしいですか？")) return;
  busy.value    = "release";
  message.value = "";
  try {
    const res = await syncPendingVisits(props.childId);
    if (res.remaining > 0) {
      message.value = `未同期の記録が${res.remaining}件残っているため解除できません。再度「同期」をお試しください。`;
      isError.value = true;
      pendingVisits.value = getPendingVisits(props.childId);
      return;
    }
    removeOfflineChild(props.childId);
    emit("released", props.childId);
    emit("update:modelValue", false);
  } catch (e) {
    message.value = e.message;
    isError.value = true;
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.pending-list {
  max-height: 240px;
  overflow-y: auto;
}

.pending-item {
  padding: 4px 0;
  border-bottom: 1px solid #eee;
}
</style>
