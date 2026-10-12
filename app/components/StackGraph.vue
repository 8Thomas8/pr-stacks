<script setup lang="ts">
const { st, visibleBands } = useStacks()
</script>

<template>
  <div v-if="visibleBands.length" class="stacks" :class="{ intro: st.intro }">
    <StackBand v-for="(b, i) in visibleBands" :key="b.key" :band="b" :index="i" />
  </div>
  <ViewStatus v-else />
</template>
