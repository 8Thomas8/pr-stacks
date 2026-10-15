<script setup lang="ts">
import type { PullRequest } from '#shared/types/pr'
import type { Band } from '~/utils/stacks'

const { st, visibleBands, forest, matches, pulseClass, submitted, person, setCollapsed, showCi, blocking } = useStacks()
const { t, rel } = useFmt()

function rows(b: Band) {
  const out: { p: PullRequest, tree: string, step?: number }[] = []
  if (b.kind === 'stack') {
    const walk = (list: PullRequest[], depth: number, prefix: string) => list.forEach((c, idx) => {
      const last = idx === list.length - 1
      out.push({ p: c, tree: depth ? prefix + (last ? '└ ' : '├ ') : '', step: depth + 1 })
      walk(forest.value.kids(c.id), depth + 1, depth ? prefix + (last ? '  ' : '│ ') : '')
    })
    walk(b.tops, 0, '')
  }
  else b.items.forEach(p => out.push({ p, tree: '' }))
  return out.filter(r => matches(r.p))
}
const fresh = (p: PullRequest) => submitted(p).filter(x => x.after === 0)
const stale = (p: PullRequest) => submitted(p).filter(x => x.after > 0)
const names = (logins: string[]) => logins.map(l => person(l).n).join(', ')
function toggle(b: Band, e: MouseEvent) {
  if ((e.target as HTMLElement).closest('a, .mchip')) return
  setCollapsed(b.key, !st.collapsed.has(b.key))
}
</script>

<template>
  <div v-if="visibleBands.length" class="list-wrap">
    <table class="list">
      <thead>
        <tr>
          <th class="col-pr">{{ t('list.pr') }}</th><th class="col-st">{{ t('list.status') }}</th><th class="col-lbl">{{ t('list.labels') }}</th><th class="col-desc">{{ t('list.desc') }}</th><th class="col-au">{{ t('list.author') }}</th><th class="col-rev">{{ t('list.reviews') }}</th>
          <Tip :text="t('list.sinceTip')"><th class="col-since">{{ t('list.since') }}</th></Tip>
          <Tip :text="t('list.commentsTip')"><th class="col-com">{{ t('list.comments') }}<span class="sr-only"> ({{ t('list.commentsTip') }})</span></th></Tip>
          <th class="col-num">{{ showCi ? t('list.ci') : t('list.updated') }}</th>
        </tr>
      </thead>
      <tbody v-for="b in visibleBands" :key="b.key" :class="{ collapsed: st.collapsed.has(b.key) }">
        <tr class="grp" data-fold-area @click="toggle(b, $event)">
          <td colspan="9">
            <div class="grp-row">
              <FoldButton :open="!st.collapsed.has(b.key)" />
              <BandBadges :band="b" />
              <span class="grp-mini"><MiniChips :band="b" /></span>
            </div>
          </td>
        </tr>
        <tr
          v-for="{ p, tree, step } in rows(b)"
          :key="p.id"
          class="row"
          :class="[{ 'conflict': blocking(p), 'draft': p.draft, 'draft-conflict': p.draft && p.conflict, 'flash': st.changed.has(p.id) }, pulseClass(p)]"
          @click="st.sel = p.id"
        >
          <td>
            <div class="l-pr">
              <span v-if="tree" class="tree">{{ tree }}</span>
              <Tip v-if="step" :text="step === 1 ? t('list.step1') : t('list.stepN', { n: step })"><span class="lstep">{{ step }}</span></Tip>
              <div class="t"><b :title="p.title">{{ p.title }}</b><span><RepoLink :repo="p.repo" /><PrLink :pr="p" /> · {{ p.head }}</span></div>
            </div>
          </td>
          <td><div class="l-st"><StatusPill :status="p.status" style="margin:0" /><ForMeTag :pr="p" /></div></td>
          <td><div class="labels"><LabelPill v-for="l in p.labels" :key="l" :name="l" /></div></td>
          <td class="l-desc col-desc"><PrDesc :body="p.body" /></td>
          <td><UserAvatar :login="p.author" /></td>
          <td><div class="revs"><ReviewChip v-for="r in p.reviews" :key="r.by" :review="r" /></div></td>
          <td class="since">
            <span v-if="fresh(p).length" class="ok">{{ names(fresh(p).map(x => x.by)) }}</span>
            <span v-else style="color:var(--faint)">—</span>
            <template v-if="stale(p).length"> · <span class="warn">{{ t('list.redo', { names: names(stale(p).map(x => x.by)) }) }}</span></template>
          </td>
          <td>
            <Tip :text="t('list.unresolvedTip')"><span class="num" :class="p.threads.length ? 'bad' : 'z'">{{ p.threads.length }}</span></Tip>
            {{ ' ' }}<Tip :text="t('list.totalTip')"><span class="num z">/ {{ p.comments }}</span></Tip>
          </td>
          <td>
            <Tip v-if="showCi" :text="t(`ci.tip.${p.ci}`)"><span class="num z"><i class="ci" :class="p.ci"></i> {{ rel(p.updatedAt, st.now) }}</span></Tip>
            <span v-else class="num z">{{ rel(p.updatedAt, st.now) }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <ViewStatus v-else />
</template>
