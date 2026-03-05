/**
 * OMR Answer Sheet Processor using Canvas
 * Detects filled circles in a grid pattern
 */

export function processOMRImage(canvas, rows, cols = 4) {
  const ctx = canvas.getContext('2d')
  const { width, height } = canvas
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data

  // Convert to grayscale
  const gray = new Uint8ClampedArray(width * height)
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2]
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
  }

  // Divide image into a rows × cols grid
  const cellW = Math.floor(width / cols)
  const cellH = Math.floor(height / rows)
  const answers = []

  for (let row = 0; row < rows; row++) {
    const rowDarkness = []
    for (let col = 0; col < cols; col++) {
      let totalDark = 0
      let count = 0
      const x0 = col * cellW, y0 = row * cellH
      for (let y = y0 + 4; y < y0 + cellH - 4; y++) {
        for (let x = x0 + 4; x < x0 + cellW - 4; x++) {
          const pixel = gray[y * width + x]
          if (pixel < 100) totalDark++ // dark pixel = filled
          count++
        }
      }
      rowDarkness.push(count > 0 ? totalDark / count : 0)
    }

    // Find the darkest cell → that's the marked answer
    const maxDarkness = Math.max(...rowDarkness)
    const threshold = 0.15 // at least 15% dark pixels to count as filled
    if (maxDarkness > threshold) {
      const selectedIdx = rowDarkness.indexOf(maxDarkness)
      answers.push(['A', 'B', 'C', 'D'][selectedIdx] ?? null)
    } else {
      answers.push(null) // unanswered
    }
  }

  return answers
}

export async function captureFrame(videoEl) {
  const canvas = document.createElement('canvas')
  canvas.width = videoEl.videoWidth
  canvas.height = videoEl.videoHeight
  canvas.getContext('2d').drawImage(videoEl, 0, 0)
  return canvas
}
