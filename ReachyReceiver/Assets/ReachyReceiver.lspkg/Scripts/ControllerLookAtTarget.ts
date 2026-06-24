import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent } from "SnapDecorators.lspkg/decorators";

/**
 * Specs Inc. 2026
 * Controller for managing look-at target behavior.
 * Currently a placeholder for future look-at functionality.
 */
@component
export class ControllerLookAtTarget extends BaseScriptComponent {
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

    /**
     * Called when component starts
     */
    @bindStartEvent
    onStart(): void {
        this.logger = new Logger("ControllerLookAtTarget", this.enableLogging || this.enableLoggingLifecycle, true);

        if (this.enableLoggingLifecycle) {
            this.logger.debug("LIFECYCLE: onStart() - Component initializing");
        }
    }
}
