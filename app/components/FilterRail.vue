<script setup lang="ts">
const { st, snap, prs, me, repos, QUICK, label, person } = useStacks()
const { ds } = useDesktop()
const { t, locale } = useI18n()
const usedLabels = computed(() => [...new Set(prs.value.flatMap(p => p.labels))].sort((a, b) => a.localeCompare(b, locale.value)))
const authors = computed(() => [...new Set(prs.value.map(p => p.author))]
  .sort((a, b) => (a === me.value ? -1 : b === me.value ? 1 : person(a).n.localeCompare(person(b).n, locale.value))))
const toggle = (set: Set<string>, v: string) => (set.has(v) ? set.delete(v) : set.add(v))
const rate = computed(() => snap.value?.rate)
const cost = computed(() => snap.value?.cost ?? 0)
const num = (n: number) => n.toLocaleString(locale.value)
</script>

<template>
  <aside class="rail" :aria-label="t('rail.label')">
    <FoldSection k="rail:views" :title="t('rail.views')" :active="st.quick === 'all' ? 0 : 1">
      <div class="qv">
        <Tip v-for="x in QUICK.filter(q => q.k !== 'gh' || ds.inbox)" :key="x.k" :text="t(`quick.${x.k}.tip`)">
          <button :aria-pressed="st.quick === x.k" @click="st.quick = x.k">
            <i class="sw" :style="{ background: x.c }"></i>{{ t(`quick.${x.k}.l`) }}
            <span class="n" :class="{ hot: x.hot && prs.filter(x.f).length }">{{ prs.filter(x.f).length }}</span>
          </button>
        </Tip>
      </div>
    </FoldSection>
    <FoldSection k="rail:labels" :title="t('rail.labels')" :active="st.labels.size">
      <div class="chips">
        <Tip v-for="l in usedLabels" :key="l" :text="label(l).d || l">
          <button class="chip" :aria-pressed="st.labels.has(l)" @click="toggle(st.labels, l)"><i class="ld" :style="{ background: label(l).c }"></i><span class="chip-t">{{ l }}</span></button>
        </Tip>
        <span v-if="!usedLabels.length" style="font-size:12.5px;color:var(--faint)">{{ t('rail.noLabels') }}</span>
      </div>
    </FoldSection>
    <FoldSection k="rail:repos" :title="t('rail.repos')" :active="st.repos.size">
      <div class="chips">
        <Tip v-for="r in repos" :key="r.key" :text="r.slug">
          <button class="chip" :aria-pressed="st.repos.has(r.key)" @click="toggle(st.repos, r.key)"><span class="chip-t">{{ r.key }}</span></button>
        </Tip>
      </div>
    </FoldSection>
    <FoldSection k="rail:authors" :title="t('rail.authors')" :active="st.authors.size">
      <div class="chips">
        <button v-for="a in authors" :key="a" class="chip" :aria-pressed="st.authors.has(a)" @click="toggle(st.authors, a)">
          <UserAvatar :login="a" /><span class="chip-t">{{ person(a).n }}</span>
        </button>
      </div>
    </FoldSection>
    <FoldSection k="rail:legend" :title="t('rail.legend')" class="rail-legend">
      <div class="legend">
        <div><span class="av" data-s="APPROVED" style="--h:222">AB</span>{{ t('rail.legendItems.approved') }}</div>
        <div><span class="av" data-s="CHANGES_REQUESTED" style="--h:24">CD</span>{{ t('rail.legendItems.changes') }}</div>
        <div><span class="av" data-s="COMMENTED" style="--h:162">EF</span>{{ t('rail.legendItems.commented') }}</div>
        <div><span class="av" data-s="REQUESTED" style="--h:290">GH</span>{{ t('rail.legendItems.requested') }}</div>
        <div><span class="av stale" data-s="APPROVED" style="--h:222">AB</span><b class="rvn">+2</b>{{ t('rail.legendItems.stale') }}</div>
      </div>
    </FoldSection>
    <Tip v-if="rate" :text="t('rail.rateTip', { repos: t('n.repos', repos.length), points: t('n.points', cost) })">
      <div class="rate" tabindex="0">
        {{ t('rail.rate', { remaining: num(rate.remaining), limit: num(rate.limit) }) }}
        <div class="meter"><i :style="{ width: `${(rate.remaining / rate.limit) * 100}%` }"></i></div>
      </div>
    </Tip>
  </aside>
</template>
