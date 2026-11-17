// End-to-end test of the portal against a running WebCapture plugin (Lens Studio open, Preview playing).
//   npm i --no-save playwright-core && node tests/portal.e2e.mjs [http://127.0.0.1:47790]
// Uses the installed Google Chrome (set CHROME=/path/to/chrome to override). Exits non-zero on failure.
import assert from "node:assert/strict"
import {chromium} from "playwright-core"

const base = process.argv[2] || "http://127.0.0.1:47790"
const exe =
  process.env.CHROME ||
  (process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : process.platform === "win32"
      ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
      : "/usr/bin/google-chrome")
const api = async (path, init) => {
  const r = await fetch(base + path, init)
  assert.ok(r.ok, path + " " + r.status)
  return r.json()
}
const step = (m) => console.log("✓ " + m)

const browser = await chromium.launch({
  executablePath: exe,
  headless: true,
  args: ["--use-gl=angle", "--autoplay-policy=no-user-gesture-required"]
})
const page = await browser.newPage({viewport: {width: 1440, height: 900}})
const errors = []
page.on("pageerror", (e) => errors.push(String(e)))
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text())
})
try {
  await page.goto(base + "/", {waitUntil: "load"})
  await page.waitForSelector("#view-library.active")
  step("The portal opens on Recordings (no Capture tab)")
  assert.equal(await page.$("button[data-view=live]"), null, "there is no Capture tab")

  // The portal cannot start or stop a capture: only the Lens can.
  const denied = await fetch(base + "/api/command", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({action: "start"})
  })
  assert.equal(denied.status, 403, "the plugin refuses start/stop commands from the portal")
  assert.equal(await page.$("#recStart"), null, "the portal has no Record button")
  step("Step 2 · the portal cannot start or stop a capture (Lens only)")

  await page.click("button[data-view=library]")
  await page.waitForSelector("#libRows tr")
  const rows = await page.$$eval("#libRows tr", (trs) => trs.length)
  assert.ok(rows >= 1)
  step("Library lists " + rows + " recording(s)")
  await page.click("#libRows tr:last-child button.primary")
  await page.waitForFunction(
    () => window.webcapture.state.rec && window.webcapture.visibleObjects("editor") > 0,
    null,
    {timeout: 10000}
  )
  const ed = await page.evaluate(() => ({
    name: window.webcapture.state.rec.meta.name,
    n: window.webcapture.state.rec.objects.length,
    d: window.webcapture.state.rec.meta.duration,
    key: window.webcapture.state.origin.key
  }))
  step('Step 3 · editor opened "' + ed.name + '" (' + ed.n + " objects, " + ed.d.toFixed(1) + " s)")

  // Edits: trim, a cut, speed, look, title, free camera + a shot, object colour.
  await page.evaluate(() => {
    const w = window.webcapture
    const r = w.state.rec
    const d = r.meta.duration
    w.state.t = d * 0.1
    document.getElementById("edIn").click()
    w.state.t = d * 0.9
    document.getElementById("edOut").click()
    w.state.t = d * 0.4
    document.getElementById("edCut").click()
    w.state.t = d * 0.5
    document.getElementById("edCut").click()
    w.state.t = d * 0.2
  })
  await page.selectOption("#edLook", "blueprint")
  await page.fill("#titleText", "Web Capture test")
  await page.click("#titleAdd")
  await page.selectOption("#edCamera", "orbit")
  await page.click("#edShotAdd")
  const edits = await page.evaluate(() => JSON.parse(JSON.stringify(window.webcapture.state.rec.edits)))
  assert.equal(edits.cuts.length, 1)
  assert.equal(edits.titles.length, 1)
  assert.equal(edits.camera.shots.length, 1)
  assert.equal(edits.look, "blueprint")
  step("Edits: trim " + edits.trim.map((x) => x.toFixed(2)).join("–") + ", 1 cut, look, title, camera shot")
  await page.waitForTimeout(400)
  if (process.env.SHOTS) await page.screenshot({path: process.env.SHOTS + "/editor.png"})

  const res = await page.evaluate(async () => {
    const r = await window.webcapture.exportVideo({noDownload: true, size: {width: 640, height: 360}})
    return r ? {size: r.blob.size, type: r.type, seconds: r.seconds, w: r.width} : null
  })
  assert.ok(res && res.size > 5000, "video exported: " + JSON.stringify(res))
  step(
    "Export: " +
      res.type +
      " " +
      res.w +
      "px, " +
      res.seconds.toFixed(2) +
      " s clip, " +
      Math.round(res.size / 1024) +
      " KB"
  )

  await page.click("#edSave")
  await page.waitForFunction(() => /Saved/.test(document.getElementById("edSaveState").textContent), null, {
    timeout: 5000
  })
  const saved = await api("/api/recordings/" + encodeURIComponent(ed.key))
  assert.equal(saved.edits.titles[0].text, "Web Capture test")
  assert.equal(saved.edits.cuts.length, 1)
  assert.ok(saved.tracks && Object.keys(saved.tracks).length === ed.n, "tracks untouched")
  step("Save edits: written back to WebCaptureRecordings/ (tracks untouched)")
  assert.deepEqual(
    errors.filter((e) => !/favicon/.test(e)),
    [],
    "no page errors"
  )
  step("No page errors")
} finally {
  await browser.close()
}
