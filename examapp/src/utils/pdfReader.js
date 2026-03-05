import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

// Render every PDF page to a high-res JPEG image
// This bypasses ALL font encoding issues — AI reads pixels, not bytes
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

    // 2.5x scale = crisp enough for AI to read, not too large to send
    const viewport = page.getViewport({ scale: 2.5 })
    const canvas = document.createElement('canvas')
    canvas.width  = viewport.width
    canvas.height = viewport.height

    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    await page.render({ canvasContext: ctx, viewport }).promise

    // JPEG at 90% quality — good OCR quality, smaller payload
    const dataUrl = canvas.toDataURL('image/jpeg', 0.90)
    images.push({
      base64:   dataUrl.split(',')[1],
      mimeType: 'image/jpeg',
      pageNum:  p,
      dataUrl,
    })

    onProgress?.(Math.round((p / total) * 100), p, total)
  }

  return images
}
