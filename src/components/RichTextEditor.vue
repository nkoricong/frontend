<template>
  <div class="richtext-editor">
    <div class="richtext-toolbar">
      <button type="button" class="rt-btn" title="太字" @mousedown.prevent="exec('bold')">
        <i class="fas fa-bold"></i>
      </button>
      <button type="button" class="rt-btn" title="下線" @mousedown.prevent="exec('underline')">
        <i class="fas fa-underline"></i>
      </button>
      <label class="rt-btn rt-color" title="文字色">
        <i class="fas fa-palette"></i>
        <input type="color" @mousedown.stop @input="onColor" />
      </label>
      <button type="button" class="rt-btn" title="リンク" @mousedown.prevent="insertLink">
        <i class="fas fa-link"></i>
      </button>
      <button type="button" class="rt-btn" title="リンク解除" @mousedown.prevent="exec('unlink')">
        <i class="fas fa-unlink"></i>
      </button>
    </div>
    <div
      ref="editorEl"
      class="richtext-body form-control"
      contenteditable="true"
      @input="onInput"
      @blur="onInput"
    ></div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from "vue";

const props = defineProps({
  modelValue: { type: String, default: "" },
});
const emit = defineEmits(["update:modelValue"]);

const editorEl = ref(null);

function exec(cmd, value = null) {
  editorEl.value?.focus();
  // styleWithCSS を有効にしないと、foreColorが<span style>ではなく<font color>を
  // 生成してしまい、表示側のサニタイズ許可タグ（span/style）と噛み合わなくなる
  document.execCommand("styleWithCSS", false, true);
  document.execCommand(cmd, false, value);
  onInput();
}

function onColor(e) {
  exec("foreColor", e.target.value);
}

function insertLink() {
  const url = prompt("リンク先のURLを入力してください（https:// から始まるURL）");
  if (!url) return;
  if (!/^https:\/\//i.test(url)) {
    alert("https:// から始まるURLを入力してください");
    return;
  }
  exec("createLink", url);
}

function onInput() {
  emit("update:modelValue", editorEl.value?.innerHTML ?? "");
}

// 初期表示のみ反映する（以降はcontenteditable自身がDOMを管理するため、
// modelValueの変化に追従してinnerHTMLを書き換えるとカーソル位置が壊れる）
onMounted(() => {
  if (editorEl.value) editorEl.value.innerHTML = props.modelValue || "";
});

// フォーム側でmodelValueをリセットした場合（例：編集対象の切替）に追従する
watch(() => props.modelValue, (v) => {
  if (editorEl.value && document.activeElement !== editorEl.value && editorEl.value.innerHTML !== v) {
    editorEl.value.innerHTML = v || "";
  }
});
</script>

<style scoped>
.richtext-editor {
  border: 1px solid #d1d5db;
  border-radius: 6px;
  overflow: hidden;
}

.richtext-toolbar {
  display: flex;
  gap: 4px;
  padding: 6px;
  background: #f4f6fb;
  border-bottom: 1px solid #d1d5db;
}

.rt-btn {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  padding: 0;
  margin: 0;
}

.rt-color {
  position: relative;
  overflow: hidden;
}

.rt-color input[type="color"] {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.richtext-body {
  min-height: 160px;
  max-height: 400px;
  overflow-y: auto;
  padding: 10px;
  border: 0;
  border-radius: 0;
}

.richtext-body:focus {
  outline: none;
  box-shadow: none;
}
</style>
