<script setup lang="ts">
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'

const props = withDefaults(defineProps<{ k: string, title: string, active?: number, heading?: 'h4' | 'h5' }>(), { heading: 'h4' })
const { st, setFolded } = useStacks()
const { t } = useI18n()
const open = computed({
  get: () => !st.folded.has(props.k),
  set: v => setFolded(props.k, !v),
})
</script>

<template>
  <CollapsibleRoot v-model:open="open" as="section" class="fold-sec">
    <component :is="heading">
      <CollapsibleTrigger class="fold-h">
        <Icon name="chev" />{{ title }}<span v-if="!open && active" class="fold-n">{{ active }}<span class="sr-only"> {{ t('rail.activeFilters', { n: active }, active) }}</span></span>
        <span v-if="$slots.aside" class="fold-aside"><slot name="aside"></slot></span>
      </CollapsibleTrigger>
    </component>
    <CollapsibleContent class="fold-body">
      <slot></slot>
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
