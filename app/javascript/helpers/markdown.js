import DOMPurify from 'dompurify'

// marked passes raw html through, so without this a description could run a script for every
// viewer of the map. 'target' is dropped by default, the OSM link of overpassDescription has one.
export function sanitizeMarkdown (desc) {
  desc = DOMPurify.sanitize(desc, { ADD_ATTR: ['target'] })
  // open external and image links in new tab
  desc = desc.replace(/<a(\s+)(href=['"]https?:\/\/|href=['"]\/image)/gi, '<a$1target="_blank" $2')

  return desc
}
