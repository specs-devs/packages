// Fidelity guard: the Lens panel must use the UIKit design values (src/uikit-tokens.json, extracted from the installed
// UIKit by tools/extract_uikit_tokens.mjs). Change a colour or size in CapturePanel.ts away from UIKit and this fails.
import assert from "node:assert/strict"
import fs from "node:fs"
import {test} from "node:test"
import {fileURLToPath} from "node:url"

const here = fileURLToPath(new URL(".", import.meta.url))
const tokens = JSON.parse(fs.readFileSync(here + "../src/uikit-tokens.json", "utf8"))
const panelPath = here + "../../Assets/WebCapture.lspkg/Scripts/CapturePanel.ts"
const have = fs.existsSync(panelPath)
const src = have ? fs.readFileSync(panelPath, "utf8") : ""
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
const near = (a, b) => a.every((x, i) => Math.abs(x - b[i]) <= 1.5 / 255)
const shapeColor = (name) => {
  const m = new RegExp('"' + name + '"[^\\n]*?\\[([0-9.]+), ([0-9.]+), ([0-9.]+), 1\\]').exec(src)
  assert.ok(m, name + " colour not found in CapturePanel.ts")
  return [+m[1], +m[2], +m[3]]
}

test("uikit tokens were extracted", () => {
  assert.equal(tokens.frame.margin, 2.5)
  assert.match(tokens.frame.panelLevel0, /^#[0-9A-F]{6}$/)
  assert.equal(tokens.button.selected.length, 3)
})
test("panel frame uses UIKit margin and panel colour", { skip: !have }, () => {
  assert.match(src, new RegExp("FRAME_MARGIN = " + tokens.frame.margin + "\\b"))
  assert.ok(near(shapeColor("PanelPlate"), rgb(tokens.frame.panelLevel0)), "PanelPlate is not UIKit Panel Level 0")
})
test("idle button is the UIKit primary fill (flat in System 3.0)", { skip: !have }, () => {
  assert.ok(tokens.button.primaryIdleIsFlat)
  assert.ok(near(shapeColor("ButtonIdle"), rgb(tokens.button.primaryIdle)), "ButtonIdle is not UIKit Primary idle")
})
test("recording button is the UIKit selected state (middle stop of its gradient)", { skip: !have }, () => {
  assert.ok(near(shapeColor("ButtonRecording"), rgb(tokens.button.selected[1])), "ButtonRecording is not UIKit selected")
})
