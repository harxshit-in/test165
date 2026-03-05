import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

export async function renderPDFToImages(file, onProgress) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise

  const total = pdf.numPages
  const images = []

  for (let p = 1; p <= total; p++) {
    const page = await pdf.getPage(p)

    // 1.8x scale — good enough for Gemini, small enough for Netlify 10s timeout
    const viewport = page.getViewport({ scale: 1.8 })
    const canvas = document.createElement('canvas')
    canvas.width  = viewport.width
    canvas.height = viewport.height

    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport }).promise

    // JPEG at 75% — much smaller payload, Gemini still reads perfectly
    const dataUrl = canvas.toDataURL('image/jpeg', 0.75)
    const base64  = dataUrl.split(',')[1]

    // Skip if image too large (>3MB base64 = ~2.25MB image — Netlify limit)
    if (base64.length > 3 * 1024 * 1024) {
      // Re-render at lower quality
      const dataUrl2 = canvas.toDataURL('image/jpeg', 0.5)
      images.push({ base64: dataUrl2.split(',')[1], mimeType: 'image/jpeg', pageNum: p, dataUrl: dataUrl2 })
    } else {
      images.push({ base64, mimeType: 'image/jpeg', pageNum: p, dataUrl })
    }

    onProgress?.(Math.round((p / total) * 100), p, total)
  }

  return images
}
