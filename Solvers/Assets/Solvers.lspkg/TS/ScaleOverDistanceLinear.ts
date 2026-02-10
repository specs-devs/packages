/**
 * Specs Inc. 2026
 * Linear scaling based on distance to target. Automatically adjusts object scale using linear
 * interpolation between min/max distance thresholds, with configurable scale range and real-time
 * distance calculation for distance-based size adjustments and depth perception effects.
 */
@component
export class ScaleOverDistanceLinearTS extends BaseScriptComponent {
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Target Configuration</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Target object to measure distance from</span>')

    @input
    @allowUndefined
    @hint("Override default target mainCamera")
    target!: SceneObject;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Distance Range</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Minimum and maximum distance thresholds for scaling</span>')

    @input
    @allowUndefined
    @hint("Minimum distance to map the scaling")
    minDistance: number = 1.0;

    @input
    @allowUndefined
    @hint("Maximum distance to map the scaling")
    maxDistance: number = 10.0;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Scale Range</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Scale values at minimum and maximum distances</span>')

    @input
    @allowUndefined
    @hint("Minimum scale value")
    minScale: number = 0.5;

    @input
    @allowUndefined
    @hint("Maximum scale value")
    maxScale: number = 2.0;
    
    private _distance: number = 0;
    
    // Initialize with the proper pattern
    onAwake(): void {
        this.createEvent("OnStartEvent").bind(() => {
            this.onStart();
        });
        
        this.createEvent("UpdateEvent").bind(() => {
            this.onUpdate();
        });
    }
    
    onStart(): void {
        if (!this.target) {
            print("No target set for ScaleOverDistanceLinear - please set a target object");
        }
    }
    
    onUpdate(): void {
        if (!this.target) return;
        
        this.updateScale();
    }
    
    /**
     * Update the scale based on distance to target.
     */
    private updateScale(): void {
        // Get positions
        const myPosition = this.sceneObject.getTransform().getWorldPosition();
        const targetPosition = this.target.getTransform().getWorldPosition();
        
        // Calculate distance
        this._distance = this.calculateDistance(myPosition, targetPosition);
        
        // Calculate scale value based on distance
        const scale = this.remap(
            this._distance, 
            this.minDistance, 
            this.maxDistance, 
            this.minScale, 
            this.maxScale
        );
        
        // Apply uniform scale
        this.sceneObject.getTransform().setLocalScale(new vec3(scale, scale, scale));
    }
    
    /**
     * Calculate the distance between two points.
     */
    private calculateDistance(pointA: vec3, pointB: vec3): number {
        // Calculate absolute distance
        const dx = pointB.x - pointA.x;
        const dy = pointB.y - pointA.y;
        const dz = pointB.z - pointA.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    
    /**
     * Remap a value from one range to another.
     * @param value The value to remap
     * @param from1 Minimum of the input range
     * @param to1 Maximum of the input range
     * @param from2 Minimum of the output range
     * @param to2 Maximum of the output range
     * @returns Remapped value
     */
    private remap(value: number, from1: number, to1: number, from2: number, to2: number): number {
        // Ensure value is within the input range
        const clampedValue = Math.max(from1, Math.min(to1, value));
        
        // Calculate how far along the input range the value is (0 to 1)
        const percentage = (clampedValue - from1) / (to1 - from1);
        
        // Map that percentage to the output range
        return from2 + percentage * (to2 - from2);
    }
}
