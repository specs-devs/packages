// Unit tests for the Studio model: node --test tests/model.test.mjs
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {test} from "node:test"
import {
  describe,
  drawList,
  editedDuration,
  frameIndexAt,
  loadRecording,
  parsePacketChunk,
  parsePackets,
  parseTrackFile,
  playRanges,
  settingsAt,
  sourceTime
} from "../src/model.js"

const dir = new URL("../samples/demo/", import.meta.url)
const read = async (f) => {
  try {
    return readFileSync(new URL(f, dir), "utf8")
  } catch (e) {
    return ""
  }
}
const load = async (edits) => loadRecording(JSON.parse(await read("manifest.json")), edits || null, read)

test("loads every layer chunk of the sample", async () => {
  const rec = await load()
  const d = describe(rec)
  assert.equal(d.duration, 4000)
  assert.equal(d.layers.camera.proxyFrames, 24)
  assert.equal(d.layers.ar.proxyFrames, 24)
  assert.equal(d.layers.ui.proxyFrames, 24)
  assert.equal(d.layers.camera.packets, 30)
  assert.equal(d.layers.camera.keyPackets, 2)
  assert.equal(d.markers, 2)
  assert.equal(d.changes, 2)
})

test("settings follow the recorded timeline, then edit overrides", async () => {
  const rec = await load()
  assert.equal(settingsAt(rec, "ar", 1000).opacity, 1)
  assert.equal(settingsAt(rec, "ar", 1600).opacity, 0.5)
  assert.equal(settingsAt(rec, "ui", 3000).transform.scale, 0.6)
  assert.equal(settingsAt(rec, "ui", 3000).transform.x, 0, "partial transform keeps the other fields")
  rec.edits.layers.ar = {override: {opacity: 0.2, blend: "add"}}
  assert.equal(settingsAt(rec, "ar", 1600).opacity, 0.2)
  assert.equal(settingsAt(rec, "ar", 100).blend, "add")
})

test("draw list is z-ordered and respects hidden / disabled layers", async () => {
  const rec = await load()
  assert.deepEqual(
    drawList(rec, 2000).map((l) => l.layer),
    ["camera", "ar", "ui"]
  )
  rec.edits.layers.ar = {override: {z: 5}}
  rec.edits.layers.ui = {hidden: true}
  assert.deepEqual(
    drawList(rec, 2000).map((l) => l.layer),
    ["camera", "ar"]
  )
})

test("trim and cuts map the edited timeline to source time", async () => {
  const rec = await load({trim: {in: 500, out: 3500}, cuts: [{from: 1000, to: 2000}], layers: {}, markers: []})
  assert.deepEqual(playRanges(rec), [
    [500, 1000],
    [2000, 3500]
  ])
  assert.equal(editedDuration(rec), 2000)
  assert.equal(sourceTime(rec, 0), 500)
  assert.equal(sourceTime(rec, 600), 2100)
})

test("frame lookup picks the last frame at or before t", () => {
  const frames = [{t: 0}, {t: 100}, {t: 200}]
  assert.equal(frameIndexAt(frames, -1), -1)
  assert.equal(frameIndexAt(frames, 150), 1)
  assert.equal(frameIndexAt(frames, 999), 2)
})

test("NKC1 packet framing and track files", () => {
  const payload = Buffer.from([0, 0, 0, 1, 0x40, 1, 9, 9])
  const head = Buffer.alloc(16)
  head[0] = 1
  head[1] = 1
  head.writeBigUInt64LE(123456789n, 4)
  head.writeUInt32LE(payload.length, 12)
  const pkt = Buffer.concat([head, payload])
  const parsed = parsePackets(new Uint8Array(pkt))
  assert.equal(parsed.length, 1)
  assert.equal(parsed[0].layer, 1)
  assert.equal(parsed[0].key, true)
  assert.equal(parsed[0].tsNs, 123456789)
  assert.equal(parsed[0].data.length, payload.length)
  assert.equal(parsePacketChunk(pkt.toString("base64") + "\n" + pkt.toString("base64")).length, 2)
  const header = Buffer.from(JSON.stringify({layer: "ar", codec: "hevc"}))
  const len = Buffer.alloc(4)
  len.writeUInt32LE(header.length)
  const file = new Uint8Array(Buffer.concat([Buffer.from("NKC1"), len, header, pkt, pkt.subarray(0, 10)]))
  const track = parseTrackFile(file)
  assert.equal(track.header.codec, "hevc")
  assert.equal(track.packets.length, 1, "a torn trailing packet is ignored")
})

test("rejects files that aren't ndkcapture/1", async () => {
  await assert.rejects(loadRecording({format: "webcapture/1"}, null, read), /ndkcapture\/1/)
})
