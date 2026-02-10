/**
 * Specs Inc. 2026
 * Organic position animator using multi-frequency sine waves for smooth motion. Animates scene objects
 * with random phase offsets and time variations per axis, provides configurable XYZ range and speed
 * parameters, implements smooth interpolation with lerp-based smoothing, and maintains initial positions
 * for offset-based movement creating natural flowing animations.
 */
@component
export class RandomPositionAnimator extends BaseScriptComponent {
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Animation Configuration</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Objects and motion parameters</span>')

    @input
    objectsToAnimate: SceneObject[];

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Motion Range</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Maximum movement distance per axis</span>')

    @input
    xRange: number = 10;

    @input
    yRange: number = 10;

    @input
    zRange: number = 10;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Timing Settings</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Animation speed and smoothing</span>')

    @input
    speed: number = 1.0;

    @input
    @hint("Smoothing factor for movement (0=instant, 1=very smooth)")
    smoothing: number = 0.1;

    private initialPositions: Map<SceneObject, vec3> = new Map();
    private currentPositions: Map<SceneObject, vec3> = new Map();
    private timeOffsets: Map<SceneObject, vec3> = new Map();
    private phaseOffsets: Map<SceneObject, vec3> = new Map();
    private elapsedTime: number = 0;

    onAwake() {
        if (!this.objectsToAnimate || this.objectsToAnimate.length === 0) {
            print("RandomPositionAnimator: No objects to animate!");
            return;
        }

        // Store initial positions and generate random parameters for each object
        for (const obj of this.objectsToAnimate) {
            if (obj) {
                const transform = obj.getTransform();
                const initialPos = transform.getLocalPosition();
                this.initialPositions.set(obj, initialPos);
                this.currentPositions.set(obj, initialPos);

                // Random time offset for wave phase
                this.timeOffsets.set(obj, new vec3(
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI * 2
                ));

                // Random phase offset to create different patterns
                this.phaseOffsets.set(obj, new vec3(
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI * 2
                ));
            }
        }

        // Create update event for continuous animation
        this.createEvent("UpdateEvent").bind(this.onUpdate.bind(this));
    }

    onUpdate() {
        const deltaTime = getDeltaTime();
        this.elapsedTime += deltaTime;

        // Update each object's position based on sine wave
        for (const obj of this.objectsToAnimate) {
            if (obj) {
                const transform = obj.getTransform();
                const initialPos = this.initialPositions.get(obj);
                const currentPos = this.currentPositions.get(obj);
                const timeOffset = this.timeOffsets.get(obj);
                const phaseOffset = this.phaseOffsets.get(obj);

                if (!initialPos || !currentPos || !timeOffset || !phaseOffset) continue;

                // Calculate target sine wave position
                const time = this.elapsedTime * this.speed;

                // Use different frequencies for each axis to create organic motion
                const xOffset = Math.sin(time + timeOffset.x) * this.xRange;
                const yOffset = Math.sin(time * 0.7 + timeOffset.y + phaseOffset.y) * this.yRange;
                const zOffset = Math.sin(time * 1.3 + timeOffset.z + phaseOffset.z) * this.zRange;

                const targetPosition = initialPos.add(new vec3(xOffset, yOffset, zOffset));

                // Smooth interpolation between current and target position
                const smoothedPosition = vec3.lerp(currentPos, targetPosition, this.smoothing);

                // Update stored current position
                this.currentPositions.set(obj, smoothedPosition);

                // Apply to transform
                transform.setLocalPosition(smoothedPosition);
            }
        }
    }
}
