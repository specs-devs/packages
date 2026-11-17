import {MathUtils, GeoCoordinate} from "Utilities.lspkg/Scripts/Utils/MathUtils"
import {TypeConversionUtils} from "Utilities.lspkg/Scripts/Utils/TypeConversionUtils"
import {ValidationUtils} from "Utilities.lspkg/Scripts/Utils/ValidationUtils"
import {createPanelText, fmt} from "./DemoText"

const LONDON: GeoCoordinate = {latitude: 51.5007, longitude: -0.1246, altitude: 0}
const PARIS: GeoCoordinate = {latitude: 48.8584, longitude: 2.2945, altitude: 0}

/**
 * Utilities demo 1: MathUtils, TypeConversionUtils and ValidationUtils results on a panel.
 * The last line is recomputed every frame so the panel shows the helpers running live.
 */
@component
export class MathConversionDemo extends BaseScriptComponent {
  private live: Text | null = null
  private startTime = 0

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.build())
    this.createEvent("UpdateEvent").bind(() => this.updateLive())
  }

  private build(): void {
    const results = createPanelText(this.sceneObject, "Results", new vec3(0, 2, 0), 54, 44, 26)
    results.text = [
      "MathUtils",
      `  lerp(0, 10, 0.25) = ${MathUtils.lerp(0, 10, 0.25)}    mod(-1, 4) = ${MathUtils.mod(-1, 4)}`,
      `  normalizeAngle(3π/2) = ${fmt(MathUtils.normalizeAngle((3 * Math.PI) / 2))} rad`,
      `  London → Paris: ${fmt(MathUtils.haversineDistance(LONDON, PARIS) / 1000, 0)} km, bearing ${fmt(
        MathUtils.calculateBearing(LONDON, PARIS) / MathUtils.DegToRad,
        0
      )}°`,
      "TypeConversionUtils",
      `  convertToNumber("3,14") = ${TypeConversionUtils.convertToNumber("3,14")}    safeParseInt("7.9") = ${TypeConversionUtils.safeParseInt("7.9")}`,
      `  safeParseNumber("abc", -1) = ${TypeConversionUtils.safeParseNumber("abc", -1)}    toBoolean("yes") = ${TypeConversionUtils.toBoolean("yes")}`,
      "ValidationUtils",
      `  validateInputs({a: 1}, ["a", "b"]) → ${this.validationMessage()}`,
      `  isNull(undefined) = ${ValidationUtils.isNull(undefined)}    ifNotNull(2, v → v * 3) = ${ValidationUtils.ifNotNull(2, (v) => v * 3)}`,
    ].join("\n")

    this.live = createPanelText(this.sceneObject, "Live", new vec3(0, -14.5, 0), 46, 44, 4)
    this.live.textFill.color = new vec4(0.45, 0.75, 1, 1)
    this.startTime = getTime()
  }

  private validationMessage(): string {
    try {
      ValidationUtils.validateInputs({a: 1}, ["a", "b"])
      return "no error"
    } catch (e) {
      return `"${(e as Error).message}"`
    }
  }

  private updateLive(): void {
    if (!this.live) {
      return
    }
    const t = (getTime() - this.startTime) % 1.5
    const progress = Math.min(1, t)
    this.live.text = `Live: easeOutElastic(${fmt(progress)}) = ${fmt(MathUtils.easeOutElastic(progress))}`
  }
}
