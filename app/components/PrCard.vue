<script setup lang="ts">
import type { PullRequest } from '#shared/types/pr'
import type { Rel } from '~/utils/stacks'

const props = defineProps<{ pr: PullRequest, step?: number, parent?: PullRequest, abs?: { x: number, y: number }, delay: number }>()
const { st, lean, matches, pulseClass, hoverSeen, byId, blocks, blocking } = useStacks()
const { t } = useI18n()
const open = (id: string) => {
  st.sel = id
}
const p = computed(() => props.pr)
const stepTip = computed(() => {
  if (props.step === 1) return t('card.step1')
  if (props.step && props.parent) return t('card.stepN', { n: props.step, parent: props.parent.num })
  return ''
})
const deps = computed(() => p.value.dependsOn.map(byId).filter((o): o is PullRequest => !!o))
const links = computed(() => [...p.value.links].sort((a, b) => Number(a.state === 'merged') - Number(b.state === 'merged')))
const rels = computed<Rel[]>(() => [
  ...(p.value.behind ? [{ k: 'behind' as const }] : []),
  ...deps.value.map(o => ({ k: 'dep' as const, o })),
  ...blocks(p.value).map(o => ({ k: 'block' as const, o })),
  ...links.value.map(l => ({ k: 'link' as const, l })),
])
const shown = computed(() => (rels.value.length > 2 ? rels.value.slice(0, 1) : rels.value))
const more = computed(() => rels.value.slice(shown.value.length))
const relKey = (r: Rel) => (r.k === 'behind' ? r.k : r.k === 'link' ? r.l.url : r.k + r.o.id)
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
    <Tip v-if="step" :text="stepTip"><span class="step">{{ step }}</span></Tip>
    <ForMeTag :pr="p" />
    <header v-if="blocking(p)" class="c-top conf">
      <PrRef :pr="p" />
      <Tip>
        <span class="conf-msg"><Icon name="conflict" />{{ t('card.conflict') }}</span>
        <template #content>
          <i18n-t keypath="status.tipLine" scope="global">
            <template #label><b>{{ t('status.conflict.l') }}</b></template>
            <template #tip>{{ t('status.conflict.tip') }}</template>
          </i18n-t>
          <br />{{ t('card.base') }} <code>{{ p.base }}</code>
        </template>
      </Tip>
    </header>
    <header v-else class="c-top">
      <PrRef :pr="p" />
      <Tip v-if="st.changed.has(p.id)" :text="t('card.updatedTip')"><span class="newtag">{{ t('card.updated') }}</span></Tip>
      <Tip v-if="p.conflict" :text="t('card.draftConflictTip')">
        <span class="conf-tag"><Icon name="conflict" />{{ t('card.draftConflict') }}</span>
      </Tip>
      <StatusPill :status="p.status" />
    </header>
    <div class="c-main" :class="{ 'has-notes': !lean && rels.length, 'has-notes-2': !lean && shown.length + (more.length ? 1 : 0) >= 2 }">
      <h3 :id="`t-${p.id}`" class="c-title">{{ p.title }}</h3>
      <div class="byline">
        <AuthorChip :login="p.author" />
        <CardLabels v-if="p.labels.length" :labels="p.labels" />
      </div>
      <PrDesc v-if="!lean" :body="p.body" />
      <div v-if="!lean && rels.length" class="notes">
        <template v-for="r in shown" :key="relKey(r)">
          <Tip v-if="r.k === 'behind'">
            <div class="note behind"><Icon name="behind" />{{ t('card.behind', { target: parent ? `#${parent.num}` : p.base }) }}</div>
            <template #content>
              <code>mergeStateStatus = BEHIND</code><br />
              <i18n-t keypath="card.behindTip" scope="global"><template #base><code>{{ p.base }}</code></template></i18n-t>
            </template>
          </Tip>
          <Tip v-else-if="r.k === 'dep'">
            <div class="note"><i class="sd" :data-s="r.o.draft ? 'draft' : 'open'" role="img" :aria-label="t(`linkState.${r.o.draft ? 'draft' : 'open'}`)"></i>{{ t('card.waits') }}&nbsp;<PrLink :pr="r.o">{{ r.o.id }}</PrLink>&nbsp;· {{ t(`status.${r.o.status}.l`) }}</div>
            <template #content>{{ t('card.depTip') }}<br />{{ r.o.title }}</template>
          </Tip>
          <Tip v-else-if="r.k === 'block'">
            <div class="note"><i class="sd" :data-s="r.o.draft ? 'draft' : 'open'" role="img" :aria-label="t(`linkState.${r.o.draft ? 'draft' : 'open'}`)"></i>{{ t('card.blocks') }}&nbsp;<PrLink :pr="r.o">{{ r.o.id }}</PrLink></div>
            <template #content>{{ t('card.blocksTip', { id: r.o.id }) }}<br />{{ r.o.title }}</template>
          </Tip>
          <Tip v-else-if="r.k === 'link'">
            <div class="note ext" :class="{ merged: r.l.state === 'merged' }" :data-s="r.l.state"><i class="sd" :data-s="r.l.state" role="img" :aria-label="t(`linkState.${r.l.state}`)"></i>{{ t('card.mentions') }}&nbsp;<a class="lnk" :href="r.l.url" target="_blank" rel="noopener" @click.stop>{{ r.l.ref }}</a><template v-if="r.l.state !== 'open'">&nbsp;· {{ t(`linkState.${r.l.state}`) }}</template></div>
            <template #content>{{ t('card.depTip') }} · <b>{{ t(`linkState.${r.l.state}`) }}</b><br />{{ r.l.title }}</template>
          </Tip>
        </template>
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
        <Tip v-if="lean && rels.length">
          <span class="flag" :class="{ behind: rels.length === 1 && p.behind }"><Icon :name="rels.length === 1 && p.behind ? 'behind' : 'link'" />{{ rels.length }}</span>
          <template #content>
            <div v-for="r in rels" :key="relKey(r)"><CardRelLine :rel="r" :parent="parent" :pr="p" /></div>
          </template>
        </Tip>
        <PrMetas :pr="p" />
      </div>
    </footer>
  </article>
</template>
