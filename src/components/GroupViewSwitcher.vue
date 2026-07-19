<template>
  <div class="btn-group btn-group-sm" role="group">
    <button
      type="button"
      class="btn"
      :class="current === GROUP_VIEWS.CHILD_LIST ? 'btn-primary' : 'btn-outline-primary'"
      @click="go(GROUP_VIEWS.CHILD_LIST)"
    >
      <i class="fas fa-th-list"></i> 一覧
    </button>
    <button
      type="button"
      class="btn"
      :class="current === GROUP_VIEWS.MINISTER_ASSIGN ? 'btn-primary' : 'btn-outline-primary'"
      @click="go(GROUP_VIEWS.MINISTER_ASSIGN)"
    >
      <i class="fas fa-user-friends"></i> 奉仕者
    </button>
    <button
      type="button"
      class="btn"
      :class="current === GROUP_VIEWS.GROUP_MAP ? 'btn-primary' : 'btn-outline-primary'"
      @click="go(GROUP_VIEWS.GROUP_MAP)"
    >
      <i class="fas fa-map-marked-alt"></i> 地図
    </button>
  </div>
</template>

<script setup>
import { useRouter } from "vue-router";
import { GROUP_VIEWS } from "@/services/groupViewPreference.js";

const props = defineProps({
  current: { type: String, required: true }, // GROUP_VIEWS のいずれか
});

const router = useRouter();

// 遷移先の記憶は各画面側のonMountedで行う（setLastGroupView）。ここではルート遷移のみ。
function go(routeName) {
  if (routeName === props.current) return;
  router.push({ name: routeName });
}
</script>
