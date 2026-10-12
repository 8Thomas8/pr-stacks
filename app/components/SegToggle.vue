<script setup lang="ts" generic="T extends string">
import { ToggleGroupItem, ToggleGroupRoot } from 'reka-ui'
import type { IconName } from './Icon.vue'

defineProps<{ options: { value: T, label: string, tip: string, icon?: IconName }[], label: string }>()
const model = defineModel<T>({ required: true })
const root = ref<InstanceType<typeof ToggleGroupRoot>>()
const thumb = reactive({ left: 0, width: 0 })

function place() {
  const el = root.value?.$el as HTMLElement | undefined
  const on = el?.querySelector<HTMLElement>('[data-state="on"]')
  if (on) {
    thumb.left = on.offsetLeft
    thumb.width = on.offsetWidth
  }
}
watch(model, () => nextTick(place))
onMounted(() => {
  nextTick(place)
  document.fonts?.ready.then(place)
  window.addEventListener('resize', place)
})
onBeforeUnmount(() => window.removeEventListener('resize', place))
const onUpdate = (v: unknown) => {
  if (typeof v === 'string' && v) model.value = v as T
}
</script>

<template>
  <ToggleGroupRoot ref="root" type="single" class="seg" :model-value="model" :aria-label="label" @update:model-value="onUpdate">
    <span class="thumb" :style="{ left: `${thumb.left}px`, width: `${thumb.width}px` }"></span>
    <Tip v-for="o in options" :key="o.value" :text="o.tip">
      <ToggleGroupItem :value="o.value"><Icon v-if="o.icon" :name="o.icon" />{{ o.label }}</ToggleGroupItem>
    </Tip>
  </ToggleGroupRoot>
</template>
