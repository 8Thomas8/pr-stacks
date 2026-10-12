<script setup lang="ts">
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle, SwitchRoot, SwitchThumb } from 'reka-ui'
import type { SyncSettings } from '#shared/types/pr'

const { st, setSettings } = useStacks()
const { t } = useI18n()

const draft = reactive<SyncSettings>({ repos: [], approvals: 1, fresh: false })
const input = ref('')
const err = ref('')
watch(() => st.settingsOpen, (open) => {
  if (!open) return
  Object.assign(draft, { repos: [...st.settings?.repos ?? []], approvals: st.settings?.approvals ?? 1, fresh: st.settings?.fresh ?? false })
  input.value = ''
  err.value = ''
})
const dirty = computed(() => JSON.stringify(draft) !== JSON.stringify(st.settings ?? { repos: [], approvals: 1, fresh: false }))

function add() {
  const raw = input.value.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/, '')
  const slug = raw.split(/[/?#]/).slice(0, 2).join('/')
  if (!/^[\w.-]{1,100}\/[\w.-]{1,100}$/.test(slug)) {
    err.value = t('settings.badRepo')
    return
  }
  if (draft.repos.some(r => r.toLowerCase() === slug.toLowerCase())) {
    err.value = t('settings.dupRepo')
    return
  }
  draft.repos.push(slug)
  input.value = ''
  err.value = ''
}
function save() {
  setSettings({ repos: [...draft.repos], approvals: Math.min(10, Math.max(1, Math.round(draft.approvals) || 1)), fresh: draft.fresh })
  st.settingsOpen = false
}
</script>

<template>
  <DialogRoot v-model:open="st.settingsOpen">
    <DialogPortal>
      <DialogOverlay class="modal-scrim" />
      <DialogContent class="modal">
        <header class="modal-h">
          <DialogTitle class="modal-t">{{ t('settings.title') }}</DialogTitle>
          <DialogClose class="d-close" :aria-label="t('toast.close')"><Icon name="x" /></DialogClose>
        </header>
        <DialogDescription class="modal-sub">{{ t('settings.sub') }}</DialogDescription>

        <section class="modal-sec">
          <h5>{{ t('settings.repos') }}</h5>
          <ul v-if="draft.repos.length" class="repo-list">
            <li v-for="(r, i) in draft.repos" :key="r">
              <code>{{ r }}</code>
              <button class="repo-x" :aria-label="t('settings.remove', { repo: r })" @click="draft.repos.splice(i, 1)"><Icon name="x" /></button>
            </li>
          </ul>
          <p v-else class="hint">{{ t('settings.noRepos') }}</p>
          <form class="repo-add" @submit.prevent="add">
            <input v-model="input" class="field-in" :placeholder="t('settings.repoPlaceholder')" :aria-label="t('settings.repoPlaceholder')" />
            <button class="btn" type="submit">{{ t('settings.add') }}</button>
          </form>
          <p v-if="err" class="field-err" role="alert">{{ err }}</p>
        </section>

        <section class="modal-sec">
          <h5>{{ t('settings.rules') }}</h5>
          <label class="field">
            <span class="menu-t"><span>{{ t('settings.approvals') }}</span><small>{{ t('settings.approvalsHint') }}</small></span>
            <input v-model.number="draft.approvals" class="field-in num" type="number" min="1" max="10" />
          </label>
          <label class="field toggle" :class="{ on: draft.fresh }">
            <span class="menu-t"><span>{{ t('settings.fresh') }}</span><small>{{ t('settings.freshHint') }}</small></span>
            <SwitchRoot v-model="draft.fresh" class="switch" :aria-label="t('settings.fresh')"><SwitchThumb class="switch-thumb" /></SwitchRoot>
          </label>
        </section>

        <footer class="modal-f">
          <DialogClose class="btn">{{ t('settings.cancel') }}</DialogClose>
          <button class="btn primary" :disabled="!dirty" @click="save">{{ t('settings.save') }}</button>
        </footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
