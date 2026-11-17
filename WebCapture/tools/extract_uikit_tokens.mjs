// Reads the design values straight from the installed UIKit package and writes WebCapturePortal/src/uikit-tokens.json.
// The tokens are the single source of truth for how a UIKit panel looks: tests/uikit.test.mjs fails when the Lens panel
// (CapturePanel.ts) or the portal drifts from them, so fidelity is checked, not remembered.
//
//   node tools/extract_uikit_tokens.mjs [path/to/UIKit.lspkg]     (default: ~/Desktop/test/Packages/UIKit.lspkg)
import {execFileSync} from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {fileURLToPath} from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const pkg = process.argv[2] || path.join(os.homedir(), "Desktop/test/Packages/UIKit.lspkg")
const read = (inner) => execFileSync("unzip", ["-p", pkg, "Package/Assets/Scripts/" + inner], {encoding: "utf8"})

const ds = read("Themes/System-3.0/DesignSystemColors.ts")
const colors = read("Themes/System-3.0/Colors.ts")
const frame = read("Components/Frame/Frame.ts")
const primary = read("Themes/System-3.0/Gradients/PrimaryGradients.ts")
const buttons = read("Themes/System-3.0/Styles/ButtonParameters.ts")

const vec4 = (name) => {
  const m = new RegExp("export const " + name + " = new vec4\\(([^)]*)\\)").exec(ds)
  if (!m) throw new Error("UIKit token not found: " + name)
  return m[1].split(",").map((x) => +x.trim())
}
const hex = (c) => "#" + c.slice(0, 3).map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("").toUpperCase()
function hsv(h, s, v) {
  const f = (n) => {
    const k = (n + h / 60) % 6
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1))
  }
  return [f(5), f(3), f(1)]
}
const accent = (name) => {
  const m = new RegExp("export const " + name + " = HSVtoRGB\\(([^)]*)\\)").exec(colors)
  if (!m) throw new Error("UIKit accent not found: " + name)
  const [h, s, v] = m[1].split(",").map((x) => +x.trim())
  return hex(hsv(h, s, v))
}
const margin = /margin: ([0-9.]+),/.exec(frame)
const border = /Primary: \{\s*default: \{[\s\S]*?borderSize: ([0-9.]+),\s*borderSoftness: ([0-9.]+)/.exec(buttons)
if (!margin || !border) throw new Error("UIKit frame/button parameters not found: the package layout changed")

const tokens = {
  _source: "UIKit System-3.0 (" + path.basename(pkg) + ")",
  frame: {margin: +margin[1], panelLevel0: hex(vec4("DSColorHierarchyPanelLevel0"))},
  button: {
    primaryIdle: hex(vec4("DSButtonFillCTAIdle")), // flat: all three stops of PrimaryGradients.idleBackground are this colour
    primaryIdleIsFlat: /idleBackground: \{[\s\S]*?WarmLightGray[\s\S]*?WarmLightGray[\s\S]*?WarmLightGray/.test(primary),
    borderSize: +border[1],
    borderSoftness: +border[2],
    selected: [accent("AccentPurpleSelected"), accent("AccentBlueSelected"), accent("AccentTealSelected")],
    hover: [accent("AccentPurple"), accent("AccentBlue"), accent("AccentTeal")]
  },
  text: {body: hex(vec4("DSTextFillBody")), title: hex(vec4("DSTextFillTitleHeadline"))}
}
const out = path.join(here, "../WebCapturePortal/src/uikit-tokens.json")
fs.writeFileSync(out, JSON.stringify(tokens, null, 2) + "\n")
console.log("wrote", out, "\n" + JSON.stringify(tokens))
