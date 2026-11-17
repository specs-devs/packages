#!/usr/bin/env node
// Extract the full-quality native tracks of an NDK Capture recording to elementary streams:
//   node tools/nkc-extract.mjs <recording folder | device .nkc file> [out folder]
// Writes <layer>.h265 (Annex-B H.265) and <layer>.aac per layer, plus <layer>.timestamps.json
// (packet timestamps in ms on the session timeline). Then mux / trim with ffmpeg if you like.
import {existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync} from "node:fs"
import {basename, join} from "node:path"
import {parsePacketChunk, parseTrackFile} from "../src/model.js"

const NAMES = ["camera", "ar", "mic"]
const src = process.argv[2]
if (!src) {
  console.error("Usage: node tools/nkc-extract.mjs <recording folder | track.nkc> [out folder]")
  process.exit(2)
}
const out = process.argv[3] || (statSync(src).isDirectory() ? src : ".")
mkdirSync(out, {recursive: true})

function write(layerName, packets, startNs) {
  if (!packets.length) return
  const ext = layerName === "mic" ? ".aac" : ".h265"
  const total = packets.reduce((n, p) => n + p.data.length, 0)
  const buf = new Uint8Array(total)
  let o = 0
  for (const p of packets) {
    buf.set(p.data, o)
    o += p.data.length
  }
  writeFileSync(join(out, layerName + ext), buf)
  const t0 = startNs || packets[0].tsNs
  writeFileSync(join(out, layerName + ".timestamps.json"), JSON.stringify(packets.map((p) => (p.tsNs - t0) / 1e6)))
  console.log(layerName + ext + ": " + packets.length + " packets, " + Math.round(total / 1024) + " KB")
}

if (statSync(src).isDirectory()) {
  const manifest = JSON.parse(readFileSync(join(src, "manifest.json"), "utf8"))
  const startNs = manifest.clock && manifest.clock.nativeStartNs
  const chunks = manifest.chunks || {}
  for (const layer of NAMES) {
    const packets = []
    for (let i = 0; i < (chunks[layer + ".nkc"] || 0); i++) {
      const f = join(src, layer + ".nkc." + i + ".b64")
      if (existsSync(f)) packets.push(...parsePacketChunk(readFileSync(f, "utf8")))
    }
    write(layer, packets, startNs)
  }
  // Device track files copied next to the manifest are picked up too.
  for (const f of readdirSync(src).filter((n) => n.endsWith(".nkc"))) {
    const track = parseTrackFile(new Uint8Array(readFileSync(join(src, f))))
    write(track.header.layer || basename(f, ".nkc"), track.packets, startNs)
  }
} else {
  const track = parseTrackFile(new Uint8Array(readFileSync(src)))
  write(track.header.layer || basename(src, ".nkc"), track.packets, 0)
}
