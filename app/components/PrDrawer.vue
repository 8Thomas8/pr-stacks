<script setup lang="ts">
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import type { LinkedPr, PullRequest, Review } from '#shared/types/pr'

const { st, byId, tree, submitted, sinceLastReview, blocks, person, toast, showCi, setFocus } = useStacks()
const { t, commits, fmtAt, fmtFull, since } = useFmt()
const { prInbox, readPr, inboxText } = useDesktop()

const last = shallowRef<PullRequest>()
const p = computed(() => (st.sel ? byId(st.sel) : undefined) ?? last.value)
watch(() => st.sel && byId(st.sel), (v) => {
  if (v) last.value = v
}, { immediate: true })
const open = computed({
  get: () => !!st.sel && !!byId(st.sel),
  set: (v) => {
    if (!v) st.sel = null
  },
})

const fresh = computed(() => (p.value ? submitted(p.value).filter(r => r.after === 0) : []))
const stale = computed(() => (p.value ? submitted(p.value).filter(r => r.after > 0) : []))
const approvals = computed(() => fresh.value.filter(r => r.s === 'APPROVED').length)
const pending = computed(() => p.value?.reviews.filter(r => r.s === 'REQUESTED') ?? [])
const parent = computed(() => (p.value ? tree.value.parentOf(p.value) : undefined))
interface DepRow { ref: string, url: string, title: string, state: LinkedPr['state'], tone: string, label: string, id?: string }
const tracked = (o: PullRequest): DepRow => ({ ref: o.id, url: o.url, title: o.title, state: o.draft ? 'draft' : 'open', tone: o.status, label: t(`status.${o.status}.l`), id: o.id })
function openRow(e: MouseEvent, r: DepRow) {
  if (!r.id || e.metaKey || e.ctrlKey || e.shiftKey) return
  e.preventDefault()
  st.sel = r.id
}
const depGroups = computed<{ k: string, rows: DepRow[] }[]>(() => {
  const pr = p.value
  if (!pr) return []
  return [
    { k: 'parent', rows: parent.value ? [tracked(parent.value)] : [] },
    { k: 'before', rows: pr.dependsOn.map(byId).filter((o): o is PullRequest => !!o).map(tracked) },
    { k: 'waits', rows: blocks(pr).map(tracked) },
    { k: 'mentioned', rows: pr.links.map(l => ({ ref: l.ref, url: l.url, title: l.title, state: l.state, tone: l.state, label: t(`linkState.${l.state}`) })) },
  ].filter(g => g.rows.length)
})

type TlItem = { kind: 'commit', c: [string, string, string] } | { kind: 'review', r: Review } | { kind: 'mark', text: string, faint?: boolean }
const timeline = computed<TlItem[]>(() => {
  const pr = p.value
  if (!pr) return []
  const n = pr.commits.length, subs = submitted(pr), since = sinceLastReview(pr)
  const out: TlItem[] = []
  if (pr.commitCount > n) out.push({ kind: 'mark', text: t('drawer.older', { n: pr.commitCount - n }, pr.commitCount - n), faint: true })
  subs.filter(r => r.after >= n).forEach(r => out.push({ kind: 'review', r }))
  pr.commits.forEach((c, k) => {
    if (subs.length && since && k === n - since) out.push({ kind: 'mark', text: t('drawer.sinceReview', { commits: commits(since) }) })
    out.push({ kind: 'commit', c })
    subs.filter(r => r.after === n - 1 - k).forEach(r => out.push({ kind: 'review', r }))
  })
  return out
})

function copyBranch() {
  const head = p.value!.head
  navigator.clipboard.writeText(head).then(() => toast(t('drawer.copied'), head, 'ok'), () => toast(t('drawer.copyRefused'), head, 'error'))
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="scrim" />
      <DialogContent v-if="p" class="drawer" @open-auto-focus.prevent>
        <div class="d-head">
          <div class="row">
            <PrRef :pr="p" />
            <StatusPill :status="p.status" />
            <Tip :text="t('drawer.closeTip')">
              <DialogClose class="d-close" :aria-label="t('drawer.close')"><Icon name="x" /></DialogClose>
            </Tip>
          </div>
          <DialogTitle as="h2">{{ p.title }}</DialogTitle>
          <div class="branch">
            <Tip :text="t('drawer.baseBranch')"><code>{{ p.base }}</code></Tip>←<Tip :text="t('drawer.headBranch')"><code>{{ p.head }}</code></Tip>
          </div>
          <div v-if="p.labels.length" class="labels"><LabelPill v-for="l in p.labels" :key="l" :name="l" /></div>
          <DialogDescription as="div" class="row" style="font-size:12.5px;color:var(--muted)">
            <UserAvatar :login="p.author" /><span>{{ person(p.author).n }}</span>·
            <Tip :text="t('dates.created', { at: fmtFull(p.createdAt) })"><time :datetime="p.createdAt">{{ since('opened', p.createdAt, st.now) }}</time></Tip>·
            <Tip :text="t('dates.updated', { at: fmtFull(p.updatedAt) })"><time :datetime="p.updatedAt">{{ since('updated', p.updatedAt, st.now) }}</time></Tip>
          </DialogDescription>
          <div v-if="prInbox(p).length" class="d-gh">
            <Icon name="bell" /><span><b>{{ t('drawer.ghUnread', { n: prInbox(p).length }, prInbox(p).length) }}</b> {{ prInbox(p).map(inboxText).join(' · ') }}</span>
            <Tip :text="t('center.markRead')">
              <button class="nc-read" :aria-label="t('center.markRead')" @click="readPr(p)"><Icon name="check" /></button>
            </Tip>
          </div>
          <div v-if="p.conflict" class="d-conf">
            <Icon name="conflict" /><span><b>{{ t('drawer.conflictTitle', { base: p.base }) }}</b> {{ t('drawer.conflictText') }}</span>
          </div>
        </div>

        <div class="d-body">
          <FoldSection k="drawer:desc" heading="h5" :title="t('drawer.desc')">
            <PrBody v-if="stripComments(p.body)" :body="stripComments(p.body)" />
            <div v-else class="body-text" style="color:var(--faint)">{{ t('drawer.noDesc') }}</div>
          </FoldSection>

          <FoldSection v-if="depGroups.length" k="drawer:deps" heading="h5" :title="t('drawer.deps')">
            <div v-for="g in depGroups" :key="g.k" class="dgrp">
              <div class="dgrp-l">{{ t(`drawer.${g.k}`) }}</div>
              <a
                v-for="r in g.rows"
                :key="r.url"
                class="drow"
                :class="{ done: r.state === 'merged' || r.state === 'closed' }"
                :href="r.url"
                target="_blank"
                rel="noopener"
                :title="r.title"
                @click="openRow($event, r)"
              >
                <i class="sd" :data-s="r.state" role="img" :aria-label="t(`linkState.${r.state}`)"></i><span class="k">{{ r.ref }}</span><span class="t">{{ r.title }}</span><span class="jstat" :data-link="r.tone">{{ r.label }}</span>
              </a>
            </div>
          </FoldSection>

          <FoldSection k="drawer:reviews" heading="h5" :title="t('drawer.reviews')">
            <template #aside>{{ t('drawer.approvals', { n: approvals }, approvals) }}</template>
            <ReviewLine v-for="r in fresh" :key="r.by" :review="r" />
            <template v-if="stale.length">
              <div class="tl-mark" style="margin-left:0">{{ t('drawer.beforeLatest') }}</div>
              <ReviewLine v-for="r in stale" :key="r.by" :review="r" />
            </template>
            <template v-if="pending.length">
              <div class="tl-mark" style="margin-left:0;color:var(--faint)">{{ t('drawer.pending') }}</div>
              <ReviewLine v-for="r in pending" :key="r.by" :review="r" />
            </template>
            <div v-if="!p.reviews.length" style="color:var(--faint);font-size:13px">{{ t('drawer.noReviewers') }}</div>
          </FoldSection>

          <FoldSection v-if="timeline.length" k="drawer:history" heading="h5" :title="t('drawer.history')">
            <div class="tl">
              <template v-for="(it, i) in timeline" :key="i">
                <div v-if="it.kind === 'mark'" class="tl-mark" :style="it.faint ? 'color:var(--faint)' : undefined">{{ it.text }}</div>
                <div v-else-if="it.kind === 'commit'" class="tl-i">
                  <span class="tl-dot c"></span>
                  <span class="m"><code>{{ it.c[0] }}</code>{{ it.c[1] }}</span>
                  <span class="ts">{{ fmtAt(it.c[2]) }}</span>
                </div>
                <div v-else class="tl-i">
                  <span class="tl-dot" :class="{ ok: it.r.s === 'APPROVED', bad: it.r.s === 'CHANGES_REQUESTED' }">
                    <Icon v-if="it.r.s === 'APPROVED'" name="check" /><Icon v-else-if="it.r.s === 'CHANGES_REQUESTED'" name="x" />
                  </span>
                  <span class="m"><b>{{ person(it.r.by).n }}</b> {{ t(`verb.${it.r.s}`) }}</span>
                  <span class="ts">{{ fmtAt(it.r.at) }}</span>
                </div>
              </template>
            </div>
          </FoldSection>

          <FoldSection k="drawer:threads" heading="h5" :title="t('drawer.threads')">
            <template #aside>{{ t('drawer.threadsCount', { n: p.threads.length, total: p.comments }) }}</template>
            <div v-for="thread in p.threads" :key="thread.id" class="thread">
              <div class="by"><UserAvatar :login="thread.by" />{{ person(thread.by).n }}</div>
              <div class="f">{{ thread.f }}</div>
              <PrBody v-if="stripComments(thread.t)" class="txt" :body="stripComments(thread.t)" bare />
              <div v-else class="txt empty">{{ t('drawer.emptyComment') }}</div>
            </div>
            <div v-if="!p.threads.length" style="color:var(--faint);font-size:13px">{{ t('drawer.noThreads') }}</div>
          </FoldSection>

          <FoldSection k="drawer:merge" heading="h5" :title="t('drawer.merge')">
            <div class="checks">
              <div v-if="p.conflict">
                <i class="ci failure"></i><i18n-t keypath="drawer.conflictWith" tag="span" scope="global"><template #base><code>{{ p.base }}</code></template></i18n-t><span>{{ t('drawer.rebaseNeeded') }}</span>
              </div>
              <div v-else-if="p.behind">
                <i class="ci running" style="animation:none"></i><i18n-t keypath="drawer.behindOn" tag="span" scope="global"><template #base><code>{{ p.base }}</code></template></i18n-t><span>{{ t('drawer.rebaseAdvised') }}</span>
              </div>
              <div v-else-if="p.mergeable === 'UNKNOWN'"><i class="ci none"></i><span>{{ t('drawer.computing') }}</span><span>—</span></div>
              <div v-else>
                <i class="ci success"></i><i18n-t keypath="drawer.mergeableInto" tag="span" scope="global"><template #base><code>{{ p.base }}</code></template></i18n-t><span>{{ t('drawer.upToDate') }}</span>
              </div>
              <div v-if="showCi"><i class="ci" :class="p.ci"></i><span>{{ t('drawer.checks') }}</span><span>{{ t(`ci.label.${p.ci}`) }}</span></div>
            </div>
          </FoldSection>
        </div>

        <div class="d-actions">
          <a class="btn primary" :href="p.url" target="_blank" rel="noopener" @click="readPr(p)"><Icon name="ext" />{{ t('link.open') }}</a>
          <Tip :text="t('focus.tip')">
            <button class="btn" @click="setFocus(p.id); st.sel = null"><Icon name="focus" />{{ t('focus.isolate') }}<kbd>F</kbd></button>
          </Tip>
          <a class="btn" :href="`${p.url}/files`" target="_blank" rel="noopener" @click="readPr(p)">{{ t('drawer.files') }}</a>
          <Tip :text="t('drawer.copyTip')">
            <button class="btn" @click="copyBranch"><Icon name="copy" />{{ t('drawer.copy') }}</button>
          </Tip>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
