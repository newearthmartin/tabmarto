// Fret <-> character conversion
// 0-9  → '0'-'9'
// 10-24 → 'a'-'o'  (hex-style: a=10, b=11, ... f=15, g=16, ... o=24)

export function fretToChar(fret) {
  if (fret === null) return '-'
  if (fret < 10) return String(fret)
  return String.fromCharCode('a'.charCodeAt(0) + fret - 10)
}

export function charToFret(char) {
  if (/^[0-9]$/.test(char)) return parseInt(char, 10)
  const code = char.toLowerCase().charCodeAt(0)
  const offset = code - 'a'.charCodeAt(0)
  if (offset >= 0 && offset <= 14) return 10 + offset // a=10 ... o=24
  return null
}
