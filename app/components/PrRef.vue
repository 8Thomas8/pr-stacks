<script setup lang="ts">
import type { PullRequest } from '#shared/types/pr'

const props = defineProps<{ pr: PullRequest }>()
const { t } = useI18n()
const { prInbox, inboxText } = useDesktop()
const unread = computed(() => prInbox(props.pr))
const bell = computed(() => `${t('drawer.ghUnread', { n: unread.value.length }, unread.value.length)} ${unread.value.map(inboxText).join(' · ')}`)
</script>

<template>
  <span class="c-ref"><RepoLink :repo="pr.repo" /><PrLink :pr="pr"><b>#{{ pr.num }}</b></PrLink><Tip v-if="unread.length" :text="bell"><span class="gh-bell" role="img" :aria-label="bell"><Icon name="bell" /></span></Tip></span>
</template>
