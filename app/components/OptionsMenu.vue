<script setup lang="ts">
import {
  DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuItemIndicator, DropdownMenuLabel, DropdownMenuPortal,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuRoot, DropdownMenuSeparator, DropdownMenuTrigger,
} from 'reka-ui'

const { st, ls, every, toast, setCi, setAutoS, setDensity } = useStacks()
const { t, locale, locales, setLocale } = useI18n()

const THEMES = ['system', 'light', 'dark'] as const
type Theme = typeof THEMES[number]
const saved = ls.get('stacks-theme') as Theme
const theme = ref<Theme>(THEMES.includes(saved) ? saved : 'system')
watchEffect(() => {
  if (theme.value === 'system') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', theme.value)
})
function setTheme(v: unknown) {
  theme.value = v as Theme
  toast(t('options.themeSet', { name: t(`options.themes.${v}`) }), undefined, 'ok')
  ls.set('stacks-theme', String(v))
}
const lang = computed({
  get: () => locale.value,
  set: v => setLocale(v as typeof locale.value).then(() => toast(t('options.langSet'), undefined, 'ok')),
})
const ci = computed({ get: () => st.ci, set: setCi })
const DENSITIES = ['comfortable', 'compact', 'ultra'] as const
const density = computed({ get: () => st.density, set: (v: string) => setDensity(v as Density) })
const autoS = computed({ get: () => String(st.autoS), set: (v: string) => setAutoS(Number(v)) })
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger class="theme-btn" :aria-label="t('options.title')" :title="t('options.tip')"><Icon name="options" /></DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent class="menu" align="end" :side-offset="6" :collision-padding="8">
        <DropdownMenuItem class="menu-i" @select="st.settingsOpen = true">
          <span class="menu-ind"><Icon name="graph" /></span>
          <span class="menu-t"><span>{{ t('options.settings') }}</span><small>{{ t('options.settingsHint', { n: st.settings?.repos.length ?? 0 }, st.settings?.repos.length ?? 0) }}</small></span>
        </DropdownMenuItem>
        <DropdownMenuSeparator class="menu-sep" />
        <DropdownMenuLabel class="menu-l">{{ t('options.lang') }}</DropdownMenuLabel>
        <DropdownMenuRadioGroup v-model="lang">
          <DropdownMenuRadioItem v-for="l in locales" :key="l.code" class="menu-i" :value="l.code">
            <span class="menu-ind"><DropdownMenuItemIndicator><Icon name="check" /></DropdownMenuItemIndicator></span>{{ l.name }}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator class="menu-sep" />
        <DropdownMenuLabel class="menu-l">{{ t('options.theme') }}</DropdownMenuLabel>
        <DropdownMenuRadioGroup :model-value="theme" @update:model-value="setTheme">
          <DropdownMenuRadioItem v-for="th in THEMES" :key="th" class="menu-i" :value="th">
            <span class="menu-ind"><DropdownMenuItemIndicator><Icon name="check" /></DropdownMenuItemIndicator></span>
            <Icon :name="th" />{{ t(`options.themes.${th}`) }}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator class="menu-sep" />
        <DropdownMenuLabel class="menu-l">{{ t('options.display') }}</DropdownMenuLabel>
        <DropdownMenuRadioGroup v-model="density">
          <DropdownMenuRadioItem v-for="d in DENSITIES" :key="d" class="menu-i" :value="d" @select.prevent>
            <span class="menu-ind"><DropdownMenuItemIndicator><Icon name="check" /></DropdownMenuItemIndicator></span>
            <span class="menu-t"><span>{{ t(`options.density.${d}`) }}</span><small>{{ t(`options.density.${d}Hint`) }}</small></span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator class="menu-sep" />
        <DropdownMenuLabel class="menu-l">{{ t('options.auto') }}</DropdownMenuLabel>
        <DropdownMenuRadioGroup v-model="autoS">
          <DropdownMenuRadioItem v-for="s in AUTO_CHOICES" :key="s" class="menu-i" :value="String(s)" @select.prevent>
            <span class="menu-ind"><DropdownMenuItemIndicator><Icon name="check" /></DropdownMenuItemIndicator></span>{{ every(s) }}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator class="menu-sep" />
        <DropdownMenuLabel class="menu-l">{{ t('options.data') }}</DropdownMenuLabel>
        <DropdownMenuCheckboxItem v-model="ci" class="menu-i" @select.prevent>
          <span class="menu-ind"><DropdownMenuItemIndicator><Icon name="check" /></DropdownMenuItemIndicator></span>
          <span class="menu-t"><span>{{ t('options.ci') }}</span><small>{{ t('options.ciHint') }}</small></span>
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
