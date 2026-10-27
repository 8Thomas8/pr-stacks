<script setup lang="ts">
const props = defineProps<{ body: string }>()
const { t } = useI18n()
const empty = computed(() => !preview(props.body).length)
</script>

<template>
  <Tip v-if="!empty" :text="t('card.descTip')">
    <PrBody class="c-desc" :body="body" bare @click="($event.target as HTMLElement).closest('a') && $event.stopPropagation()" />
  </Tip>
  <div v-else class="c-desc none">{{ t('card.noDesc') }}</div>
</template>
