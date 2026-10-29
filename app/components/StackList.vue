<script setup lang="ts">
import type { PullRequest } from '#shared/types/pr'
import type { Band, Rel } from '~/utils/stacks'

const { st, lean, visibleBands, forest, matches, visible, between, pulseClass, hoverSeen, submitted, person, setCollapsed, blocking, rels } = useStacks()
const { t, fmtFull, since, stepTip } = useFmt()
const notes = (rs: Rel[]) => (rs.filter(r => r.k === 'link').length > 1 ? rs.filter(r => r.k !== 'link') : rs)

function rows(b: Band) {
  const out: { p: PullRequest, step?: number, depth: number, parent?: PullRequest, hid: PullRequest[], pipes: number[], last: boolean, hasKids: boolean }[] = []
  if (b.kind === 'stack') {
    const walk = (list: PullRequest[], depth: number, prefix: boolean[], from?: PullRequest) => {
      const hids = list.map(c => (from ? between(c, from.id) : []))
      list.forEach((c, idx) => {
        const last = idx === list.length - 1
        const kids = visible(forest.value.kids(c.id))
        const parent = forest.value.parentOf(c)
        const hid = hids[idx]!.filter(q => hids.findIndex(h => h.includes(q)) === idx)
        out.push({ p: c, step: (b.depth[c.id] ?? 0) + 1, depth, parent: parent && b.depth[parent.id] !== undefined ? parent : undefined, hid, pipes: prefix.flatMap((on, k) => (on ? [k] : [])), last, hasKids: kids.length > 0 })
        walk(kids, depth + 1, depth ? [...prefix, !last] : prefix, c)
      })
    }
    walk(visible(b.tops), 0, [])
  }
  else b.items.filter(matches).forEach(p => out.push({ p, depth: 0, hid: [], pipes: [], last: true, hasKids: false }))
  return out.map((r) => {
    const subs = submitted(r.p)
    return { ...r, rels: rels(r.p), fresh: names(subs.filter(x => x.after === 0).map(x => x.by)), stale: names(subs.filter(x => x.after > 0).map(x => x.by)) }
  })
}
const gapTip = (hid: PullRequest[]) => t('band.gapTip', { n: hid.length, list: hid.map(q => `#${q.num}`).join(', ') }, hid.length)
const names = (logins: string[]) => logins.map(l => person(l).n).join(', ')
const bandRows = computed(() => new Map(visibleBands.value.map(b => [b.key, rows(b)])))
function toggle(b: Band, e: MouseEvent) {
  if ((e.target as HTMLElement).closest('a, .mchip')) return
  setCollapsed(b.key, !st.collapsed.has(b.key))
}
</script>

<template>
  <div v-if="visibleBands.length" class="list-wrap">
    <div class="list">
      <section v-for="b in visibleBands" :key="b.key" class="grp" :class="{ collapsed: st.collapsed.has(b.key) }">
        <header class="grp-row" data-fold-area @click="toggle(b, $event)">
          <FoldButton :open="!st.collapsed.has(b.key)" />
          <BandBadges :band="b" />
          <span class="grp-mini"><MiniChips :band="b" /></span>
        </header>
        <article
          v-for="{ p, step, depth, parent, hid, pipes, last, hasKids, rels: pRels, fresh, stale } in bandRows.get(b.key)"
          :key="p.id"
          class="row"
          :class="[{ 'root': !depth, 'conflict': blocking(p), 'draft': p.draft, 'draft-conflict': p.draft && p.conflict, 'flash': st.changed.has(p.id), 'sel': st.sel === p.id }, pulseClass(p)]"
          :style="{ '--d': depth }"
          tabindex="0"
          :aria-labelledby="`l-${p.id}`"
          @click="st.sel = p.id"
          @keydown.enter.self="st.sel = p.id"
          @pointermove="hoverSeen(p.id, $event)"
        >
          <span v-if="step" class="l-tree" aria-hidden="true">
            <i v-for="k in pipes" :key="k" :style="{ '--k': k }"></i>
            <i v-if="depth && !last" :style="{ '--k': depth - 1 }"></i>
            <i v-if="depth" class="elbow" :style="{ '--k': depth - 1 }"></i>
            <i v-if="hasKids" class="down" :style="{ '--k': depth }"></i>
            <Tip v-if="hid.length" :text="gapTip(hid)">
              <span class="edge-gap" :style="{ '--k': depth - 1 }">+{{ hid.length }}</span>
            </Tip>
            <Tip :text="stepTip(step, parent)">
              <span class="lstep" :class="{ draft: p.status === 'draft' }" :style="{ '--c': STATUS_COLOR[p.status] }">{{ step }}</span>
            </Tip>
          </span>
          <div class="l-main">
            <div class="l-title">
              <h3 :id="`l-${p.id}`">{{ p.title }}<span v-if="step" class="sr-only"> · {{ stepTip(step, parent) }}<template v-if="hid.length"> · {{ gapTip(hid) }}</template></span></h3>
              <LabelPill v-for="l in p.labels" :key="l" :name="l" />
              <ForMeTag :pr="p" />
              <ConflictTip v-if="blocking(p)" :pr="p"><span class="conf-tag"><Icon name="conflict" />{{ t('card.conflict') }}</span></ConflictTip>
              <Tip v-else-if="p.conflict" :text="t('card.draftConflictTip')"><span class="conf-tag"><Icon name="conflict" />{{ t('card.draftConflict') }}</span></Tip>
              <Tip v-if="st.changed.has(p.id)" :text="t('card.updatedTip')"><span class="newtag">{{ t('card.updated') }}</span></Tip>
            </div>
            <div class="l-meta">
              <PrRef :pr="p" />
              <span class="l-by">
                <Tip :text="t('dates.created', { at: fmtFull(p.createdAt) })"><time :datetime="p.createdAt">{{ since('opened', p.createdAt, st.now) }}</time></Tip>
                {{ t('list.by') }}
                <AuthorChip :login="p.author" />
              </span>
              <Tip :text="t('dates.updated', { at: fmtFull(p.updatedAt) })"><time :datetime="p.updatedAt">{{ since('updated', p.updatedAt, st.now) }}</time></Tip>
              <span class="l-br"><code>{{ p.head }}</code> → <code>{{ p.base }}</code></span>
            </div>
            <div class="l-extra">
              <RelFlag v-if="lean && pRels.length" :rels="pRels" :pr="p" :parent="parent" />
              <template v-else-if="!lean">
                <RelNote v-for="r in notes(pRels)" :key="relKey(r)" :rel="r" :pr="p" :parent="parent" />
                <MentionsNote :rels="pRels" :pr="p" :parent="parent" />
                <PrDesc :body="p.body" />
              </template>
            </div>
          </div>
          <div class="l-side">
            <StatusPill :status="p.status" />
            <div class="l-revs">
              <div class="revs">
                <ReviewChip v-for="r in p.reviews" :key="r.by" :review="r" :pop="st.popAv.has(p.id + r.by)" />
                <span v-if="!p.reviews.length" class="no-rev">{{ t('card.noReviewer') }}</span>
              </div>
              <Tip v-if="fresh || stale" :text="t('list.sinceTip')">
                <div class="since">
                  <span v-if="fresh" class="ok">{{ t('list.fresh', { names: fresh }) }}</span>
                  <template v-if="fresh && stale"> · </template>
                  <span v-if="stale" class="warn">{{ t('list.redo', { names: stale }) }}</span>
                </div>
              </Tip>
            </div>
            <PrMetas :pr="p" total />
          </div>
        </article>
      </section>
    </div>
  </div>
  <ViewStatus v-else />
</template>
