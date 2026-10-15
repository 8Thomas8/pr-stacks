<script setup lang="ts">
import { CollapsibleContent, CollapsibleRoot } from 'reka-ui'
import type { Band } from '~/utils/stacks'

const props = defineProps<{ band: Band, index: number }>()
const { st, forest, matches, pathHas, setCollapsed, blocking } = useStacks()
const { t } = useI18n()

const DIMS = {
  comfortable: { CW: 320, CH: 248, GX: 58, GY: 18, EY: 20 },
  compact: { CW: 320, CH: 161, GX: 58, GY: 18, EY: 20 },
  ultra: { CW: 252, CH: 132, GX: 40, GY: 16, EY: 15 },
}
const dims = computed(() => DIMS[st.density])
const PAD_LEFT = 30
const open = computed({
  get: () => !st.collapsed.has(props.band.key),
  set: v => setCollapsed(props.band.key, !v),
})
const bd = computed(() => props.index * 0.08)

const layout = computed(() => {
  if (props.band.kind !== 'stack') return null
  const { CW, CH, GX, GY, EY } = dims.value
  const pos: Record<string, { x: number, y: number }> = {}
  let y = 0, maxX = 0
  const place = (id: string, depth: number) => {
    const x = depth * (CW + GX)
    maxX = Math.max(maxX, x + CW)
    const ch = forest.value.kids(id)
    if (!ch.length) {
      pos[id] = { x, y }
      y += CH + GY
      return
    }
    ch.forEach(c => place(c.id, depth + 1))
    pos[id] = { x, y: (pos[ch[0]!.id]!.y + pos[ch[ch.length - 1]!.id]!.y) / 2 }
  }
  props.band.tops.forEach(t => place(t.id, 0))
  const edges = props.band.items.flatMap((p) => {
    const parent = forest.value.parentOf(p)
    if (!parent || !(parent.id in pos)) return []
    const a = pos[parent.id]!, b = pos[p.id]!
    const x1 = a.x + CW, y1 = a.y + EY, x2 = b.x - 14, y2 = b.y + EY, tx = (x1 + x2) / 2
    const dy = y2 - y1, sy = Math.sign(dy), r = Math.min(8, Math.abs(dy) / 2)
    const d = Math.abs(dy) < 1
      ? `M${x1},${y1} H${x2}`
      : `M${x1},${y1} H${tx - r} Q${tx},${y1} ${tx},${y1 + sy * r} V${y2 - sy * r} Q${tx},${y2} ${tx + r},${y2} H${x2}`
    return [{ to: p.id, from: parent, conf: blocking(p), len: Math.round(x2 - x1 + Math.abs(dy)), d }]
  })
  return { pos, edges, W: maxX, H: y - GY }
})
const delay = (id: string) => bd.value + (props.band.depth[id] ?? 0) * 0.12 + 0.05
const parentInBand = (id: string) => {
  const p = forest.value.parentOf(props.band.items.find(x => x.id === id)!)
  return p && props.band.depth[p.id] !== undefined ? p : undefined
}
const edgeHl = (to: string) => pathHas(st.sel, to) || pathHas(st.hover, to)

const scroller = ref<HTMLElement>()
const hidden = reactive({ left: 0, right: 0, canL: false, canR: false })
function updateOverflow() {
  const sc = scroller.value
  if (!sc) return
  const left = sc.scrollLeft, right = left + sc.clientWidth
  const cards = [...sc.querySelectorAll<HTMLElement>('.card')]
  hidden.left = cards.filter(c => c.offsetLeft + PAD_LEFT + c.offsetWidth / 2 < left).length
  hidden.right = cards.filter(c => c.offsetLeft + PAD_LEFT + c.offsetWidth / 2 > right).length
  hidden.canL = left > 2
  hidden.canR = right < sc.scrollWidth - 2
}
const scrollBy = (dir: number) => scroller.value?.scrollBy({ left: dir * Math.max(dims.value.CW + dims.value.GX, scroller.value.clientWidth * 0.8), behavior: 'smooth' })
const drag = ref<{ x: number, left: number } | null>(null)
function onDown(e: PointerEvent) {
  if (e.button !== 0 || (e.target as HTMLElement).closest('.card, a, button') || !scroller.value) return
  drag.value = { x: e.clientX, left: scroller.value.scrollLeft }
  scroller.value.setPointerCapture(e.pointerId)
}
function onMove(e: PointerEvent) {
  if (drag.value && scroller.value) scroller.value.scrollLeft = drag.value.left - (e.clientX - drag.value.x)
}
const onUp = () => {
  drag.value = null
}
onMounted(() => {
  nextTick(updateOverflow)
  window.addEventListener('resize', updateOverflow)
})
onBeforeUnmount(() => window.removeEventListener('resize', updateOverflow))
watch(layout, () => nextTick(updateOverflow))
watch(open, v => v && setTimeout(updateOverflow, 400))

function onHeaderClick(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('a, .mchip')) return
  open.value = !open.value
}
</script>

<template>
  <CollapsibleRoot v-model:open="open" as="section" class="band" :class="{ 'has-conflict': band.items.some(blocking), 'collapsed': !open }" :style="{ '--bd': `${bd}s` }">
    <header class="band-h" data-fold-area @click="onHeaderClick">
      <div class="band-row">
        <FoldButton :open="open" />
        <BandBadges :band="band" />
      </div>
      <div class="band-mini"><MiniChips :band="band" /></div>
    </header>
    <CollapsibleContent class="band-fold">
      <div v-if="band.kind === 'solo'" class="solo-grid">
        <PrCard v-for="(p, i) in band.items" :key="p.id" :pr="p" :delay="bd + i * 0.05" />
      </div>
      <div v-else-if="layout" class="band-scroll" :class="{ 'can-left': hidden.canL, 'can-right': hidden.canR }">
        <div
          ref="scroller"
          class="band-body"
          :class="{ dragging: !!drag }"
          @scroll.passive="updateOverflow"
          @pointerdown="onDown"
          @pointermove="onMove"
          @pointerup="onUp"
          @pointercancel="onUp"
        >
          <div class="band-canvas" :style="{ width: `${layout.W}px`, height: `${layout.H}px` }">
            <svg class="edges" :width="layout.W" :height="layout.H">
              <defs>
                <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="arrow" d="M0,0 L10,5 L0,10 z" /></marker>
                <marker id="arr-hl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="arrow-hl" d="M0,0 L10,5 L0,10 z" /></marker>
                <marker id="arr-conf" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="arrow-conf" d="M0,0 L10,5 L0,10 z" /></marker>
              </defs>
              <path
                v-for="e in layout.edges"
                :key="e.to"
                class="edge"
                :class="{ conf: e.conf, hl: edgeHl(e.to), dim: !matches(e.from) || !matches(band.items.find(x => x.id === e.to)!) }"
                marker-end="url(#arr)"
                :style="{ '--len': e.len, '--d': `${delay(e.to)}s` }"
                :d="e.d"
              />
            </svg>
            <PrCard
              v-for="p in band.items"
              :key="p.id"
              :pr="p"
              :abs="layout.pos[p.id]"
              :step="(band.depth[p.id] ?? 0) + 1"
              :parent="parentInBand(p.id)"
              :delay="delay(p.id)"
            />
          </div>
        </div>
        <Tip v-if="hidden.left" :text="t('band.hintLeftTip')">
          <button class="edge-hint left" @click="scrollBy(-1)"><Icon name="chevL" />{{ t('band.hiddenLeft', { n: hidden.left }, hidden.left) }}</button>
        </Tip>
        <Tip v-if="hidden.right" :text="t('band.hintRightTip')">
          <button class="edge-hint right" @click="scrollBy(1)">{{ t('band.hiddenRight', { n: hidden.right }, hidden.right) }}<Icon name="chevR" /></button>
        </Tip>
      </div>
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
