<script setup lang="ts">
import { PopoverAnchor, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'

const { center, unread, bell, openNotice, openInbox, readThread, readRepos, tracked, readAllNotices, clearNotices, noticeText, inboxRef, inboxText } = useDesktop()
const { st } = useStacks()
const { t, rel } = useFmt()

const open = ref(false)
const tab = ref<'activity' | 'github'>('activity')
const label = computed(() => (bell.value ? t('center.unread', { n: bell.value }, bell.value) : t('center.title')))
// a click opens the PR (in the drawer or on GitHub): the popover gets out of the way
function go(fn: () => void) {
  open.value = false
  fn()
}
// the popover takes the focus itself (not its first tab, whose tooltip would pop), so Tab walks into it
function onOpen(e: Event) {
  e.preventDefault()
  // the event comes from reka's wrapper around the content
  const el = e.target as HTMLElement | null
  const nc = el?.matches('.nc') ? el : el?.querySelector<HTMLElement>('.nc')
  nc?.focus({ preventScroll: true })
}
// ✓ removes its row: the focus moves to the next row first, so the keyboard stays in the list
function read(id: string, e: Event) {
  const row = (e.currentTarget as HTMLElement).closest('li')
  const next = row?.nextElementSibling ?? row?.previousElementSibling
  ;(next?.querySelector<HTMLElement>('.nc-item') ?? row?.closest<HTMLElement>('.nc'))?.focus()
  readThread(id)
}
// a click on the title bar (a drag region) or another app reaches no outside-click handler
const close = () => {
  open.value = false
}
onMounted(() => window.addEventListener('blur', close))
onBeforeUnmount(() => window.removeEventListener('blur', close))
</script>

<template>
  <PopoverRoot v-model:open="open">
    <!-- the tooltip wraps the trigger, so the popover is placed from its own anchor -->
    <PopoverAnchor class="nc-anchor">
      <Tip :text="t('center.tip')" side="bottom">
        <PopoverTrigger as-child>
          <button class="theme-btn nc-btn" :aria-label="label">
            <Icon name="bell" />
            <span v-if="bell" class="nc-count">{{ bell > 99 ? '99+' : bell }}</span>
          </button>
        </PopoverTrigger>
      </Tip>
    </PopoverAnchor>
    <PopoverPortal>
      <PopoverContent class="nc" tabindex="-1" side="bottom" align="end" :side-offset="8" :collision-padding="12" @open-auto-focus="onOpen">
        <div class="nc-h">
          <h3 class="nc-t">{{ t('center.title') }}</h3>
          <SegToggle
            v-model="tab"
            :label="t('center.title')"
            :options="[
              { value: 'activity', label: unread ? t('center.activityN', { n: unread }) : t('center.activity'), tip: t('center.activityTip') },
              { value: 'github', label: center.inbox.length ? t('center.githubN', { n: center.inbox.length }) : t('center.github'), tip: t('center.githubTip') },
            ]"
          />
        </div>

        <template v-if="tab === 'activity'">
          <ul v-if="center.notices.length" class="nc-list">
            <li v-for="n in center.notices" :key="n.id">
              <button class="nc-item" :class="{ unread: !n.read }" @click="go(() => openNotice(n))">
                <span class="nc-dot" aria-hidden="true"></span>
                <span v-if="!n.read" class="sr-only">{{ t('center.unreadSr') }}</span>
                <span class="nc-top"><span class="mono">{{ n.ref }}</span><span class="nc-at">{{ rel(n.at, st.now) }}</span></span>
                <span class="nc-title" :title="n.title">{{ n.title }}</span>
                <span class="nc-body">{{ noticeText(n) }}</span>
              </button>
            </li>
          </ul>
          <p v-else class="nc-empty">{{ t('center.empty') }}</p>
          <div v-if="center.notices.length" class="nc-f">
            <button class="btn" :disabled="!unread" @click="readAllNotices"><Icon name="check" />{{ t('center.readAll') }}</button>
            <button class="btn" @click="clearNotices"><Icon name="x" />{{ t('center.clear') }}</button>
          </div>
        </template>

        <template v-else>
          <ul v-if="center.inbox.length" class="nc-list">
            <li v-for="i in center.inbox" :key="i.id" class="nc-row">
              <button class="nc-item unread" @click="go(() => openInbox(i))">
                <span class="nc-dot" aria-hidden="true"></span>
                <span class="nc-top"><span class="mono">{{ inboxRef(i) }}</span><span class="nc-at">{{ rel(i.updatedAt, st.now) }}</span></span>
                <span class="nc-title" :title="i.title">{{ i.title }}</span>
                <span class="nc-body">{{ inboxText(i) }}</span>
              </button>
              <Tip :text="t('center.markRead')">
                <button class="nc-read" :aria-label="t('center.markRead')" @click="read(i.id, $event)"><Icon name="check" /></button>
              </Tip>
            </li>
          </ul>
          <p v-else class="nc-empty">{{ center.inboxError ? t('center.ghError') : center.inboxLoaded ? t('center.emptyGh') : t('toolbar.loading') }}</p>
          <div class="nc-f">
            <button class="btn" :disabled="!center.inbox.some(i => tracked(i.slug))" @click="readRepos"><Icon name="check" />{{ t('center.readRepos') }}</button>
            <a class="btn" href="https://github.com/notifications" target="_blank" rel="noopener"><Icon name="ext" />{{ t('center.openGh') }}</a>
          </div>
        </template>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
