<script setup lang="ts">
const props = defineProps<{ labels: string[] }>()
const { label } = useStacks()
const box = ref<HTMLElement>()
const fit = ref(props.labels.length)
const MORE_W = 44

async function measure() {
  const el = box.value
  if (!el) return
  fit.value = props.labels.length
  await nextTick()
  const right = el.getBoundingClientRect().right
  const pills = [...el.querySelectorAll<HTMLElement>('.lbl')]
  if (!pills.length || pills.at(-1)!.getBoundingClientRect().right <= right) return
  fit.value = pills.filter(p => p.getBoundingClientRect().right <= right - MORE_W).length
}

let ro: ResizeObserver | undefined
onMounted(() => {
  measure()
  document.fonts?.ready.then(measure)
  ro = new ResizeObserver(() => measure())
  ro.observe(box.value!)
})
onBeforeUnmount(() => ro?.disconnect())
watch(() => props.labels.join('\0'), measure)
</script>

<template>
  <div ref="box" class="labels" :class="{ cut: fit < labels.length }">
    <LabelPill v-for="l in labels.slice(0, fit)" :key="l" :name="l" />
    <Tip v-if="fit < labels.length">
      <span class="lbl-more">+{{ labels.length - fit }}</span>
      <template #content>
        <div v-for="l in labels" :key="l" class="tip-lbl"><i class="ld" :style="{ background: label(l).c }"></i>{{ l }}</div>
      </template>
    </Tip>
  </div>
</template>
