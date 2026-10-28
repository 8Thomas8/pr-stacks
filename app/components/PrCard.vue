<script setup lang="ts">
import type { PullRequest } from '#shared/types/pr'

const props = defineProps<{ pr: PullRequest, step?: number, parent?: PullRequest, abs?: { x: number, y: number }, delay: number }>()
const { st, lean, matches, pulseClass, hoverSeen, rels: relsOf, blocking } = useStacks()
const { t, fmtFull, since, stepTip } = useFmt()
const open = (id: string) => {
  st.sel = id
}
const p = computed(() => props.pr)
const rels = computed(() => relsOf(p.value))
const grouped = computed(() => rels.value.filter(r => r.k === 'link').length > 1)
const notes = computed(() => (grouped.value ? rels.value.filter(r => r.k !== 'link') : rels.value))
const slots = computed(() => notes.value.length + (grouped.value ? 1 : 0))
const shown = computed(() => (slots.value > 2 ? notes.value.slice(0, 1) : notes.value))
const more = computed(() => (slots.value > 2 ? rels.value.filter(r => !shown.value.includes(r)) : []))
</script>

<template>
  <article
    class="card"
    :class="[{ 'abs': abs, 'draft': p.draft, 'conflict': blocking(p), 'draft-conflict': p.draft && p.conflict, 'dim': !matches(p), 'sel': st.sel === p.id, 'flash': st.changed.has(p.id) }, `is-${p.status}`, pulseClass(p)]"
    :style="{ 'left': abs ? `${abs.x}px` : undefined, 'top': abs ? `${abs.y}px` : undefined, '--d': `${delay}s` }"
    tabindex="0"
    :aria-labelledby="`t-${p.id}`"
    @click="open(p.id)"
    @keydown.enter.self="open(p.id)"
    @mouseenter="st.hover = p.id"
    @mouseleave="st.hover = null"
    @pointermove="hoverSeen(p.id, $event)"
  >
    <Tip v-if="step" :text="stepTip(step, parent)"><span class="step">{{ step }}</span></Tip>
    <ForMeTag :pr="p" />
    <header v-if="blocking(p)" class="c-top conf">
      <PrRef :pr="p" />
      <ConflictTip :pr="p"><span class="conf-msg"><Icon name="conflict" />{{ t('card.conflict') }}</span></ConflictTip>
    </header>
    <header v-else class="c-top">
      <PrRef :pr="p" />
      <Tip v-if="st.changed.has(p.id)" :text="t('card.updatedTip')"><span class="newtag">{{ t('card.updated') }}</span></Tip>
      <Tip v-if="p.conflict" :text="t('card.draftConflictTip')">
        <span class="conf-tag"><Icon name="conflict" />{{ t('card.draftConflict') }}</span>
      </Tip>
      <StatusPill :status="p.status" />
    </header>
    <div class="c-main" :class="{ 'has-notes': !lean && rels.length, 'has-notes-2': !lean && slots >= 2 }">
      <h3 :id="`t-${p.id}`" class="c-title">{{ p.title }}</h3>
      <div class="byline">
        <AuthorChip :login="p.author" />
        <CardLabels v-if="p.labels.length" :labels="p.labels" />
      </div>
      <Tip>
        <div class="c-dates"><Icon name="clock" /><time :datetime="p.createdAt">{{ since('opened', p.createdAt, st.now) }}</time> · <time :datetime="p.updatedAt">{{ since('updated', p.updatedAt, st.now) }}</time></div>
        <template #content>{{ t('dates.created', { at: fmtFull(p.createdAt) }) }}<br />{{ t('dates.updated', { at: fmtFull(p.updatedAt) }) }}</template>
      </Tip>
      <PrDesc v-if="!lean" :body="p.body" />
      <div v-if="!lean && rels.length" class="notes">
        <RelNote v-for="r in shown" :key="relKey(r)" :rel="r" :pr="p" :parent="parent" />
        <MentionsNote v-if="!more.length" :rels="rels" :pr="p" :parent="parent" />
        <Tip v-if="more.length">
          <div class="note more">{{ t('card.moreLinks', { n: more.length }, more.length) }}</div>
          <template #content>
            <div v-for="r in more" :key="relKey(r)"><CardRelLine :rel="r" :parent="parent" :pr="p" /></div>
          </template>
        </Tip>
      </div>
    </div>
    <footer class="c-foot">
      <div class="revs">
        <ReviewChip v-for="r in p.reviews" :key="r.by" :review="r" :pop="st.popAv.has(p.id + r.by)" />
        <span v-if="!p.reviews.length" class="no-rev">{{ t('card.noReviewer') }}</span>
      </div>
      <div class="c-end">
        <RelFlag v-if="lean && rels.length" :rels="rels" :pr="p" :parent="parent" />
        <PrMetas :pr="p" />
      </div>
    </footer>
  </article>
</template>
