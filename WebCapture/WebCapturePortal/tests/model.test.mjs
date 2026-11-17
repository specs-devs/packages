// Run: npm test   (or: node --test tests/model.test.mjs, from WebCapturePortal/)
import assert from "node:assert/strict"
import {test} from "node:test"
import {
  advance,
  applyOffset,
  clipLength,
  clipTimeForSource,
  frameAt,
  keyIndex,
  normalizeCuts,
  normalizeRecording,
  sampleTrack,
  sceneBounds,
  shotAt,
  sourceTimeForClip,
  titlesAt,
  toJson,
  trimRange
} from "../src/model.js"

function rec(extraEdits) {
  // cube moves +x 10 cm/s, sampled every 0.1 s; sphere never moves (one key).
  const t = [],
    v = []
  for (let i = 0; i <= 100; i++) {
    t.push(i / 10)
    v.push(i, 0, 0, 0, 0, 0, 1, 1, 1, 1)
  }
  return normalizeRecording({
    format: "webcapture/1",
    meta: {id: "rec-1", name: "Test", duration: 10},
    objects: [
      {id: "cube", name: "Cube", primitive: "box", color: [1, 0, 0, 1]},
      {id: "sphere", name: "Sphere", primitive: "sphere", color: [0, 1, 0, 1]}
    ],
    tracks: {cube: {t, v}, sphere: {t: [0], v: [5, 5, 5, 0, 0, 0, 1, 1, 1, 1]}},
    camera: {t: [0, 10], v: [0, 0, 100, 0, 0, 0, 1, 60, 0, 0, 100, 0, 0, 0, 1, 60]},
    params: [
      {t: 0, id: "sphere", params: {visible: true}},
      {t: 5, id: "sphere", params: {visible: false}}
    ],
    markers: [{t: 2, label: "hit"}],
    edits: extraEdits
  })
}

test("rejects other formats and bad tracks", () => {
  assert.throws(() => normalizeRecording({format: "x"}), /webcapture\/1/)
  assert.throws(
    () => normalizeRecording({format: "webcapture/1", meta: {id: "a"}, objects: [], tracks: {a: {t: [0], v: [1]}}}),
    /bad length/
  )
})

test("fills default edits", () => {
  const r = rec()
  assert.equal(r.edits.speed, 1)
  assert.equal(r.edits.camera.mode, "recorded")
  assert.deepEqual(r.edits.cuts, [])
})

test("keyIndex is a floor search", () => {
  assert.equal(keyIndex([0, 1, 2], -1), -1)
  assert.equal(keyIndex([0, 1, 2], 0), 0)
  assert.equal(keyIndex([0, 1, 2], 1.5), 1)
  assert.equal(keyIndex([0, 1, 2], 9), 2)
})

test("samples interpolate close keys and hold across gaps", () => {
  const r = rec()
  assert.ok(Math.abs(sampleTrack(r.tracks.cube.t, r.tracks.cube.v, 10, 2.55)[0] - 25.5) < 1e-9)
  // a single key holds forever
  assert.equal(sampleTrack([0], [5, 5, 5, 0, 0, 0, 1, 1, 1, 1], 10, 9)[0], 5)
  // keys 2 s apart: hold the earlier value (only changes were stored)
  assert.equal(sampleTrack([0, 2], [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 10, 0, 0, 0, 0, 0, 1, 1, 1, 1], 10, 1)[0], 0)
})

test("slerp keeps quaternions unit length", () => {
  const s = Math.SQRT1_2
  const q = sampleTrack([0, 0.1], [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, s, 0, s, 1, 1, 1], 10, 0.05)
  assert.ok(Math.abs(Math.hypot(q[3], q[4], q[5], q[6]) - 1) < 1e-9)
})

test("frameAt applies params and overrides", () => {
  const r = rec({objects: {cube: {hidden: true}, sphere: {color: [0, 0, 1, 1], offset: [1, 2, 3, 0, 0, 0, 2]}}})
  const f = frameAt(r, 1)
  const cube = f.objects.find((o) => o.id === "cube")
  const sphere = f.objects.find((o) => o.id === "sphere")
  assert.equal(cube.visible, false)
  assert.deepEqual(sphere.color, [0, 0, 1, 1])
  assert.deepEqual(sphere.pose.slice(0, 3), [6, 7, 8])
  assert.equal(sphere.pose[7], 2)
  assert.equal(frameAt(r, 6).objects.find((o) => o.id === "sphere").visible, false) // param key at t=5
  assert.equal(f.camera[7], 60)
})

test("offset rotation composes with the recorded rotation", () => {
  const p = applyOffset([0, 0, 0, 0, 0, 0, 1, 1, 1, 1], [0, 0, 0, 0, 90, 0, 1])
  assert.ok(Math.abs(p[4] - Math.SQRT1_2) < 1e-9 && Math.abs(p[6] - Math.SQRT1_2) < 1e-9)
})

test("trim, cuts and speed map clip time to source time", () => {
  const r = rec({
    trim: [1, 9],
    cuts: [
      {start: 4, end: 5},
      {start: 4.5, end: 6}
    ],
    speed: 2
  })
  assert.deepEqual(trimRange(r), [1, 9])
  assert.deepEqual(normalizeCuts(r.edits.cuts, 10), [{start: 4, end: 6}])
  assert.equal(clipLength(r), (8 - 2) / 2)
  assert.equal(sourceTimeForClip(r, 0), 1)
  assert.equal(sourceTimeForClip(r, 1), 3) // 1 s clip × 2 = 2 s source after the in point
  assert.equal(sourceTimeForClip(r, 2), 7) // 1 + 4 = 5 → jumps the 2 s cut → 7
  assert.equal(sourceTimeForClip(r, 99), 9) // clamped at the out point
  assert.equal(clipTimeForSource(r, 7), 2)
  assert.equal(clipTimeForSource(r, 5), 1.5) // inside the cut maps to the cut
})

test("preview playback skips cuts and loops inside the trim", () => {
  const r = rec({trim: [1, 9], cuts: [{start: 4, end: 6}]})
  assert.equal(advance(r, 3.9, 0.2).t, 6)
  const end = advance(r, 8.95, 0.1)
  assert.equal(end.looped, true)
  assert.equal(end.t, 1)
})

test("shots ease between keys", () => {
  const shots = [
    {t: 0, pose: [0, 0, 0, 0, 0, 0], fov: 40},
    {t: 2, pose: [10, 0, 0, 0, 0, 0], fov: 60}
  ]
  assert.equal(shotAt(shots, -1).pose[0], 0)
  assert.equal(shotAt(shots, 1).pose[0], 5)
  assert.equal(shotAt(shots, 1).fov, 50)
  assert.equal(shotAt(shots, 5).pose[0], 10)
})

test("titles by clip time, bounds, ASCII-safe JSON", () => {
  const r = rec({titles: [{text: "Héllo ✨", start: 1, end: 2}]})
  assert.equal(titlesAt(r, 1.5).length, 1)
  assert.equal(titlesAt(r, 2.5).length, 0)
  assert.deepEqual(sceneBounds(r), [0, 0, 0, 100, 5, 5])
  const json = toJson(r)
  assert.ok(/^[\x00-\x7f]*$/.test(json))
  assert.equal(JSON.parse(json).edits.titles[0].text, "Héllo ✨")
})
