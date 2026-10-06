// Section capo. A capo is set on a titled section and continues through the
// untitled sections after it (they belong to the group of the last titled
// section). The capo stored on an untitled section is ignored.

export const capoLabel = (capo) => `Capo en ${capo}`
export const CAPO_LINE_RE = /^capo\s+en\s+(\d+)$/i

// The capo each section actually plays with.
export function effectiveCapos(sections) {
  const out = []
  sections.forEach((section, i) => {
    out.push(section.title ? (section.capo || 0) : (i > 0 ? out[i - 1] : 0))
  })
  return out
}

// The capo line to print for each section (or null): only titled sections with a capo.
export function capoLines(sections) {
  return sections.map(section => section.title && section.capo ? capoLabel(section.capo) : null)
}
