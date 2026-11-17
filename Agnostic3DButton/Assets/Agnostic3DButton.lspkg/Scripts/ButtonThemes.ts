/**
 * Colour themes for Agnostic3DButtonVisual. Every colour is RGBA 0..1.
 * The default theme (Specs Glass) uses the package's teal palette. The UIKit themes add per-state
 * gradients and borders for the visual's UIKit style.
 */

export interface ButtonTheme {
  name: string
  /** Base plate / well the cap sinks into. */
  plate: vec4
  /** Cap colour at rest. */
  idle: vec4
  /** Cap colour while a finger hovers above it. */
  hover: vec4
  /** Cap colour while pressed. */
  pressed: vec4
  /** Cap colour while a toggle is on. */
  on: vec4
  /** Glow ring colour. */
  glow: vec4
  /** Label colour. */
  label: vec4
  /** PBR roughness / metallic for the cap. */
  roughness: number
  metallic: number
  /** UIKit style only: three left → right gradient stops per state (alpha 0 = no fill). */
  gradient?: ButtonStateColors<vec4[]>
  /** UIKit style only: inset border colour per state, and its width. */
  border?: ButtonStateColors<vec4> & {width: number}
  /** Label colour while hovered / pressed (default: `label`). */
  labelHover?: vec4
  labelPressed?: vec4
}

/** One value per visual state. */
export interface ButtonStateColors<T> {
  idle: T
  hover: T
  pressed: T
  on: T
}

const rgb = (hex: string, a: number = 1): vec4 => {
  const n = parseInt(hex.replace("#", ""), 16)
  return new vec4(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a)
}

export const BUTTON_THEMES: ButtonTheme[] = [
  {
    name: "Specs Glass",
    plate: rgb("#084740"),
    idle: rgb("#D9F2EE"),
    hover: rgb("#8BD0C6"),
    pressed: rgb("#14A08D"),
    on: rgb("#77CBC2"),
    glow: rgb("#3FE0C8"),
    label: rgb("#063A34"),
    roughness: 0.25,
    metallic: 0.0,
  },
  {
    name: "Neon",
    plate: rgb("#0B0B1A"),
    idle: rgb("#1E1B4B"),
    hover: rgb("#4338CA"),
    pressed: rgb("#EC4899"),
    on: rgb("#22D3EE"),
    glow: rgb("#F472B6"),
    label: rgb("#F5F3FF"),
    roughness: 0.15,
    metallic: 0.2,
  },
  {
    name: "Candy",
    plate: rgb("#FCE7F3"),
    idle: rgb("#FDA4AF"),
    hover: rgb("#FB7185"),
    pressed: rgb("#E11D48"),
    on: rgb("#FBBF24"),
    glow: rgb("#FFE4E6"),
    label: rgb("#FFFFFF"),
    roughness: 0.35,
    metallic: 0.0,
  },
  {
    name: "Metal",
    plate: rgb("#1F2937"),
    idle: rgb("#CBD5E1"),
    hover: rgb("#E2E8F0"),
    pressed: rgb("#94A3B8"),
    on: rgb("#FDE68A"),
    glow: rgb("#FDE68A"),
    label: rgb("#111827"),
    roughness: 0.25,
    // Not fully metallic: with no environment map a metal cap reflects little and reads as black on an additive display.
    metallic: 0.45,
  },
  // The three "UIKit" themes copy the colours of UIKit's System 3.0 Primary / Secondary / Ghost buttons
  // (Themes/System-3.0: Colors.ts, Styles/ButtonParameters.ts, Gradients/*). Use them with style = UIKit.
  {
    name: "UIKit Primary",
    plate: rgb("#2F3231"),
    idle: rgb("#5B615F"),
    hover: rgb("#648798"),
    pressed: rgb("#141B1E"),
    on: rgb("#516873"),
    glow: rgb("#7EA1B2"),
    label: rgb("#D9D9D9"),
    labelHover: rgb("#FFFFFF"),
    labelPressed: rgb("#BFBFBF"),
    roughness: 0.7,
    metallic: 0.0,
    gradient: {
      idle: [rgb("#5B615F"), rgb("#5B615F"), rgb("#5B615F")],
      hover: [rgb("#6C5FA4"), rgb("#648798"), rgb("#55B8A6")],
      pressed: [rgb("#161321"), rgb("#141B1E"), rgb("#112521")],
      on: [rgb("#564E7A"), rgb("#516873"), rgb("#4A8A7E")],
    },
    border: {idle: rgb("#5B615F"), hover: rgb("#648798"), pressed: rgb("#7EA1B2"), on: rgb("#516873"), width: 0.175},
  },
  {
    name: "UIKit Secondary",
    plate: rgb("#2F3231"),
    idle: rgb("#5B615F", 0),
    hover: rgb("#7EA1B2", 0),
    pressed: rgb("#648798", 0),
    on: rgb("#2F3231"),
    glow: rgb("#7EA1B2"),
    label: rgb("#D9D9D9"),
    labelHover: rgb("#FFFFFF"),
    labelPressed: rgb("#BFBFBF"),
    roughness: 0.7,
    metallic: 0.0,
    gradient: {
      idle: [rgb("#5B615F", 0), rgb("#5B615F", 0), rgb("#5B615F", 0)],
      hover: [rgb("#5B615F", 0), rgb("#5B615F", 0), rgb("#5B615F", 0)],
      pressed: [rgb("#5B615F", 0), rgb("#5B615F", 0), rgb("#5B615F", 0)],
      on: [rgb("#2F3231"), rgb("#2F3231"), rgb("#2F3231")],
    },
    border: {idle: rgb("#5B615F"), hover: rgb("#7EA1B2"), pressed: rgb("#648798"), on: rgb("#648798"), width: 0.175},
  },
  {
    name: "UIKit Ghost",
    plate: rgb("#2F3231"),
    idle: rgb("#404746", 0),
    hover: rgb("#404746"),
    pressed: rgb("#353837"),
    on: rgb("#353837"),
    glow: rgb("#535C5B"),
    label: rgb("#D9D9D9"),
    labelHover: rgb("#FFFFFF"),
    labelPressed: rgb("#BFBFBF"),
    roughness: 0.7,
    metallic: 0.0,
    gradient: {
      idle: [rgb("#404746", 0), rgb("#404746", 0), rgb("#404746", 0)],
      hover: [rgb("#404746"), rgb("#404746"), rgb("#404746")],
      pressed: [rgb("#353837"), rgb("#353837"), rgb("#353837")],
      on: [rgb("#353837"), rgb("#353837"), rgb("#353837")],
    },
    border: {idle: rgb("#404746", 0), hover: rgb("#404746"), pressed: rgb("#353837"), on: rgb("#353837"), width: 0.1},
  },
]

export const THEME_NAMES = BUTTON_THEMES.map((t) => t.name)

export function findTheme(nameOrIndex: string | number): ButtonTheme {
  if (typeof nameOrIndex === "number") {
    const i = Math.max(0, Math.min(BUTTON_THEMES.length - 1, Math.floor(nameOrIndex)))
    return BUTTON_THEMES[i]
  }
  return BUTTON_THEMES.find((t) => t.name.toLowerCase() === nameOrIndex.toLowerCase()) ?? BUTTON_THEMES[0]
}

/** Component-wise lerp for colours. */
export function mixColor(a: vec4, b: vec4, t: number): vec4 {
  return new vec4(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t, a.w + (b.w - a.w) * t)
}
