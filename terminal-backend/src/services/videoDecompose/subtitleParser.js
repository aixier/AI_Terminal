import fs from 'fs/promises'

const TIMING_PATTERN = /(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})/
const SEPARATOR = /\r?\n\r?\n+/

const toSeconds = value => {
  if (!value) return 0
  const [timePart, fractionPart] = value.split(/[,.]/)
  const [hours, minutes, seconds] = timePart.split(':').map(Number)
  const milliseconds = fractionPart ? Number(fractionPart.padEnd(3, '0')) : 0
  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000
}

export async function parseSubtitleFile(filePath) {
  const content = await fs.readFile(filePath, 'utf8')
  return parseSubtitleContent(content)
}

export function parseSubtitleContent(content) {
  if (!content) {
    return []
  }

  const blocks = content
    .replace(/\uFEFF/g, '')
    .split(SEPARATOR)
    .map(block => block.trim())
    .filter(Boolean)

  const segments = []

  blocks.forEach(block => {
    const lines = block.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
    if (lines.length < 2) {
      return
    }

    let timingLineIndex = 0
    if (/^\d+$/.test(lines[0])) {
      timingLineIndex = 1
    }

    const timingLine = lines[timingLineIndex]
    const timingMatch = timingLine?.match(TIMING_PATTERN)
    if (!timingMatch) {
      return
    }

    const textLines = lines.slice(timingLineIndex + 1)
    const text = textLines
      .join(' ')
      .replace(/\s+/g, ' ')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim()

    if (!text) {
      return
    }

    const start = toSeconds(timingMatch[1])
    const end = toSeconds(timingMatch[2])
    const duration = Math.max(0, end - start)

    segments.push({
      text,
      start,
      end,
      duration
    })
  })

  return segments
}

export function selectHighlights(segments, options = {}) {
  const { maxHighlights = 5, minQuoteLength = 12 } = options
  if (!Array.isArray(segments) || segments.length === 0) {
    return []
  }

  const indexed = segments.map((segment, index) => ({
    ...segment,
    index
  }))

  const longEnough = indexed.filter(item => (item.text || '').length >= minQuoteLength)
  const candidates = longEnough.length > 0 ? longEnough : indexed

  const picked = new Set()

  for (const item of [...candidates].sort((a, b) => (b.text.length || 0) - (a.text.length || 0))) {
    picked.add(item.index)
    if (picked.size >= maxHighlights) {
      break
    }
  }

  const ordered = indexed
    .filter(item => picked.has(item.index))
    .sort((a, b) => a.start - b.start)
    .slice(0, maxHighlights)

  return ordered.map(item => ({
    text: item.text,
    start: item.start,
    end: item.end,
    duration: item.duration
  }))
}
