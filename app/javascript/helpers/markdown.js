import DOMPurify from 'dompurify'
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
}

export function markdownEditor (element, onUpdate) {
  const editor = new window.EasyMDE({
    element,
    placeholder: window.__('Add a description text'),
    toolbar: ["bold", "italic", "heading", "code", "table", "|", "unordered-list", "horizontal-rule", "|", "link", "image", "preview"],
    minHeight: '4em',
    spellChecker: false,
    autoDownloadFontAwesome: false,
    status: [{ className: 'autosave', onUpdate }]
  })
  // Bootstrap Icons, which every page loads, in place of EasyMDE's Font Awesome classes.
  // EasyMDE 2.20 ignores its iconClassMap option, so the classes get swapped on the buttons.
  Object.entries(TOOLBAR_ICONS).forEach(([name, icon]) => {
    editor.toolbarElements[name].querySelector('i').className = `bi bi-${icon}`
  })
  return editor
}

const TOOLBAR_ICONS = {
  bold: 'type-bold',
  italic: 'type-italic',
  heading: 'type-h1',
  code: 'code',
  table: 'table',
  'unordered-list': 'list-ul',
  'horizontal-rule': 'dash-lg',
  link: 'link-45deg',
  image: 'image',
  preview: 'eye'
}
