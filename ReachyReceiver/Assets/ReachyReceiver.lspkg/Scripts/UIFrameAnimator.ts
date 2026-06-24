import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent } from "SnapDecorators.lspkg/decorators";
import animate, {CancelFunction}  from "SpectaclesInteractionKit.lspkg/Utils/animate"
import Event, { PublicApi } from "SpectaclesInteractionKit.lspkg/Utils/Event"
import { Frame } from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame";

/**
 * Specs Inc. 2026
 * Animates UI Frame visibility with smooth scale transitions.
 * Provides show/hide animations with event callbacks for visibility changes.
 */
@component
export class UIFrameAnimator extends BaseScriptComponent {
    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Configuration</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Frame animation settings</span>')

    @input
    @hint("Initial visibility state of the frame")
    private initialVisibility : boolean = true;

    @input
    @hint("Default scale of the frame when visible")
    private defaultScale : vec3 = new vec3(1, 1, 1);

    @input
    @hint("Frame component to animate")
    private frame : Frame | null = null;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Logging Configuration</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Control logging output for this script instance</span>')

    @input
    @hint("Enable general logging (operations, events, etc.)")
    enableLogging: boolean = false;

    @input
    @hint("Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.)")
    enableLoggingLifecycle: boolean = false;

    private logger: Logger;
    private isVisible : boolean = true;
    private currentAnimation : CancelFunction | null = null;

    // Event for when the frame visibility changes
    private _onFrameVisibilityChangedEvent: Event<boolean> = new Event<boolean>();
    readonly onFrameVisibilityChanged: PublicApi<boolean> = this._onFrameVisibilityChangedEvent.publicApi();

    /**
     * Called when component starts
     */
    @bindStartEvent
    onStart(): void {
        this.logger = new Logger("UIFrameAnimator", this.enableLogging || this.enableLoggingLifecycle, true);

        if (this.enableLoggingLifecycle) {
            this.logger.debug("LIFECYCLE: onStart() - Component initializing");
        }

        if (!this.initialVisibility) {
            this.getSceneObject().getTransform().setLocalScale(new vec3(0, 0, 0));
            this.isVisible = false;

            if (this.enableLogging) {
                this.logger.info("Setting initial visibility to hidden");
            }
        }
    }

    // ------------------------------------------------------------------------------------------------
    // API
    // ------------------------------------------------------------------------------------------------

    /**
     * Animate frame to show
     */
    public async animateShow() {
        await this.animateFrameVisibility(true);
    }

    /**
     * Animate frame to hide
     */
    public async animateHide() {
        await this.animateFrameVisibility(false);
    }

    /**
     * Animate frame visibility with optional transform
     * @param visible - Target visibility state
     * @param transform - Optional transform to position frame at
     */
    public async animateFrameVisibility(visible : boolean, transform? : Transform) {
        let duration = 0.6;
        let following = this.frame.following;

        if (this.isVisible === visible) {
            if (this.enableLogging) {
                this.logger.debug(`Frame already ${visible ? 'visible' : 'hidden'}, skipping animation`);
            }
            return;
        }

        // Cancel any current animations
        if (this.currentAnimation !== null) {
            this.currentAnimation();
            this.currentAnimation = null;
        }

        // Set the location if provided
        const sceneObject = this.getSceneObject();
        if (transform) {
            if (following) {
                this.frame.setFollowing(false);
            }
            sceneObject.getTransform().setWorldPosition(transform.getWorldPosition());
            sceneObject.getTransform().setWorldRotation(transform.getWorldRotation());
        }

        // Use current local scale as starting point to avoid pops
        let startScale : vec3;
        startScale = sceneObject.getTransform().getLocalScale();

        let targetScale : vec3;
        targetScale = visible
            ? this.defaultScale
            : new vec3(this.defaultScale.x, 0.00, this.defaultScale.z);

        // Modulate hide animation to be faster than show animation
        if (!visible) {
            duration *= 0.65;
        }

        if (this.enableLogging) {
            this.logger.info(`Animating frame to ${visible ? 'show' : 'hide'} over ${duration}s`);
        }

        await new Promise<void>((resolve) => {
            this.currentAnimation = animate({
                duration: duration,
                easing: "ease-in-out-quad",
                update: (t: number) => {
                    const x = startScale.x + (targetScale.x - startScale.x) * t;
                    const y = startScale.y + (targetScale.y - startScale.y) * t;
                    const z = startScale.z + (targetScale.z - startScale.z) * t;
                    sceneObject.getTransform().setLocalScale(new vec3(x, y, z));
                },
                ended: () => {
                    resolve();
                },
                cancelled: () => {
                    resolve();
                }
            });
        }).finally(() => {
            this.currentAnimation = null;
        });

        if (following) {
            this.frame.setFollowing(true);
        }
        this.isVisible = visible;
        this._onFrameVisibilityChangedEvent.invoke(visible);

        if (this.enableLogging) {
            this.logger.info(`Frame animation complete, visible=${visible}`);
        }
    }
}
