<script setup lang="ts">
const props = defineProps<{ body: string }>()
const { t } = useI18n()
const parts = computed(() => preview(props.body))
</script>

<template>
  <Tip v-if="parts.length" :text="t('card.descTip')">
    <div class="c-desc"><template v-for="(x, i) in parts" :key="i"><a v-if="x.href" class="lnk" :href="x.href" target="_blank" rel="noopener" @click.stop>{{ x.t }}</a><template v-else>{{ x.t }}</template></template></div>
  </Tip>
  <div v-else class="c-desc none">{{ t('card.noDesc') }}</div>
</template>
