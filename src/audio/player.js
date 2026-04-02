/**
 * Guitar string synthesizer using Karplus-Strong algorithm.
 */

let audioCtx = null

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

const OPEN_FREQS = [329.63, 246.94, 196.00, 146.83, 110.00, 82.41]

function fretToFreq(openFreq, fret) {
  return openFreq * Math.pow(2, fret / 12)
}

/**
 * Play a single plucked string note. Returns the AudioBufferSourceNode.
 */
export function playNote(stringIndex, fret, when = 0, openFreqs = OPEN_FREQS) {
  const ctx = getCtx()
  const t = when || ctx.currentTime
  const freq = fretToFreq(openFreqs[stringIndex], fret)
  return karplusStrong(ctx, freq, t)
}

function karplusStrong(ctx, frequency, when) {
  const sampleRate = ctx.sampleRate
  const N = Math.round(sampleRate / frequency)
  const bufferSize = sampleRate * 2
  const buffer = ctx.createBuffer(1, bufferSize, sampleRate)
  const data = buffer.getChannelData(0)

  const delayLine = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    delayLine[i] = Math.random() * 2 - 1
  }

  let prev = 0
  for (let i = 0; i < bufferSize; i++) {
    const idx = i % N
    const curr = delayLine[idx]
    const newVal = 0.996 * 0.5 * (curr + prev)
    delayLine[idx] = newVal
    data[i] = newVal
    prev = curr
  }

  const source = ctx.createBufferSource()
  source.buffer = buffer

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.5, when)
  gain.gain.exponentialRampToValueAtTime(0.001, when + 1.8)

  source.connect(gain)
  gain.connect(ctx.destination)
  source.start(when)
  source.stop(when + 2)

  return source
}

/**
 * Play a column, collecting source nodes into the provided set.
 */
function playColumnCollecting(col, when, openFreqs, nodes) {
  const ctx = getCtx()
  const t = when || ctx.currentTime
  col.forEach((fret, si) => {
    if (fret !== null) {
      const node = playNote(si, fret, t + si * 0.003, openFreqs)
      nodes.add(node)
      // Remove from set once it finishes naturally
      node.onended = () => nodes.delete(node)
    }
  })
}

/**
 * Play the full tab from startCol. Returns a cancel function.
 */
export function playTab(tab, startCol = 0, endCol = null, onColumnChange) {
  const ctx = getCtx()
  const { columns, tempo, tuning } = tab
  const openFreqs = tuningToFreqs(tuning)
  const end = endCol ?? columns.length - 1
  const secondsPerCol = (60 / tempo) / 2 // each col = 8th note

  let cancelled = false
  const timeouts = []
  const activeNodes = new Set()

  const start = ctx.currentTime + 0.05

  for (let ci = startCol; ci <= end; ci++) {
    const t = start + (ci - startCol) * secondsPerCol
    playColumnCollecting(columns[ci], t, openFreqs, activeNodes)

    const delay = (t - ctx.currentTime) * 1000
    const id = setTimeout(() => {
      if (!cancelled && onColumnChange) onColumnChange(ci)
    }, delay)
    timeouts.push(id)
  }

  const totalMs = (end - startCol + 1) * secondsPerCol * 1000
  timeouts.push(setTimeout(() => {
    if (!cancelled && onColumnChange) onColumnChange(null)
  }, totalMs + 100))

  return function cancel() {
    cancelled = true
    timeouts.forEach(clearTimeout)
    // Stop all in-flight audio nodes immediately
    const now = getCtx().currentTime
    activeNodes.forEach(node => {
      try { node.stop(now) } catch (_) {}
    })
    activeNodes.clear()
    if (onColumnChange) onColumnChange(null)
  }
}

// Base frequency of each note name (E2 octave as reference)
const NOTE_BASE_FREQ = {
  'C': 65.41, 'C#': 69.30, 'DB': 69.30, 'D': 73.42, 'D#': 77.78, 'EB': 77.78,
  'E': 82.41, 'F': 87.31, 'F#': 92.50, 'GB': 92.50, 'G': 98.00, 'G#': 103.83,
  'AB': 103.83, 'A': 110.00, 'A#': 116.54, 'BB': 116.54, 'B': 123.47,
}

// Standard open-string frequencies (index 0 = high string)
const STD_FREQS = [329.63, 246.94, 196.00, 146.83, 110.00, 82.41]

// Find the octave of `note` closest to `targetFreq`
function closestOctave(note, targetFreq) {
  let freq = NOTE_BASE_FREQ[note.toUpperCase()]
  if (!freq) return targetFreq
  while (freq * 2 <= targetFreq * 1.3) freq *= 2
  while (freq > targetFreq * 1.3) freq /= 2
  return freq
}

function tuningToFreqs(tuning) {
  return tuning.map((note, i) => closestOctave(note, STD_FREQS[i]))
}

export function resumeAudio() {
  getCtx()
}
