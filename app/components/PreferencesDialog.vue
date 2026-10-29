<script setup lang="ts">
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle, RadioGroupItem, RadioGroupRoot, SwitchRoot, SwitchThumb, TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import type { SyncSettings } from '#shared/types/pr'
import type { IconName } from './Icon.vue'

const { st, every, toast, setSettings, setCi, setAutoS, setDensity, setHideDrafts } = useStacks()
const { ds, desktop, checkGh, setTheme, setNotify, setNotifyKind, setBadge, testNotification, setAppPref } = useDesktop()
const { t, locale, locales, setLocale } = useI18n()

const TABS: { k: PrefsTab, icon: IconName }[] = [
  { k: 'general', icon: 'system' },
  { k: 'repos', icon: 'repo' },
  { k: 'sync', icon: 'refresh' },
  { k: 'notifications', icon: 'bell' },
  { k: 'app', icon: 'app' },
  { k: 'github', icon: 'terminal' },
]
const tab = computed({ get: () => st.prefsTab, set: (v: string | number) => (st.prefsTab = v as PrefsTab) })
const isMac = computed(() => desktop()?.platform === 'darwin')

/* general */
const lang = computed({
  get: () => locale.value,
  set: (v: string) => {
    useStacks().ls.set('stacks-lang', v)
    setLocale(v as typeof locale.value).then(() => toast(t('options.langSet'), undefined, 'ok'))
  },
})
const theme = computed({ get: () => ds.theme, set: setTheme })
const DENSITIES = ['comfortable', 'compact', 'ultra'] as const
const density = computed({ get: () => st.density, set: (v: string) => setDensity(v as Density) })
const hideDrafts = computed({ get: () => st.hideDrafts, set: setHideDrafts })

/* sync */
const autoS = computed({ get: () => String(st.autoS), set: (v: string) => setAutoS(Number(v)) })
const ci = computed({ get: () => st.ci, set: setCi })

/* notifications */
const notify = computed({ get: () => ds.notify, set: setNotify })
const badge = computed({ get: () => ds.badge, set: setBadge })
const kindHint = (k: NotifyKind) => t(`prefs.kinds.${k}Hint`) + (k === 'ci' && !st.ci ? ` ${t('prefs.kinds.ciOff')}` : '')

/* app */
const closeToTray = computed({ get: () => ds.closeToTray, set: (v: boolean) => setAppPref({ closeToTray: v }) })
const openAtLogin = computed({ get: () => ds.openAtLogin, set: (v: boolean) => setAppPref({ openAtLogin: v }) })

/* repositories: edited as a draft, applied with Save */
const draft = reactive<SyncSettings>({ repos: [], approvals: 1, fresh: false })
const input = ref('')
const err = ref('')
watch(() => st.prefsOpen, (open) => {
  if (!open) return
  Object.assign(draft, { repos: [...st.settings?.repos ?? []], approvals: st.settings?.approvals ?? 1, fresh: st.settings?.fresh ?? false })
  input.value = ''
  err.value = ''
  if (st.prefsTab === 'github') checkGh()
})
watch(() => st.prefsTab, (v) => {
  if (v === 'github' && st.prefsOpen) checkGh()
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
  reset()
}
function reset() {
  Object.assign(draft, { repos: [...st.settings?.repos ?? []], approvals: st.settings?.approvals ?? 1, fresh: st.settings?.fresh ?? false })
}

const KEYS = [['refresh', 'R'], ['search', 'F'], ['prefs', ','], ['views', '1 2'], ['zoom', '+ - 0']] as const
const mod = computed(() => (isMac.value ? '⌘' : 'Ctrl'))

/* github */
const LOGIN_CMD = 'gh auth login'
async function copyLogin() {
  await navigator.clipboard.writeText(LOGIN_CMD)
  toast(t('gh.copied'), LOGIN_CMD, 'ok')
}
async function recheck() {
  const g = await checkGh()
  if (g?.state === 'ok') {
    toast(t('gh.ready', { login: g.login }), undefined, 'ok')
    if (st.loadError) useStacks().refresh()
  }
}
</script>

<template>
  <DialogRoot v-model:open="st.prefsOpen">
    <DialogPortal>
      <DialogOverlay class="modal-scrim" />
      <DialogContent class="modal prefs">
        <TabsRoot v-model="tab" orientation="vertical" class="prefs-body">
          <aside class="prefs-nav">
            <DialogTitle class="modal-t">{{ t('prefs.title') }}</DialogTitle>
            <DialogDescription class="sr-only">{{ t('prefs.tip') }}</DialogDescription>
            <TabsList class="prefs-tabs" :aria-label="t('prefs.title')">
              <TabsTrigger v-for="x in TABS" :key="x.k" :value="x.k" class="prefs-tab">
                <Icon :name="x.icon" />{{ t(`prefs.tabs.${x.k}`) }}
                <span v-if="x.k === 'github' && ds.gh && ds.gh.state !== 'ok'" class="prefs-warn"><span class="sr-only">{{ t(`gh.state.${ds.gh.state}`) }}</span></span>
              </TabsTrigger>
            </TabsList>
            <p v-if="ds.version" class="prefs-ver mono">PR Stacks {{ ds.version }}</p>
          </aside>

          <div class="prefs-pane">
            <DialogClose class="d-close prefs-x" :aria-label="t('toast.close')"><Icon name="x" /></DialogClose>

            <TabsContent value="general" class="prefs-panel">
              <h3>{{ t('prefs.tabs.general') }}</h3>
              <section class="modal-sec">
                <div class="field">
                  <span class="menu-t"><span>{{ t('options.lang') }}</span></span>
                  <SegToggle v-model="lang" :label="t('options.lang')" :options="locales.map(l => ({ value: l.code, label: l.name ?? l.code, tip: l.name ?? l.code }))" />
                </div>
                <div class="field">
                  <span class="menu-t"><span>{{ t('options.theme') }}</span></span>
                  <SegToggle v-model="theme" :label="t('options.theme')" :options="THEMES.map(th => ({ value: th, label: t(`options.themes.${th}`), icon: th, tip: t(`options.themes.${th}`) }))" />
                </div>
              </section>
              <section class="modal-sec">
                <h5>{{ t('options.display') }}</h5>
                <RadioGroupRoot v-model="density" class="choice-list" :aria-label="t('options.display')">
                  <RadioGroupItem v-for="d in DENSITIES" :key="d" :value="d" class="choice">
                    <span class="choice-dot"></span>
                    <span class="menu-t"><span>{{ t(`options.density.${d}`) }}</span><small>{{ t(`options.density.${d}Hint`) }}</small></span>
                  </RadioGroupItem>
                </RadioGroupRoot>
                <label class="field toggle">
                  <span class="menu-t"><span>{{ t('options.hideDrafts') }}</span><small>{{ t('options.hideDraftsHint') }}</small></span>
                  <SwitchRoot v-model="hideDrafts" class="switch" :aria-label="t('options.hideDrafts')"><SwitchThumb class="switch-thumb" /></SwitchRoot>
                </label>
              </section>
            </TabsContent>

            <TabsContent value="repos" class="prefs-panel">
              <h3>{{ t('settings.title') }}</h3>
              <p class="modal-sub">{{ t('settings.sub') }}</p>
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
                <button class="btn" :disabled="!dirty" @click="reset">{{ t('settings.cancel') }}</button>
                <button class="btn primary" :disabled="!dirty" @click="save">{{ t('settings.save') }}</button>
              </footer>
            </TabsContent>

            <TabsContent value="sync" class="prefs-panel">
              <h3>{{ t('prefs.tabs.sync') }}</h3>
              <section class="modal-sec">
                <div class="field">
                  <span class="menu-t"><span>{{ t('options.auto') }}</span><small>{{ t('prefs.autoHint') }}</small></span>
                  <SegToggle v-model="autoS" :label="t('options.auto')" :options="AUTO_CHOICES.map(s => ({ value: String(s), label: every(s), tip: every(s) }))" />
                </div>
                <label class="field toggle">
                  <span class="menu-t"><span>{{ t('options.ci') }}</span><small>{{ t('options.ciHint') }}</small></span>
                  <SwitchRoot v-model="ci" class="switch" :aria-label="t('options.ci')"><SwitchThumb class="switch-thumb" /></SwitchRoot>
                </label>
              </section>
            </TabsContent>

            <TabsContent value="notifications" class="prefs-panel">
              <h3>{{ t('prefs.tabs.notifications') }}</h3>
              <p class="modal-sub">{{ t('prefs.notifyIntro') }}</p>
              <section class="modal-sec">
                <label class="field toggle">
                  <span class="menu-t"><span>{{ t('prefs.notify') }}</span><small>{{ t('prefs.notifyHint') }}</small></span>
                  <SwitchRoot v-model="notify" class="switch" :aria-label="t('prefs.notify')"><SwitchThumb class="switch-thumb" /></SwitchRoot>
                </label>
              </section>
              <section v-for="(kinds, g) in NOTIFY_GROUPS" :key="g" class="modal-sec" :class="{ off: !ds.notify }">
                <h5>{{ t(`prefs.notifyGroups.${g}`) }}</h5>
                <p v-if="g === 'inbox'" class="hint">{{ t('prefs.inboxHint') }}</p>
                <label v-for="k in kinds" :key="k" class="field toggle">
                  <span class="menu-t"><span>{{ t(`prefs.kinds.${k}`) }}</span><small>{{ kindHint(k) }}</small></span>
                  <SwitchRoot :model-value="ds.notifyKinds.has(k)" class="switch" :disabled="!ds.notify" :aria-label="t(`prefs.kinds.${k}`)" @update:model-value="(v: boolean) => setNotifyKind(k, v)"><SwitchThumb class="switch-thumb" /></SwitchRoot>
                </label>
              </section>
              <section class="modal-sec">
                <label class="field toggle">
                  <span class="menu-t"><span>{{ t(isMac ? 'prefs.badgeMac' : 'prefs.badge') }}</span><small>{{ t('prefs.badgeHint') }}</small></span>
                  <SwitchRoot v-model="badge" class="switch" :aria-label="t(isMac ? 'prefs.badgeMac' : 'prefs.badge')"><SwitchThumb class="switch-thumb" /></SwitchRoot>
                </label>
              </section>
              <div>
                <button class="btn" :disabled="!ds.notify" @click="testNotification"><Icon name="bell" />{{ t('prefs.notifyTest') }}</button>
              </div>
            </TabsContent>

            <TabsContent value="app" class="prefs-panel">
              <h3>{{ t('prefs.tabs.app') }}</h3>
              <section class="modal-sec">
                <label class="field toggle">
                  <span class="menu-t"><span>{{ t(isMac ? 'prefs.trayMac' : 'prefs.tray') }}</span><small>{{ t(isMac ? 'prefs.trayMacHint' : ds.trayHost ? 'prefs.trayHint' : 'prefs.trayNoHost') }}</small></span>
                  <SwitchRoot v-model="closeToTray" class="switch" :disabled="isMac" :aria-label="t(isMac ? 'prefs.trayMac' : 'prefs.tray')"><SwitchThumb class="switch-thumb" /></SwitchRoot>
                </label>
                <label class="field toggle">
                  <span class="menu-t"><span>{{ t('prefs.login') }}</span><small>{{ t('prefs.loginHint') }}</small></span>
                  <SwitchRoot v-model="openAtLogin" class="switch" :aria-label="t('prefs.login')"><SwitchThumb class="switch-thumb" /></SwitchRoot>
                </label>
              </section>
              <section class="modal-sec">
                <h5>{{ t('prefs.shortcuts') }}</h5>
                <dl class="keys">
                  <template v-for="[k, keys] in KEYS" :key="k">
                    <dt>{{ t(`prefs.keys.${k}`) }}</dt>
                    <dd><kbd v-for="part in [mod, ...keys.split(' ')]" :key="part">{{ part }}</kbd></dd>
                  </template>
                </dl>
              </section>
            </TabsContent>

            <TabsContent value="github" class="prefs-panel">
              <h3>GitHub CLI</h3>
              <p class="modal-sub">{{ t('gh.intro') }}</p>
              <section class="gh-card" :data-s="ds.gh?.state ?? 'checking'" aria-live="polite">
                <span class="gh-dot big"></span>
                <div class="menu-t">
                  <b>{{ ds.gh ? t(`gh.state.${ds.gh.state}`) : t('gh.checking') }}</b>
                  <small v-if="ds.gh?.state === 'ok'">{{ t('gh.account', { login: ds.gh.login, host: ds.gh.host }) }}</small>
                  <small v-if="ds.gh?.version" class="mono">gh {{ ds.gh.version }}</small>
                </div>
                <button class="btn" :disabled="ds.ghChecking" @click="recheck"><Icon name="refresh" />{{ t('gh.recheck') }}</button>
              </section>
              <section v-if="ds.gh && ds.gh.state !== 'ok'" class="modal-sec">
                <h5>{{ t('gh.howTo') }}</h5>
                <ol class="steps">
                  <li :class="{ done: ds.gh.state !== 'missing' }">
                    <span class="menu-t"><span>{{ t('gh.step1') }}</span><small>{{ t('gh.step1Hint') }}</small></span>
                    <a class="btn" href="https://cli.github.com" target="_blank" rel="noopener"><Icon name="ext" />cli.github.com</a>
                  </li>
                  <li>
                    <span class="menu-t"><span>{{ t('gh.step2') }}</span><small>{{ t('gh.step2Hint') }}</small></span>
                    <button class="btn mono" @click="copyLogin"><Icon name="copy" />{{ LOGIN_CMD }}</button>
                  </li>
                  <li>
                    <span class="menu-t"><span>{{ t('gh.step3') }}</span><small>{{ t('gh.step3Hint') }}</small></span>
                  </li>
                </ol>
                <pre v-if="ds.gh.detail" class="gh-detail">{{ ds.gh.detail }}</pre>
              </section>
            </TabsContent>
          </div>
        </TabsRoot>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
