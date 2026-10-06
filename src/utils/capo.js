// Capo line printed in exports ("Capo en N" / "Sin capo").
export const capoLabel = (capo) => `Capo en ${capo}`
export const NO_CAPO_LABEL = 'Sin capo'
export const CAPO_LINE_RE = /^capo\s+en\s+(\d+)$/i
export const NO_CAPO_LINE_RE = /^sin\s+capo$/i

// The capo line to print for `section`, or null. Untitled sections continue the
// group above, so a capo is only restated when it changes (including back to none).
export function capoLineFor(section, prev) {
  const capo = section.capo || 0
  const continues = !section.title && prev
  if (continues) {
    const prevCapo = prev.capo || 0
    if (capo === prevCapo) return null
    return capo ? capoLabel(capo) : NO_CAPO_LABEL
  }
  return capo ? capoLabel(capo) : null
}
