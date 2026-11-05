import DOMPurify from 'dompurify'
import { loadStylesheet } from 'helpers/dom'
import { marked } from 'marked'

marked.use({ gfm: true, breaks: true })
export { marked }

// marked passes raw html through, so without this a description could run a script for every
// viewer of the map. 'target' is dropped by default, the OSM link of overpassDescription has one.
export function sanitizeMarkdown (desc) {
  desc = DOMPurify.sanitize(desc, { ADD_ATTR: ['target'] })
  // open external and image links in new tab
  desc = desc.replace(/<a(\s+)(href=['"]https?:\/\/|href=['"]\/image)/gi, '<a$1target="_blank" $2')

  return desc
}

export function renderMarkdown (text) {
  return sanitizeMarkdown(marked(text || ''))
}

// https://github.com/Ionaru/easy-markdown-editor
// Callers must await this before tearing down an old editor, then tear down and call
// markdownEditor() without another await in between, or two calls can create duplicate editors.
export async function loadMarkdownEditor () {
  await import('easymde') // import EasyMDE UMD bundle
  // EasyMDE defaults to a broken font-awesome build from bootstrapcdn; load a working one ourselves
  // (v4-shims maps EasyMDE's old "fa fa-*" classes to FA6 icons)
  loadStylesheet('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css')
  loadStylesheet('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/v4-shims.min.css')
}

export function markdownEditor (element, onUpdate) {
  return new window.EasyMDE({
    element,
    placeholder: window.__('Add a description text'),
    toolbar: ["bold", "italic", "heading", "code", "table", "|", "unordered-list", "horizontal-rule", "|", "link", "image", "preview"],
    minHeight: '4em',
    spellChecker: false,
    autoDownloadFontAwesome: false,
    status: [{ className: 'autosave', onUpdate }]
  })
}
