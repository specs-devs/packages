// FaceMeshExamplesExpressionDriver — copies live Face Mesh expression weights onto the
// shape keys of the generated heads (shape key names = Lens Expressions names,
// authored by Tools/rig_head_blendshapes.py). Only the enabled head is updated.
//
// Tracked weights are small for real faces (JawOpen rarely passes ~0.6), so each
// shape gets a gain, related expressions are folded in via SOURCES, and the
// result is smoothed per frame so cartoon heads read clearly without flicker.

/** shape key -> [expression name, contribution] (the shape takes the max). */
const SOURCES: { [shape: string]: [string, number][] } = {
    JawOpen: [["JawOpen", 1]],
    JawLeft: [["JawLeft", 1], ["MouthLeft", 0.5]],
    JawRight: [["JawRight", 1], ["MouthRight", 0.5]],
    MouthSmileLeft: [["MouthSmileLeft", 1], ["MouthDimpleLeft", 0.6], ["CheekSquintLeft", 0.6]],
    MouthSmileRight: [["MouthSmileRight", 1], ["MouthDimpleRight", 0.6], ["CheekSquintRight", 0.6]],
    MouthFrownLeft: [["MouthFrownLeft", 1], ["MouthStretchLeft", 0.5]],
    MouthFrownRight: [["MouthFrownRight", 1], ["MouthStretchRight", 0.5]],
    LipsPucker: [["LipsPucker", 1], ["LipsFunnel", 0.8]],
    Puff: [["Puff", 1]],
    EyeBlinkLeft: [["EyeBlinkLeft", 1], ["EyeSquintLeft", 0.5]],
    EyeBlinkRight: [["EyeBlinkRight", 1], ["EyeSquintRight", 0.5]],
    EyeOpenLeft: [["EyeOpenLeft", 1]],
    EyeOpenRight: [["EyeOpenRight", 1]],
    BrowsUpLeft: [["BrowsUpLeft", 1], ["BrowsUpCenter", 0.9]],
    BrowsUpRight: [["BrowsUpRight", 1], ["BrowsUpCenter", 0.9]],
    BrowsDownLeft: [["BrowsDownLeft", 1]],
    BrowsDownRight: [["BrowsDownRight", 1]],
}

const GAIN: { [shape: string]: number } = {
    JawOpen: 1.8, JawLeft: 1.5, JawRight: 1.5,
    MouthSmileLeft: 1.6, MouthSmileRight: 1.6, MouthFrownLeft: 1.6, MouthFrownRight: 1.6,
    LipsPucker: 1.4, Puff: 1.5,
    EyeBlinkLeft: 1.15, EyeBlinkRight: 1.15, EyeOpenLeft: 1.5, EyeOpenRight: 1.5,
    BrowsUpLeft: 1.8, BrowsUpRight: 1.8, BrowsDownLeft: 1.8, BrowsDownRight: 1.8,
}

/** Shapes driven through calibration (the rest use the raw tracked weight). */
const CALIBRATED = new Set<string>(["JawOpen"])

/** Weights below this are treated as 0, so resting faces stay still. */
const DEADZONE = 0.06

@component
export class FaceMeshExamplesExpressionDriver extends BaseScriptComponent {
    @input
    @hint("Face Mesh asset that tracks the person (its control provides expression weights)")
    faceMesh!: RenderMesh

    @input
    @hint("RenderMeshVisuals of the rigged heads")
    heads: RenderMeshVisual[] = []

    @input
    @widget(new SliderWidget(0, 3, 0.05))
    @hint("Overall exaggeration on top of the per-expression gains (1 = as tuned)")
    gain: number = 1.0

    @input
    @widget(new SliderWidget(0.05, 1, 0.05))
    @hint("Smoothing: 1 = no smoothing, lower = steadier but laggier")
    responsiveness: number = 0.45

    @input
    @hint("Learn each person's resting/peak range and stretch it to full strength")
    calibrate: boolean = true

    @input
    @widget(new SliderWidget(0.05, 0.5, 0.01))
    @hint("Smallest range calibration will stretch (higher = less noise amplification)")
    minRange: number = 0.15

    @input
    @widget(new SliderWidget(0, 2, 0.05))
    @hint("Strength of the learned expression shapes (1 = as tracked; they already include a 1.6x boost)")
    learnedGain: number = 1.0

    private base: { [shape: string]: number } = {}
    private peak: { [shape: string]: number } = {}
    private shapeNames: string[][] = []
    private raw: { [name: string]: number } = {}
    private current: { [shape: string]: number } = {}

    onAwake(): void {
        this.createEvent("OnStartEvent").bind(() => this.onStart())
        this.createEvent("UpdateEvent").bind(() => this.apply())
    }

    private onStart(): void {
        const provider = this.faceMesh ? (this.faceMesh.control as FaceRenderObjectProvider) : null
        if (!provider) {
            print("FaceMeshExamplesExpressionDriver: faceMesh has no FaceRenderObjectProvider")
            return
        }
        this.shapeNames = this.heads.map((h) => (h ? h.getBlendShapeNames() : []))
        // Imported prefabs can carry non-zero default weights; start every head at rest.
        this.heads.forEach((h, i) => {
            if (h) this.shapeNames[i].forEach((n) => h.setBlendShapeWeight(n, 0))
        })
        print("FaceMeshExamplesExpressionDriver: driving " + this.heads.length + " heads; shapes per head = "
            + this.shapeNames.map((s) => s.length).join(","))
        provider.onExpressionWeightsUpdate.add((nv: NamedValues) => {
            const names = nv.names
            const values = nv.values
            for (let i = 0; i < names.length; i++) this.raw[names[i]] = values[i]
        })
    }

    private source(shape: string): number {
        const sources = SOURCES[shape]
        if (!sources) return this.raw[shape] || 0
        let v = this.raw[shape] || 0
        for (const [name, k] of sources) v = Math.max(v, (this.raw[name] || 0) * k)
        return v
    }

    /**
     * Auto-calibration: per shape, a resting baseline (drops fast, rises slowly) and a
     * peak (jumps up, decays slowly). The live value is rescaled to that range, so a
     * bystander whose tracked weights only reach ~0.3 still drives the full shape.
     */
    private calibrated(shape: string, v: number, dt: number): number {
        if (!this.calibrate) {
            const d = v < DEADZONE ? 0 : (v - DEADZONE) / (1 - DEADZONE)
            return Math.min(1, d * (GAIN[shape] || 1) * this.gain)
        }
        let base = this.base[shape] === undefined ? v : this.base[shape]
        let peak = this.peak[shape] === undefined ? v + this.minRange : this.peak[shape]
        base = v < base ? base + (v - base) * Math.min(1, dt * 8) : base + (v - base) * Math.min(1, dt * 0.15)
        peak = v > peak ? v : peak + (base + this.minRange - peak) * Math.min(1, dt * 0.05)
        this.base[shape] = base
        this.peak[shape] = peak
        const range = Math.max(this.minRange, peak - base)
        const n = Math.max(0, (v - base) / range - 0.08) / 0.92
        return Math.min(1, n * this.gain)
    }

    private apply(): void {
        const a = this.responsiveness
        const dt = getDeltaTime()
        // Every shape key named after a tracked expression is driven (learned heads carry ~30);
        // SOURCES only adds aliases/extra contributions on top of the direct value.
        const targets: { [shape: string]: number } = {}
        for (const shapes of this.shapeNames) {
            for (const shape of shapes) {
                if (targets[shape] !== undefined) continue
                // Learned shapes are linear fields fitted to the real weights: they only add up
                // correctly when driven by those raw weights together. Calibration/boosts would
                // stack correlated shapes and over-stretch the face, so only the modelled-mouth
                // JawOpen blend is calibrated.
                targets[shape] = CALIBRATED.has(shape)
                    ? this.calibrated(shape, this.source(shape), dt)
                    : Math.min(1, (this.raw[shape] || 0) * this.learnedGain)
            }
        }
        for (let h = 0; h < this.heads.length; h++) {
            const visual = this.heads[h]
            if (!visual || !visual.getSceneObject().isEnabledInHierarchy) continue
            for (const shape of this.shapeNames[h]) {
                const target = targets[shape] !== undefined ? targets[shape] : 0
                const prev = this.current[shape] || 0
                const next = prev + (target - prev) * a
                this.current[shape] = next
                visual.setBlendShapeWeight(shape, next)
            }
        }
    }
}
