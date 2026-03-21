const ICON_SIZE = 80

export function generateWaypointIcon(color: string, number: number): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = ICON_SIZE
  canvas.height = ICON_SIZE
  const ctx = canvas.getContext('2d')!

  const cx = 40
  const cy = 32
  const r = 22

  // Teardrop pin shape
  ctx.beginPath()
  ctx.arc(cx, cy, r, Math.PI, 0)
  ctx.lineTo(cx, 72)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()

  // White border
  ctx.beginPath()
  ctx.arc(cx, cy, r, Math.PI, 0)
  ctx.lineTo(cx, 72)
  ctx.closePath()
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = 3.5
  ctx.stroke()

  // Number
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 20px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(number), cx, cy)

  return ctx.getImageData(0, 0, ICON_SIZE, ICON_SIZE)
}
