/**
 * Ready-made looks for a MetaballField. A preset only sets the material's look parameters; ball positions
 * and radii always come from the field's sources.
 */
export type MetaballPreset = {
  name: string
  colorA: vec3
  colorB: vec3
  rimColor: vec3
  gloss: number
  iridescence: number
  intensity: number
  smoothness: number
  wobble: number
}

export const METABALL_PRESETS: MetaballPreset[] = [
  {
    name: "Bubblegum",
    colorA: new vec3(0.55, 0.85, 1.0),
    colorB: new vec3(0.95, 0.4, 0.95),
    rimColor: new vec3(1.0, 0.6, 0.9),
    gloss: 0.75,
    iridescence: 0.5,
    intensity: 1.0,
    smoothness: 0.35,
    wobble: 0.0
  },
  {
    name: "Liquid Chrome",
    colorA: new vec3(0.82, 0.86, 0.95),
    colorB: new vec3(0.55, 0.62, 0.8),
    rimColor: new vec3(0.95, 0.98, 1.0),
    gloss: 1.0,
    iridescence: 0.18,
    intensity: 1.1,
    smoothness: 0.3,
    wobble: 0.0
  },
  {
    name: "Neon Plasma",
    colorA: new vec3(0.1, 0.95, 1.0),
    colorB: new vec3(1.0, 0.15, 0.85),
    rimColor: new vec3(0.4, 1.0, 1.0),
    gloss: 0.55,
    iridescence: 0.35,
    intensity: 1.5,
    smoothness: 0.45,
    wobble: 0.5
  },
  {
    name: "Lava",
    colorA: new vec3(1.0, 0.75, 0.15),
    colorB: new vec3(0.95, 0.12, 0.05),
    rimColor: new vec3(1.0, 0.85, 0.35),
    gloss: 0.3,
    iridescence: 0.0,
    intensity: 1.25,
    smoothness: 0.5,
    wobble: 0.25
  }
]

export const PRESET_NAMES: string[] = METABALL_PRESETS.map((p) => p.name)

/** Returns the preset with this name (case and spaces ignored), or the first preset. */
export function findPreset(name: string): MetaballPreset {
  const key = (name || "").replace(/\s+/g, "").toLowerCase()
  for (const preset of METABALL_PRESETS) {
    if (preset.name.replace(/\s+/g, "").toLowerCase() === key) {
      return preset
    }
  }
  return METABALL_PRESETS[0]
}
