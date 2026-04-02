import { describe, it, expect } from 'vitest'
import { fretToChar, charToFret } from '../utils/fret.js'

describe('fretToChar', () => {
  it('returns - for null', () => expect(fretToChar(null)).toBe('-'))
  it('converts 0–9 to digit chars', () => {
    for (let i = 0; i <= 9; i++) expect(fretToChar(i)).toBe(String(i))
  })
  it('converts 10–24 to a–o', () => {
    for (let i = 10; i <= 24; i++) expect(fretToChar(i)).toBe(String.fromCharCode('a'.charCodeAt(0) + i - 10))
  })
})

describe('charToFret', () => {
  it('converts digit chars to frets 0–9', () => {
    for (let i = 0; i <= 9; i++) expect(charToFret(String(i))).toBe(i)
  })
  it('converts a–o to frets 10–24', () => {
    for (let i = 0; i <= 14; i++) {
      const ch = String.fromCharCode('a'.charCodeAt(0) + i)
      expect(charToFret(ch)).toBe(10 + i)
    }
  })
  it('is case-insensitive for a–o', () => {
    expect(charToFret('A')).toBe(10)
    expect(charToFret('O')).toBe(24)
  })
  it('returns null for invalid chars', () => {
    expect(charToFret('p')).toBeNull()
    expect(charToFret('z')).toBeNull()
    expect(charToFret('-')).toBeNull()
    expect(charToFret('')).toBeNull()
  })
  it('roundtrips fretToChar -> charToFret', () => {
    for (let i = 0; i <= 24; i++) expect(charToFret(fretToChar(i))).toBe(i)
  })
})
