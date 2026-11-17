// Headless browser test of the Studio editor against the bundled sample (no Lens Studio needed):
//   npm i --no-save playwright-core && node tests/studio.e2e.mjs
// Serves this folder on a free port, opens ?recording=samples/demo/, checks every layer decoded,
// the composite is drawn, edits change the output, and a WebM export is produced.
// Uses the installed Google Chrome (CHROME=/path/to/chrome to override). Exits non-zero on failure.
import assert from "node:assert/strict"
import {createReadStream, existsSync, statSync} from "node:fs"
import {createServer} from "node:http"
import {extname, join, normalize} from "node:path"
import {fileURLToPath} from "node:url"
import {chromium} from "playwright-core"

const root = fileURLToPath(new URL("..", import.meta.url))
const types = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml"}
const server = createServer((req, res) => {
  const p = normalize(join(root, decodeURIComponent(req.url.split("?")[0])))
  const file = p.endsWith("/") ? join(p, "index.html") : p
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404)
    return res.end()
  }
  res.writeHead(200, {"Content-Type": types[extname(file)] || "text/plain"})
  createReadStream(file).pipe(res)
}).listen(0, "127.0.0.1")
await new Promise((r) => server.once("listening", r))
const base = "http://127.0.0.1:" + server.address().port + "/"
const exe =
  process.env.CHROME ||
  (process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : process.platform === "win32"
      ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
      : "/usr/bin/google-chrome")
const step = (m) => console.log("✓ " + m)
const browser = await chromium.launch({executablePath: exe, headless: true})
const page = await browser.newPage({viewport: {width: 1440, height: 900}, acceptDownloads: true})
const errors = []
page.on("pageerror", (e) => errors.push(String(e)))
page.on("console", (m) => m.type() === "error" && !/Failed to load resource|api\/live/.test(m.text()) && errors.push(m.text()))
const pixel = () =>
  page.evaluate(() => {
    const c = document.getElementById("edit-canvas")
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data
    let sum = 0
    for (let i = 0; i < d.length; i += 4000) sum += d[i] + d[i + 1] + d[i + 2]
    return sum
  })
try {
  await page.goto(base + "index.html?recording=samples/demo/", {waitUntil: "load"})
  await page.waitForFunction(() => window.ndkcapture && window.ndkcapture.describe && window.ndkcapture.describe(), null, {timeout: 10000})
  const d = await page.evaluate(() => window.ndkcapture.describe())
  assert.equal(d.layers.camera.proxyFrames, 24)
  assert.equal(d.layers.ar.proxyFrames, 24)
  assert.equal(d.layers.ui.proxyFrames, 24)
  assert.equal(d.layers.camera.packets, 30)
  step("recording loaded: 3 visual layers, 30 native packets, " + d.markers + " markers")
  await page.waitForTimeout(800) // images decode
  const before = await pixel()
  assert.ok(before > 0, "composite drawn")
  step("composite drawn (signal " + before + ")")
  await page.evaluate(() => {
    const s = window.ndkcapture.state
    s.rec.edits.layers.camera = {override: {opacity: 0.1}}
  })
  await page.waitForTimeout(300)
  const after = await pixel()
  assert.notEqual(before, after, "layer override changes the composite")
  step("per-layer override applied (camera opacity 0.1)")
  await page.click("#btn-cut")
  const edited = await page.evaluate(() => window.ndkcapture.describe().edited)
  assert.equal(edited, 3000)
  step("cut applied: edited duration " + edited + " ms")
  const download = page.waitForEvent("download", {timeout: 20000})
  await page.evaluate(() => window.ndkcapture.exportVideo())
  const file = await download
  const exp = await page.evaluate(() => window.ndkcapture.lastExport)
  assert.ok(exp && exp.bytes > 1000, "WebM exported")
  step("exported " + file.suggestedFilename() + " (" + exp.bytes + " bytes)")
  assert.deepEqual(errors, [], "no page errors")
  step("no page errors")
} finally {
  await browser.close()
  server.close()
}
