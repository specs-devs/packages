// FaceMeshExamplesDebugFaceMesh — shows the raw tracked Face Mesh next to the character head,
// so you can compare what tracking does with what the head does. Also dumps the Face
// Mesh vertices (position + UV) once, for building Face Morph heads offline.

@component
export class FaceMeshExamplesDebugFaceMesh extends BaseScriptComponent {
    @input
    @hint("The Face Mesh visual to show (child of HeadAnchor)")
    faceVisual: RenderMeshVisual

    @input
    showDebugFaceMesh: boolean = true

    @input
    @allowUndefined
    @hint("Unlit textured material to clone for the debug mask (e.g. 'Image Persp')")
    maskMaterial: Material

    @input
    @allowUndefined
    @hint("Black-dots-on-white texture laid out in Face Mesh UVs: dots spread/squash where the face stretches")
    maskTexture: Texture

    @input
    @allowUndefined
    @hint("Parent for the debug mask: HeadSlots, so it shares the real head's stabilized pose")
    debugParent: SceneObject

    @input
    @hint("Offset on the head's local axes (cm). -X = to the left as you look at the person")
    offsetCm: vec3 = new vec3(-22, 0, 0)

    @input
    @hint("Print the Face Mesh vertex positions and UVs once (for the offline Face Morph mapper)")
    dumpVertices: boolean = false

    @input
    @hint("Record Face Mesh shape + expression weights for this many seconds (0 = off), for the learned-blendshape solver")
    recordSeconds: number = 0

    @input
    @widget(new SliderWidget(0.05, 1, 0.05))
    recordInterval: number = 0.15

    private weights: { [name: string]: number } = {}
    private names: string[] = []
    private frame = 0

    onAwake(): void {
        this.createEvent("OnStartEvent").bind(() => {
            if (this.recordSeconds <= 0 || !this.faceVisual) return
            const provider = this.faceVisual.mesh.control as FaceRenderObjectProvider
            provider.onExpressionWeightsUpdate.add((nv: NamedValues) => {
                this.names = nv.names
                for (let i = 0; i < nv.names.length; i++) this.weights[nv.names[i]] = nv.values[i]
            })
            const start = getTime()
            let last = -1
            this.createEvent("UpdateEvent").bind(() => {
                const t = getTime() - start
                if (t > this.recordSeconds || t - last < this.recordInterval || this.names.length === 0) return
                last = t
                const pos = this.faceVisual.mesh.extractVerticesForAttribute("position")
                print("FMREC " + this.frame + " N " + this.names.join(","))
                print("FMREC " + this.frame + " W " + this.names.map((n) => (this.weights[n] || 0).toFixed(3)).join(","))
                print("FMREC " + this.frame + " P " + Array.from(pos).map((v) => v.toFixed(2)).join(","))
                this.frame++
            })
        })
        this.createEvent("OnStartEvent").bind(() => {
            if (!this.faceVisual) return
            // The source visual only feeds tracking data; it stays hidden in place.
            this.faceVisual.enabled = false
            this.faceVisual.getSceneObject().getTransform().setLocalPosition(vec3.zero())
            if (this.showDebugFaceMesh) this.buildDebugMask()
            if (this.dumpVertices) {
                const later = this.createEvent("DelayedCallbackEvent")
                later.bind(() => this.dump())
                later.reset(1.0)
            }
        })
    }

    private debugObj: SceneObject | null = null

    isDebugVisible(): boolean {
        return !!this.debugObj && this.debugObj.enabled
    }

    /** Toggle from the panel (builds the mask on first use). */
    setDebugVisible(v: boolean): void {
        if (v && !this.debugObj) this.buildDebugMask()
        if (this.debugObj) this.debugObj.enabled = v
    }

    /** A separate Face Mesh visual next to the real head, same pose, offset on its local axes. */
    private buildDebugMask(): void {
        const parent = this.debugParent || this.faceVisual.getSceneObject().getParent()
        const obj = global.scene.createSceneObject("DebugFaceMesh")
        this.debugObj = obj
        obj.setParent(parent)
        const t = obj.getTransform()
        t.setLocalPosition(this.offsetCm)
        t.setLocalRotation(quat.quatIdentity())
        t.setLocalScale(vec3.one())
        const v = obj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
        v.mesh = this.faceVisual.mesh
        if (this.maskMaterial && this.maskTexture) {
            const m = this.maskMaterial.clone()
            m.mainPass.baseTex = this.maskTexture
            m.mainPass.baseColor = new vec4(1, 1, 1, 1)
            v.mainMaterial = m
        } else {
            v.mainMaterial = this.faceVisual.mainMaterial
        }
    }

    private dump(): void {
        const mesh = this.faceVisual.mesh
        const pos = mesh.extractVerticesForAttribute("position")
        const uv = mesh.extractVerticesForAttribute("texture0")
        const idx = mesh.extractIndices()
        print("FACEMESH_DUMP counts pos=" + pos.length + " uv=" + uv.length + " idx=" + idx.length)
        const chunk = 1500
        for (let i = 0; i < pos.length; i += chunk) print("FACEMESH_POS " + i + " " + Array.from(pos.slice(i, i + chunk)).map((v) => v.toFixed(3)).join(","))
        for (let i = 0; i < uv.length; i += chunk) print("FACEMESH_UV " + i + " " + Array.from(uv.slice(i, i + chunk)).map((v) => v.toFixed(4)).join(","))
        for (let i = 0; i < idx.length; i += chunk) print("FACEMESH_IDX " + i + " " + Array.from(idx.slice(i, i + chunk)).join(","))
        print("FACEMESH_DUMP done")
    }
}
