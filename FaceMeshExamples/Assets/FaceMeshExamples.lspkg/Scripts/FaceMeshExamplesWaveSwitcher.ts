// FaceMeshExamplesWaveSwitcher — wave either hand side-to-side to switch to the next head.
// A wave = `reversalsNeeded` direction changes of the wrist along the camera's
// right axis, each swing at least `minSwingCm`, all within `windowSec`.
// Editor: press W in the Preview to simulate a wave (raw hand data does not fire there).

import { HandInputData } from "InteractionKit.lspkg/Providers/HandInputData/HandInputData"
import WorldCameraFinderProvider from "InteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import { FaceMeshExamplesMain } from "./FaceMeshExamplesMain"

type HandName = "left" | "right"

class WaveTracker {
    private extreme = 0
    private dir = 0
    private reversals: number[] = []
    private wasTracked = false

    constructor(private minSwing: number, private windowSec: number, private needed: number) {}

    /** Feed the wrist's camera-right coordinate (cm); returns true when a wave completes. */
    update(x: number, tracked: boolean, now: number): boolean {
        if (!tracked) {
            this.wasTracked = false
            this.reversals = []
            return false
        }
        if (!this.wasTracked) {
            this.wasTracked = true
            this.extreme = x
            this.dir = 0
            return false
        }
        const moved = x - this.extreme
        if (this.dir === 0) {
            if (Math.abs(moved) >= this.minSwing) {
                this.dir = Math.sign(moved)
                this.extreme = x
            }
        } else if (Math.sign(moved) === this.dir) {
            this.extreme = x // still swinging the same way: push the extreme out
        } else if (Math.abs(moved) >= this.minSwing) {
            this.dir = -this.dir // swung back far enough: one reversal
            this.extreme = x
            this.reversals.push(now)
        }
        this.reversals = this.reversals.filter((t) => now - t <= this.windowSec)
        if (this.reversals.length >= this.needed) {
            this.reversals = []
            return true
        }
        return false
    }
}

@component
export class FaceMeshExamplesWaveSwitcher extends BaseScriptComponent {
    @input
    @hint("FaceMeshExamplesMain to cycle")
    main!: FaceMeshExamplesMain

    @input
    @widget(new SliderWidget(3, 20, 0.5))
    @hint("Minimum distance each swing must travel (cm)")
    minSwingCm: number = 6

    @input
    @widget(new SliderWidget(0.5, 3, 0.1))
    @hint("All reversals must happen within this many seconds")
    windowSec: number = 1.2

    @input
    @widget(new SliderWidget(2, 6, 1))
    reversalsNeeded: number = 3

    @input
    @widget(new SliderWidget(0.5, 4, 0.1))
    @hint("Ignore further waves for this long after a switch (s)")
    cooldownSec: number = 1.5

    private hands = HandInputData.getInstance()
    private trackers: { [k: string]: WaveTracker } = {}
    private lastSwitch = -100

    onAwake(): void {
        for (const h of ["left", "right"] as HandName[]) {
            this.trackers[h] = new WaveTracker(this.minSwingCm, this.windowSec, this.reversalsNeeded)
        }
        this.createEvent("UpdateEvent").bind(() => this.onUpdate())
        this.createEvent("KeyPressEvent").bind((e: KeyPressEvent) => {
            if (e.key === Keys.W) this.trigger("editor key W")
        })
    }

    private onUpdate(): void {
        const now = getTime()
        const cam = WorldCameraFinderProvider.getInstance().getComponent().getTransform()
        const right = cam.right
        for (const name of ["left", "right"] as HandName[]) {
            const hand = this.hands.getHand(name)
            const tracked = hand.isTracked()
            const x = tracked ? hand.wrist.position.sub(cam.getWorldPosition()).dot(right) : 0
            if (this.trackers[name].update(x, tracked, now)) this.trigger(name + " hand wave")
        }
    }

    private trigger(source: string): void {
        const now = getTime()
        if (now - this.lastSwitch < this.cooldownSec || !this.main) return
        this.lastSwitch = now
        print("FaceMeshExamplesWaveSwitcher: " + source + " -> next head")
        this.main.cycle(1)
    }
}
