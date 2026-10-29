<script setup lang="ts">
import type { Band } from '~/utils/stacks'

const props = defineProps<{ band: Band }>()
const { st, pulseClass, blocking, matches } = useStacks()
const steps = computed(() => (props.band.kind === 'stack' ? levels(props.band) : [props.band.items]).map(l => l.filter(matches)).filter(l => l.length))
const { t } = useI18n()
</script>

<template>
  <div class="mini">
    <template v-for="(p, i) in steps.flat()" :key="p.id">
      <span v-if="band.kind === 'stack' && i" class="mini-sep">{{ steps.some(l => l[0] === p) ? '→' : '·' }}</span>
      <Tip>
        <button class="mchip" :class="[{ 'conflict': blocking(p), 'draft': p.draft, 'draft-conflict': p.draft && p.conflict }, pulseClass(p)]" @click.stop="st.sel = p.id">
          <i :style="{ background: STATUS_COLOR[p.status] }"></i>#{{ p.num }}<span>{{ t(`status.${p.status}.l`) }}</span>
        </button>
        <template #content><b>{{ p.id }}</b> · {{ t(`status.${p.status}.l`) }}<br />{{ p.title }}<br />{{ t('band.details') }}</template>
      </Tip>
    </template>
  </div>
</template>
