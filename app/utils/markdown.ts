import DOMPurify from 'dompurify'
import { marked } from 'marked'

let hooked = false

const PURIFY = { FORBID_TAGS: ['style', 'form', 'button', 'textarea', 'select'], FORBID_ATTR: ['style'] }

export function renderMarkdown(md: string) {
  if (!hooked) {
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A') {
        node.setAttribute('target', '_blank')
        node.setAttribute('rel', 'noopener noreferrer')
      }
      if (node.tagName === 'IMG') node.setAttribute('referrerpolicy', 'no-referrer')
      if (node.tagName === 'INPUT') node.setAttribute('disabled', '')
    })
    hooked = true
  }
  return DOMPurify.sanitize(marked.parse(md, { gfm: true, breaks: true, async: false }), PURIFY)
}
