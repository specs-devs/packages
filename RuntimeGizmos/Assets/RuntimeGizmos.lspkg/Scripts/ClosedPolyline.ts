/**
 * SPECS Inc. 2027
 * Runtime closed polyline gizmo for visualizing connected paths. Renders a sequence of lines
 * through control points with options for continuous or split segments, customizable colors,
 * and dynamic updates for path visualization.
 */
import { withAlpha } from "InteractionKit.lspkg/Utils/color"
import InteractorLineRenderer from "InteractionKit.lspkg/Components/Interaction/InteractorLineVisual/InteractorLineRenderer"
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent, bindUpdateEvent, bindLateUpdateEvent, bindDestroyEvent } from "SnapDecorators.lspkg/decorators";

@component
export class ClosedPolyline extends BaseScriptComponent {
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Polyline Configuration</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure control points and line rendering style</span>')

    @input
    @allowUndefined
    public points!: SceneObject[]

    @input
    @allowUndefined
    private lineMaterial!: Material

    @input("vec3", "{1, 1, 0}")
    @widget(new ColorWidget())
    public _color: vec3 = new vec3(1, 1, 0)

    @input
    private lineWidth: number = 0.5

    @input
    @widget(
        new ComboBoxWidget()
            .addItem("Full", 0)
            .addItem("Split", 1)
            .addItem("FadedEnd", 2),
    )
    public lineStyle: number = 0

    @input

    public continuousLine: boolean = true

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
  private logger: Logger;    private _enabled = true
    private lines: InteractorLineRenderer[] = []
    private transform!: Transform

    set isEnabled(isEnabled: boolean) {
        this._enabled = isEnabled
        this.lines.forEach(line => {
            line.getSceneObject().enabled = isEnabled
        })
    }

    get isEnabled(): boolean {
        return this._enabled
    }  /**
   * Called when component is initialized
   */
  onAwake(): void {
    // Initialize logger
    this.logger = new Logger("ClosedPolyline", this.enableLogging || this.enableLoggingLifecycle, true);

    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }


        this.transform = this.sceneObject.getTransform()

        if (!this.points || this.points.length === 0 || !this.lineMaterial) {
            this.logger.debug("Points or material not set yet; call rebuild() after assigning them");
            return
        }

        if (this.points.length < 2) {
            throw new Error("ClosedPolylineVisual requires at least 2 points")
        }

        this.createOrUpdateLines()
    }

    /**
     * (Re)creates the lines from the current inputs. Call after setting points and setLineMaterial()
     * from code (e.g. on a component added with createComponent).
     */
    rebuild(): void {
        this.refreshLine()
    }

    /**
     * Sets the line material and rebuilds the lines.
     */
    setLineMaterial(material: Material): void {
        this.lineMaterial = material
        this.refreshLine()
    }

    /**
     * Sets the line width.
     */
    setLineWidth(width: number): void {
        this.lineWidth = width
        this.lines.forEach(line => {
            line.startWidth = width
            line.endWidth = width
        })
    }

    refreshLine(): void {
        if (!this.points || this.points.length < 2 || !this.lineMaterial) {
            this.logger.debug("Cannot refresh line: Invalid state");
            return;
        }

        // Recalculate positions and update the lines
        this.createOrUpdateLines()
    }

    private createOrUpdateLines(): void {
        // Clear existing lines
        this.lines.forEach(line => line.destroy())
        this.lines = []

        const positions = this.points.map(point =>
            point.getTransform().getLocalPosition()
        )
        if (this.continuousLine) {
            // Render as a single closed line
            positions.push(positions[0])
            const line = new InteractorLineRenderer({
                material: this.lineMaterial,
                points: positions,
                startColor: withAlpha(this._color, 1),
                endColor: withAlpha(this._color, 1),
                startWidth: this.lineWidth,
                endWidth: this.lineWidth,
            })
            line.getSceneObject().setParent(this.sceneObject)
            line.visualStyle = this.lineStyle
            this.lines.push(line)
        } else {
            // Render as separate lines between each pair of points
            for (let i = 0; i < positions.length; i++) {
                const startIndex = i
                const endIndex = (i + 1) % positions.length
                const line = new InteractorLineRenderer({
                    material: this.lineMaterial,
                    points: [positions[startIndex], positions[endIndex]],
                    startColor: withAlpha(this._color, 1),
                    endColor: withAlpha(this._color, 1),
                    startWidth: this.lineWidth,
                    endWidth: this.lineWidth,
                })
                line.getSceneObject().setParent(this.sceneObject)
                line.visualStyle = this.lineStyle
                this.lines.push(line)
            }
        }

        this.isEnabled = this._enabled
    }

    @bindDestroyEvent


    onDestroy(): void {
        this.lines.forEach(line => line.destroy())
        this.lines = []
    }

    getPoints(): SceneObject[] {
        return this.points || []
    }

    setColor(color: vec3): void {
        this._color = color
        this.lines.forEach(line => {
            const colorWithAlpha = withAlpha(color, 1)
            line.startColor = colorWithAlpha
            line.endColor = colorWithAlpha
        })
    }

    setPoints(newPoints: SceneObject[]): void {
        if (newPoints.length < 2) {
            this.logger.debug("Error: At least 2 points are required");
            return;
        }
        this.points = newPoints
        this.refreshLine()
    }
}