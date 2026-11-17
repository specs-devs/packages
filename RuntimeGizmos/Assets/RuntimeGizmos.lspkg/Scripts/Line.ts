import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent, bindUpdateEvent, bindLateUpdateEvent, bindDestroyEvent } from "SnapDecorators.lspkg/decorators";

/**
 * SPECS Inc. 2027
 * Runtime line gizmo for visualizing connections between objects. Renders a customizable line
 * between start and end points with gradient colors, configurable styles, and real-time updates
 * for debugging spatial relationships and interactions.
 */
import {
    withAlpha,
    withoutAlpha,
  } from "InteractionKit.lspkg/Utils/color";
  import InteractorLineRenderer, {
    VisualStyle,
  } from "InteractionKit.lspkg/Components/Interaction/InteractorLineVisual/InteractorLineRenderer";

@component
export class Line extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Line Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure start/end points and line appearance</span>')

  @input
  @allowUndefined
  public startPointObject!: SceneObject

  @input
  @allowUndefined
  public endPointObject!: SceneObject

  @input
  @allowUndefined
  private lineMaterial!: Material

  @input("vec3", "{1, 1, 0}")
  @widget(new ColorWidget())
  public _beginColor: vec3 = new vec3(1, 1, 0)

  @input("vec3", "{1, 1, 0}")
  @widget(new ColorWidget())
  public _endColor: vec3 = new vec3(1, 1, 0)

  @input
  private lineWidth: number = 0.5

  @input
  private lineLength: number = 160

  @input
  @widget(
    new ComboBoxWidget()
      .addItem("Full", 0)
      .addItem("Split", 1)
      .addItem("FadedEnd", 2),
  )
  public lineStyle: number = 2

  @input
  private shouldStick: boolean = true

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Logging Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Control logging output for this script instance</span>')

  @input
  @hint("Enable general logging (animation cycles, events, etc.)")
  enableLogging: boolean = false;

  @input
  @hint("Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.)")
  enableLoggingLifecycle: boolean = false;

  // Logger instance
  private logger: Logger;  private _enabled = true
  private isShown = false
  private line!: InteractorLineRenderer
  private transform!: Transform
  private lastStartPosition: vec3 | null = null
  private lastEndPosition: vec3 | null = null

  /**
   * Sets whether the visual can be shown, so developers can show/hide the ray in certain parts of their lens.
   */
  set isEnabled(isEnabled: boolean) {
    this._enabled = isEnabled
    if (this.line) {
      this.line.getSceneObject().enabled = isEnabled
    }
  }

  /**
   * Gets whether the visual is active (can be shown if hand is in frame and we're in far field targeting mode).
   */
  get isEnabled(): boolean {
    return this._enabled
  }

  /**
   * Sets how the visuals for the line drawer should be shown.
   */
  set visualStyle(style: VisualStyle) {
    this.lineStyle = style
    if (this.line) {
      this.line.visualStyle = style
    }
  }

  /**
   * Gets the current visual style.
   */
  get visualStyle(): VisualStyle {
    return this.line ? this.line.visualStyle : this.lineStyle
  }

  /**
   * Sets the color of the visual from the start.
   */
  set beginColor(color: vec3) {
    this._beginColor = color
    if (this.line) {
      this.line.startColor = withAlpha(color, 1)
    }
  }

  /**
   * Gets the color of the visual from the start.
   */
  get beginColor(): vec3 {
    return this.line ? withoutAlpha(this.line.startColor) : this._beginColor
  }

  /**
   * Sets the color of the visual from the end.
   */
  set endColor(color: vec3) {
    this._endColor = color
    if (this.line) {
      this.line.endColor = withAlpha(color, 1)
    }
  }

  /**
   * Gets the color of the visual from the end.
   */
  get endColor(): vec3 {
    return this.line ? withoutAlpha(this.line.endColor) : this._endColor
  }  /**
   * Called when component is initialized
   */
  onAwake(): void {
    // Initialize logger
    this.logger = new Logger("Line", this.enableLogging || this.enableLoggingLifecycle, true);

    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }


    this.transform = this.sceneObject.getTransform()

    // Create update event to update the line on every frame
    this.createEvent("UpdateEvent").bind(this.onUpdate.bind(this))

    if (this.startPointObject && this.endPointObject && this.lineMaterial) {
      this.rebuild()
    } else {
      this.logger.debug("Start/end point or material not set yet; call rebuild() after assigning them");
    }
  }

  /**
   * (Re)creates the line from the current inputs. Call after setting startPointObject, endPointObject
   * and setLineMaterial() from code (e.g. on a component added with createComponent).
   */
  rebuild(): void {
    if (!this.startPointObject || !this.endPointObject || !this.lineMaterial) {
      this.logger.debug("Cannot rebuild line: start/end point and material are required");
      return
    }

    if (this.line) {
      this.line.destroy()
    }

    this.lastStartPosition = this.startPointObject.getTransform().getLocalPosition()
    this.lastEndPosition = this.endPointObject.getTransform().getLocalPosition()

    this.line = new InteractorLineRenderer({
      material: this.lineMaterial,
      points: [this.lastStartPosition, this.lastEndPosition],
      startColor: withAlpha(this._beginColor, 1),
      endColor: withAlpha(this._endColor, 1),
      startWidth: this.lineWidth,
      endWidth: this.lineWidth,
    })

    this.line.getSceneObject().setParent(this.sceneObject)

    if (this.lineStyle !== undefined) {
      this.line.visualStyle = this.lineStyle
    }

    this.line.getSceneObject().enabled = this._enabled
  }

  /**
   * Sets the line material. Rebuilds the line if it already exists.
   */
  setLineMaterial(material: Material): void {
    this.lineMaterial = material
    if (this.line) {
      this.rebuild()
    }
  }

  /**
   * Sets the line width.
   */
  setLineWidth(width: number): void {
    this.lineWidth = width
    if (this.line) {
      this.line.startWidth = width
      this.line.endWidth = width
    }
  }
  
  /**
   * Called every frame to update the line
   */
  onUpdate() {
    if (!this.startPointObject || !this.endPointObject || !this.line) {
      return
    }
    
    try {
      // Update the line points only when the start or end object has moved
      const startPosition = this.startPointObject.getTransform().getLocalPosition()
      const endPosition = this.endPointObject.getTransform().getLocalPosition()
      if (this.lastStartPosition && this.lastEndPosition &&
          startPosition.equal(this.lastStartPosition) && endPosition.equal(this.lastEndPosition)) {
        return
      }
      this.lastStartPosition = startPosition
      this.lastEndPosition = endPosition
      this.line.points = [startPosition, endPosition]
    } catch (e) {
      this.logger.debug("Error updating line: " + e);
    }
  }
  @bindDestroyEvent

  onDestroy(): void {
    if (this.line) {
      this.line.destroy()
    }
  }

}