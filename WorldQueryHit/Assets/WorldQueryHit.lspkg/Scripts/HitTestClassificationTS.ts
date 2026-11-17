/**
 * SPECS Inc. 2027
 * Semantic surface detection module. Creates a HitTestSession with classification enabled (plus an
 * optional refine mode), derives the classification value->name map dynamically from the runtime
 * SurfaceClassification enum so it works on every Lens Studio / SnapOS version, and exposes the
 * currently detected surface (name, display name, color) through a public getter and an
 * onClassificationChanged event so other scripts can consume semantic surface information
 * (Ground, Wall, Ceiling, Table, ...) for context-aware AR experiences.
 */
import {
  InteractorTriggerType,
  InteractorInputType
} from "InteractionKit.lspkg/Core/Interactor/Interactor"
import {IK} from "InteractionKit.lspkg/IK"
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindUpdateEvent } from "SnapDecorators.lspkg/decorators";
import Event from "InteractionKit.lspkg/Utils/Event";

const WorldQueryModule =
  require('LensStudio:WorldQueryModule') as WorldQueryModule;

/**
 * Snapshot of the most recent semantic surface detection.
 */
export type SurfaceClassificationInfo = {
  /** Raw SurfaceClassification enum value reported by the runtime. */
  classification: number;
  /** Enum key name, e.g. "Ground", "Wall", "None". */
  name: string;
  /** Human-readable label, e.g. "GROUND", "WALL", "UNKNOWN". */
  displayName: string;
  /** Suggested UI color for this surface type. */
  color: vec4;
};

function hexToColor(hex: string, alpha: number = 1.0): vec4 {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return new vec4(r, g, b, alpha);
}

/**
 * Label colors keyed by classification NAME (string), not by enum literal. Public Lens Studio
 * builds may only declare None/Ground in their typings, while devices with semantic detection
 * report the full set (Wall, Ceiling, Table, ...). Keying by name keeps this file compiling on
 * every Lens Studio version and automatically supports new classifications as SnapOS adds them.
 * Names missing from this map fall back to FALLBACK_COLOR.
 */
const SURFACE_COLORS: Record<string, vec4> = {
  Ground: hexToColor("#00ff00"),
  Wall: hexToColor("#00fff7"),
  Ceiling: hexToColor("#aa00ff"),
  Table: hexToColor("#ff0000"),
  None: hexToColor("#070070"),
};
// None doubles as the fallback for any category without an explicit color above
const FALLBACK_COLOR = SURFACE_COLORS["None"];

/**
 * Builds the classification value -> name map from the RUNTIME enum object (the equivalent of
 * SharedUtils' listEnum, inlined here). Never reference SurfaceClassification members other than
 * None/Ground as compile-time literals — they are not declared in public Lens Studio typings.
 */
function buildClassificationNameMap(): Map<number, string> {
  const names = new Map<number, string>();
  const enumObject = SurfaceClassification as any;
  for (const key of Object.keys(enumObject)) {
    const value = enumObject[key];
    if (typeof value === "number" && !names.has(value)) {
      names.set(value, key);
    }
  }
  return names;
}

@component
export class HitTestClassification extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Semantic Detection Settings</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Surface classification options</span>')

  @input
  @hint("Request refined hit results (options.refine). Not available on every SnapOS/Lens Studio version; silently ignored when unsupported")
  refineEnabled: boolean = false;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Logging Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Control logging output for this script instance</span>')

  @input
  @hint("Enable general logging (events, operations, etc.)")
  enableLogging: boolean = false;

  @input
  @hint("Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.)")
  enableLoggingLifecycle: boolean = false;

  /**
   * Fires whenever the detected surface classification CHANGES (not every frame).
   * Payload carries the raw enum value, the enum key name, a display name, and a UI color.
   */
  public readonly onClassificationChanged = new Event<SurfaceClassificationInfo>();

  private logger: Logger;
  private hitTestSession: HitTestSession;
  private primaryInteractor;
  private classificationNames: Map<number, string>;
  private currentInfo: SurfaceClassificationInfo | null = null;

  /** The most recent semantic surface detection, or null before the first hit. */
  get currentClassification(): SurfaceClassificationInfo | null {
    return this.currentInfo;
  }

  onAwake() {
    const shouldLog = this.enableLogging || this.enableLoggingLifecycle;
    this.logger = new Logger("HitTestClassification", shouldLog, true);

    if (this.enableLoggingLifecycle) {
      this.logger.header("HitTestClassification Initialization");
      this.logger.debug("LIFECYCLE: onAwake() - Component waking up");
    }

    this.classificationNames = buildClassificationNameMap();
    this.hitTestSession = this.createHitTestSession();
  }

  createHitTestSession() {
    const options = HitTestSessionOptions.create();
    options.classification = true;

    if (this.refineEnabled) {
      // `refine` is not declared on every Lens Studio version's typings/runtime —
      // assign it defensively so this script compiles and runs everywhere.
      try {
        (options as any).refine = true;
      } catch (e) {
        if (this.enableLogging) {
          this.logger.info("HitTestSessionOptions.refine is not supported on this Lens Studio/SnapOS version — ignoring");
        }
      }
    }

    const session = WorldQueryModule.createHitTestSessionWithOptions(options);
    return session;
  }

  /** Resolves a classification enum value to its runtime enum key name. */
  getClassificationName(classification: number | undefined | null): string {
    if (classification === undefined || classification === null) {
      return "None";
    }
    return this.classificationNames.get(classification) ?? ("Surface" + classification);
  }

  /** Resolves a classification NAME to a suggested UI color. */
  getClassificationColor(name: string): vec4 {
    return SURFACE_COLORS[name] ?? FALLBACK_COLOR;
  }

  onHitTestResult = (result: WorldQueryHitTestResult) => {
    if (result === null) {
      // Hit test failed — keep the last known classification.
      return;
    }

    const name = this.getClassificationName(result.classification as any);
    if (this.currentInfo !== null && this.currentInfo.name === name) {
      return; // No change — don't spam consumers every frame.
    }

    const info: SurfaceClassificationInfo = {
      classification: result.classification as any,
      name: name,
      displayName: name === "None" ? "UNKNOWN" : name.toUpperCase(),
      color: this.getClassificationColor(name),
    };
    this.currentInfo = info;
    this.onClassificationChanged.invoke(info);

    if (this.enableLogging) {
      this.logger.info("Detected surface: " + info.displayName + " (classification=" + info.classification + ")");
    }
  };

  /**
   * Called every frame
   * Automatically bound to UpdateEvent via SnapDecorators
   */
  @bindUpdateEvent
  onUpdate(): void {
    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onUpdate() - Update event");
    }
    this.primaryInteractor = IK.InteractionManager.getTargetingInteractors().shift();
    if (this.primaryInteractor &&
        this.primaryInteractor.isActive() &&
        this.primaryInteractor.isTargeting()
    ) {
        const rayStartOffset = new vec3(this.primaryInteractor.startPoint.x, this.primaryInteractor.startPoint.y, this.primaryInteractor.startPoint.z + 30);
        const rayStart = rayStartOffset;
        const rayEnd = this.primaryInteractor.endPoint;

        this.hitTestSession.hitTest(rayStart, rayEnd, this.onHitTestResult);
    }
  }
}
