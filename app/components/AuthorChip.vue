<script setup lang="ts">
const props = defineProps<{ login: string }>()
const { person, me } = useStacks()
const { t } = useI18n()
const p = computed(() => person(props.login))
const mine = computed(() => props.login === me.value)
</script>

<template>
  <Tip>
    <span class="author" :class="{ mine }">
      <span class="av" :class="{ img: p.avatar }" :style="{ '--h': p.h, 'backgroundImage': p.avatar ? `url('${p.avatar}')` : undefined }">{{ p.i }}</span>
      <span class="author-n">{{ mine ? t('card.you') : p.n }}</span>
    </span>
    <template #content>
      <i18n-t keypath="card.authorTip" scope="global"><template #name><b>{{ p.n }}</b></template></i18n-t>
      <template v-if="p.n !== p.login"> · {{ p.login }}</template>
    </template>
  </Tip>
</template>
