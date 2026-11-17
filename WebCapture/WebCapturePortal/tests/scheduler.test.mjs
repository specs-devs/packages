// Run: npm test
import assert from "node:assert/strict"
import {test} from "node:test"
import {cropWindow, outputSize, OUTPUTS} from "../src/model.js"
import * as S from "../src/scheduler.js"

const close = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, a + " vs " + b)

test("crop: 9:16 from the 4:3 frame keeps full height, centred", () => {
  const w = cropWindow(4 / 3, 9 / 16)
  close(w.v0, 0); close(w.v1, 1)
  close((w.u1 - w.u0) * (4 / 3), 9 / 16) // window shape = output shape
  close((w.u0 + w.u1) / 2, 0.5)
})
test("crop: pan moves the window inside the frame, never out", () => {
  const left = cropWindow(4 / 3, 4 / 5, {panX: 0}), right = cropWindow(4 / 3, 4 / 5, {panX: 1})
  close(left.u0, 0); close(right.u1, 1)
})
test("crop: zoom shrinks the window; 16:9 from 4:3 crops height", () => {
  const z = cropWindow(4 / 3, 16 / 9, {zoom: 2})
  close((z.u1 - z.u0), 0.5)
  close((z.u1 - z.u0) * (4 / 3) / ((z.v1 - z.v0)), 16 / 9)
  const a = cropWindow(4 / 3, 16 / 9, {panY: 0})
  close(a.v0, 0); assert.ok(a.v1 < 1)
})
test("crop: fit shows the whole frame with bars", () => {
  const w = cropWindow(4 / 3, 9 / 16, {mode: "fit"})
  assert.ok(w.fit && w.u0 === 0 && w.u1 === 1 && w.v0 < 0 && w.v1 > 1)
  close((w.u1 - w.u0) * (4 / 3) / (w.v1 - w.v0), 9 / 16)
})
test("outputs: presets exist with the right shapes", () => {
  assert.deepEqual([OUTPUTS.device.width, OUTPUTS.device.height], [1464, 1098])
  assert.deepEqual([OUTPUTS.social34.width, OUTPUTS.social34.height], [1080, 1440])
  assert.deepEqual([OUTPUTS.social45.width, OUTPUTS.social45.height], [1080, 1350])
  assert.deepEqual([OUTPUTS.social916.width, OUTPUTS.social916.height], [1080, 1920])
  assert.deepEqual([OUTPUTS.landscape1080.width, OUTPUTS.landscape1080.height], [1920, 1080])
  assert.equal(outputSize("lens", 2).width, 2160)
  for (const f of Object.values(S.PLATFORM_FORMATS)) assert.ok(OUTPUTS[f.preset], f.preset)
})

const future = () => S.toLocalInput(new Date(Date.now() + 3600e3))
function ready() {
  const p = S.newPost({recordingKey: "k", videoName: "clip", durationSec: 20, runAt: new Date(Date.now() + 3600e3).toISOString()})
  p.targets.tiktok = {...p.targets.tiktok, enabled: true, caption: "hello"}
  return p
}
test("validation: caption, limits, past time, YouTube title", () => {
  const p = ready()
  assert.deepEqual(S.scheduleProblems(p), [])
  p.targets.x = {...p.targets.x, enabled: true, caption: "x".repeat(281)}
  assert.match(S.scheduleProblems(p)[0], /X caption is over 280/)
  p.targets.x.caption = "ok"
  p.targets.youtube = {...p.targets.youtube, enabled: true, caption: "c"}
  assert.match(S.scheduleProblems(p).join(), /YouTube Shorts needs a title/)
  assert.match(S.scheduleProblems({...p, runAt: "2000-01-01T00:00:00Z"}).join(), /in the past/)
  assert.match(S.scheduleProblems({...p, durationSec: 70, targets: {...p.targets, snapchat: {...p.targets.snapchat, enabled: true, caption: "s"}}}).join(), /Snapchat Spotlight takes at most 60/)
})
test("presets follow the ticked platforms", () => {
  const p = ready()
  p.targets.x = {...p.targets.x, enabled: true, caption: "a"}
  p.targets.linkedin = {...p.targets.linkedin, enabled: true, caption: "a"}
  assert.deepEqual(S.presetsFor(p).sort(), ["social45", "social916", "square1080"])
})
test("manual engine: approve, due, record results, retry", async () => {
  let p = await S.approvePost(ready(), S.manualEngine, "me")
  assert.equal(p.status, "scheduled"); assert.equal(p.jobId, "manual-" + p.id)
  assert.ok(!S.isDue(p)); assert.ok(S.isDue(p, Date.parse(p.runAt) + 1))
  p = S.setTargetResult(p, "tiktok", {ok: false, error: "nope"})
  assert.equal(p.status, "failed"); assert.ok(S.canRetry(p))
  p = S.retryFailed(p)
  assert.equal(p.status, "review"); assert.equal(p.targets.tiktok.status, "pending")
  p = S.setTargetResult(p, "tiktok", {ok: true, url: "https://tiktok.com/@a/video/1"})
  assert.equal(p.status, "posted"); assert.equal(S.queueSection(p.status), "posted")
})
test("approve fails cleanly on problems and engine errors", async () => {
  await assert.rejects(() => S.approvePost(S.newPost({recordingKey: "k"}), S.manualEngine), /platform/)
  const bad = {name: "bad", schedule: async () => { throw new Error("down") }, cancel: async () => {}}
  const p = await S.approvePost(ready(), bad)
  assert.equal(p.status, "review"); assert.equal(p.error, "down")
})
test("engine job folds into the row", () => {
  let p = {...ready(), status: "scheduled", jobId: "j"}
  p = S.applyEngineJob(p, {id: "j", runAt: p.runAt, status: "completed", results: [{platform: "tiktok", ok: true, url: "u"}], finishedAt: "t"})
  assert.equal(p.status, "posted"); assert.equal(p.targets.tiktok.url, "u")
  assert.equal(S.applyEngineJob(p, {id: "j", runAt: p.runAt, status: "completed", results: [{platform: "tiktok", ok: true, url: "u"}]}), p)
})
test("queue: parse is strict on ids and times, store survives bad storage", () => {
  assert.throws(() => S.parseQueue({posts: [{runAt: "2030-01-01T00:00:00Z"}]}), /needs an id/)
  assert.throws(() => S.parseQueue({posts: [{id: "a", runAt: "nope"}]}), /valid time/)
  const a = ready()
  assert.throws(() => S.parseQueue({posts: [a, a]}), /Duplicate/)
  const mem = new Map()
  const store = S.createStore({getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v)})
  store.save(S.upsertPost({updatedAt: "", posts: []}, a))
  assert.equal(store.load().posts[0].id, a.id)
  assert.deepEqual(S.createStore({getItem() { throw new Error("blocked") }, setItem() { throw new Error("blocked") }}).load().posts, [])
  assert.equal(S.importQueue(S.exportQueue(store.load())).posts.length, 1)
})
test("brand rule drops hashtags and says SPECS", () => {
  assert.equal(S.brandCaption("New Snap Spectacles demo #ar #lens #specs"), "New SPECS demo")
})

import {logoRect, logoSvg, LOGO_ASPECT} from "../src/logo.js"
test("logo: placement corners, margin, aspect, colour", () => {
  const tr = logoRect(1000, 1000, {place: "top-right", size: 0.2})
  close(tr.w, 200); close(tr.h, 200 / LOGO_ASPECT)
  close(tr.x + tr.w, 1000 - 45); close(tr.y, 45)
  const c = logoRect(1000, 1000, {place: "center", size: 0.2})
  close(c.x + c.w / 2, 500); close(c.y + c.h / 2, 500)
  const bl = logoRect(1080, 1920, {place: "bottom-left"})
  close(bl.x, 1080 * 0.045); close(bl.y + bl.h, 1920 - 1080 * 0.045)
  assert.match(logoSvg("#000000"), /fill="#000000"/)
})

import {PRESETS, PRESET_BASE, applyPreset, defaultEdits} from "../src/model.js"
test("presets: at least ten, each fully resets the look and stays in range", () => {
  const names = Object.keys(PRESETS)
  assert.ok(names.length >= 10)
  for (const n of names) {
    const e = defaultEdits()
    applyPreset(e, "soliduiCrisp") // leftovers from another preset must not survive
    applyPreset(e, n)
    assert.equal(e.preset, n)
    assert.ok(["device", "natural"].includes(e.device.mode))
    for (const k of ["opacity", "tint", "solid"]) assert.ok(e.device[k] >= 0 && e.device[k] <= 1, n + " " + k)
    assert.ok(e.fx.warmth >= -1 && e.fx.warmth <= 1 && e.fx.exposure >= 0.5 && e.fx.exposure <= 1.8 && e.fx.contrast >= 0.6 && e.fx.contrast <= 1.6)
    if (!(PRESETS[n].fx && PRESETS[n].fx.objectShadow)) assert.equal(e.fx.objectShadow.on, false)
    assert.ok(e.fx.warmth <= 0 && e.fx.warmth >= -0.3, n + " leans cool, gently")
    assert.equal(e.fx.vignette, 0)
    assert.equal(e.device.mode, "device")
    assert.equal(e.device.hands, true) // untouched
  }
  const e = applyPreset(defaultEdits(), "nope")
  assert.equal(e.preset, undefined)
})
