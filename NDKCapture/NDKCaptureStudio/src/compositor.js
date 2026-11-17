// SPECS Inc. 2027
// Compositor: draws the visual layers (camera, ar, ui) on a canvas in z order with per-layer
// opacity, blend mode and transform. Used for the live view, the editor and the video export.

const BLEND = {normal: "source-over", add: "lighter", screen: "screen", multiply: "multiply"}

export class ImageCache {
  constructor(max = 96) {
    this.max = max
    this.map = new Map()
  }

  /** Returns a decoded image for a base64 JPEG, or null while it is still decoding. */
  get(key, base64) {
    let e = this.map.get(key)
    if (!e) {
      const img = new Image()
      e = {img: img, ready: false}
      img.onload = () => (e.ready = true)
      img.src = "data:image/jpeg;base64," + base64
      this.map.set(key, e)
      if (this.map.size > this.max) this.map.delete(this.map.keys().next().value)
    }
    return e.ready ? e.img : null
  }
}

/** Draw one composite. layers: [{image, settings}] sorted by z. */
export function composite(ctx, width, height, layers, background = "#0b0d12") {
  ctx.save()
  ctx.globalCompositeOperation = "source-over"
  ctx.globalAlpha = 1
  ctx.fillStyle = background
  ctx.fillRect(0, 0, width, height)
  for (const l of layers) {
    if (!l.image) continue
    const s = l.settings
    const t = s.transform || {x: 0, y: 0, scale: 1, rotation: 0}
    const iw = l.image.naturalWidth || l.image.width
    const ih = l.image.naturalHeight || l.image.height
    if (!iw || !ih) continue
    // Fit the layer inside the output (contain), then apply the layer transform.
    const fit = Math.min(width / iw, height / ih)
    const w = iw * fit * (t.scale || 1)
    const h = ih * fit * (t.scale || 1)
    ctx.save()
    ctx.globalAlpha = Math.max(0, Math.min(1, s.opacity))
    ctx.globalCompositeOperation = BLEND[s.blend] || "source-over"
    ctx.translate(width / 2 + (t.x || 0) * width, height / 2 + (t.y || 0) * height)
    ctx.rotate(((t.rotation || 0) * Math.PI) / 180)
    ctx.drawImage(l.image, -w / 2, -h / 2, w, h)
    ctx.restore()
  }
  ctx.restore()
}

export function drawTitle(ctx, width, height, text) {
  if (!text) return
  ctx.save()
  ctx.font = "600 " + Math.round(height / 18) + "px system-ui, sans-serif"
  ctx.textAlign = "center"
  ctx.fillStyle = "rgba(0,0,0,0.45)"
  const y = height - height / 10
  const w = ctx.measureText(text).width + height / 12
  ctx.fillRect(width / 2 - w / 2, y - height / 14, w, height / 10)
  ctx.fillStyle = "#fff"
  ctx.fillText(text, width / 2, y)
  ctx.restore()
}
