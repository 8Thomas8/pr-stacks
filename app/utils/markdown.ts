import DOMPurify from 'dompurify'
import { Marked } from 'marked'

// Headings become bold paragraphs: markdown titles must not break the drawer's heading outline.
const marked = new Marked({
  gfm: true,
  breaks: true,
  async: false,
  renderer: {
    heading({ tokens }) {
      return `<p><strong>${this.parser.parseInline(tokens)}</strong></p>\n`
    },
  },
})

const PURIFY = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['style', 'form', 'button', 'textarea', 'select', 'video', 'audio', 'source', 'track', 'picture'],
  FORBID_ATTR: ['style', 'id', 'name'],
  RETURN_DOM_FRAGMENT: true as const,
}

// Images load from GitHub hosts only; any other host could track who opens which PR.
const TRUSTED_IMG = /^https:\/\/([\w-]+\.)*(github\.com|githubusercontent\.com)\//i
const GITHUB = 'https://github.com/'

let hooked = false

export function renderMarkdown(md: string, labels: { suggestion: string }) {
  if (!hooked) {
    // Comments must not reuse the app's classes (full-screen overlays, fake dialogs): keep only code languages.
    DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
      if (data.attrName === 'class') data.keepAttr = node.nodeName === 'CODE' && /^language-[\w-]+$/.test(data.attrValue)
    })
    hooked = true
  }
  const frag = DOMPurify.sanitize(marked.parse(md) as string, PURIFY)

  frag.querySelectorAll('a[href]').forEach((a) => {
    a.setAttribute('href', new URL(a.getAttribute('href')!, GITHUB).href)
    a.setAttribute('target', '_blank')
    a.setAttribute('rel', 'noopener noreferrer')
  })
  frag.querySelectorAll('img').forEach((img) => {
    const src = new URL(img.getAttribute('src') ?? '', GITHUB).href
    if (TRUSTED_IMG.test(src)) {
      img.setAttribute('src', src)
      img.setAttribute('referrerpolicy', 'no-referrer')
      img.setAttribute('loading', 'lazy')
      return
    }
    const a = document.createElement('a')
    if (/^https?:/.test(src)) Object.assign(a, { href: src, target: '_blank', rel: 'noopener noreferrer' })
    a.textContent = img.getAttribute('alt') || src
    img.replaceWith(a)
  })
  frag.querySelectorAll('input').forEach((input) => {
    if (input.getAttribute('type') === 'checkbox') input.setAttribute('disabled', '')
    else input.remove()
  })
  frag.querySelectorAll('pre, table').forEach(el => el.setAttribute('tabindex', '0'))
  frag.querySelectorAll('pre > code.language-suggestion').forEach((code) => {
    const pre = code.parentElement!
    const box = document.createElement('div')
    box.className = 'md-sugg'
    const head = document.createElement('div')
    head.className = 'md-sugg-h'
    head.textContent = labels.suggestion
    pre.replaceWith(box)
    box.append(head, pre)
  })

  const out = document.createElement('div')
  out.append(frag)
  return out.innerHTML
}
