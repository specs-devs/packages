import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent, bindUpdateEvent } from "SnapDecorators.lspkg/decorators";


/**
 * Reachy UI Manager
 *
 * Manages all UI component references for the Reachy control panel.
 * Assigns UI elements to the UIController for value management.
 */

import { Switch } from "SpectaclesUIKit.lspkg/Scripts/Components/Switch/Switch"
import { Slider } from "SpectaclesUIKit.lspkg/Scripts/Components/Slider/Slider"
import { BaseButton } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/BaseButton"
import { SwitchToggleGroup } from "SpectaclesUIKit.lspkg/Scripts/Components/Toggle/SwitchToggleGroup"

@component
export class ReachyUIManager extends BaseScriptComponent {
    // ═══════════════════════════════════════════════════════════
    // PANEL SCENE OBJECTS
    // ═══════════════════════════════════════════════════════════

    @ui.group_start("Panel Scene Objects")
    @input
    @allowUndefined
    @hint("Tracking mode panel (also serves as intro/home)")
    panelTracking: SceneObject

    @input
    @allowUndefined
    @hint("Speed controls panel")
    panelSpeed: SceneObject

    @input
    @allowUndefined
    @hint("Movement limits panel")
    panelMovements: SceneObject

    @input
    @allowUndefined
    @hint("Character/wobble panel")
    panelCharacter: SceneObject

    @input
    @allowUndefined
    @hint("Presets panel")
    panelPresets: SceneObject
    @ui.group_end

    // ═══════════════════════════════════════════════════════════
    // PANEL 1: TRACKING MODE
    // ═══════════════════════════════════════════════════════════

    @ui.group_start("Panel 1 - Tracking Mode")
    @input
    @allowUndefined
    @hint("Main tracking mode toggle (Idle vs Look-At)")
    trackingModeSwitch: Switch

    @input
    @allowUndefined
    @hint("Toggle group for Simulation vs Real Robot selection")
    robotModeToggleGroup: SwitchToggleGroup

    @input
    @allowUndefined
    @hint("Enable Simulation mode switch")
    enableSimulationSwitch: Switch

    @input
    @allowUndefined
    @hint("Enable Real Robot mode switch")
    enableReachySwitch: Switch
    @ui.group_end

    // ═══════════════════════════════════════════════════════════
    // PANEL 2: SPEED CONTROLS
    // ═══════════════════════════════════════════════════════════

    @ui.group_start("Panel 2 - Speed Controls")
    @input
    @allowUndefined
    @hint("Head yaw speed slider (0.01-0.2)")
    headYawSpeedSlider: Slider

    @input
    @allowUndefined
    @hint("Head pitch speed slider (0.01-0.2)")
    headPitchSpeedSlider: Slider

    @input
    @allowUndefined
    @hint("Body follow speed slider (0.01-0.2)")
    bodyFollowSpeedSlider: Slider

    @input
    @allowUndefined
    @hint("Antenna speed slider (0.01-0.1)")
    antennaSpeedSlider: Slider

    @input
    @allowUndefined
    @hint("Motion intensity slider (0.01-0.2)")
    motionIntensitySlider: Slider
    @ui.group_end

    // ═══════════════════════════════════════════════════════════
    // PANEL 3: MOVEMENT LIMITS
    // ═══════════════════════════════════════════════════════════

    @ui.group_start("Panel 3 - Movement Limits")
    @input
    @allowUndefined
    @hint("Max yaw speed slider (1-10 degrees)")
    maxYawSlider: Slider

    @input
    @allowUndefined
    @hint("Max pitch speed slider (0.5-5 degrees)")
    maxPitchSlider: Slider

    @input
    @allowUndefined
    @hint("Max antenna speed slider (1-5 degrees)")
    maxAntennaSlider: Slider
    @ui.group_end

    // ═══════════════════════════════════════════════════════════
    // PANEL 4: CHARACTER / WOBBLE
    // ═══════════════════════════════════════════════════════════

    @ui.group_start("Panel 4 - Character/Wobble")
    @input
    @allowUndefined
    @hint("Enable wobble toggle")
    enableWobbleSwitch: Switch

    @input
    @allowUndefined
    @hint("Pitch wobble slider (0-10 degrees)")
    pitchWobbleSlider: Slider

    @input
    @allowUndefined
    @hint("Yaw wobble slider (0-10 degrees)")
    yawWobbleSlider: Slider

    @input
    @allowUndefined
    @hint("Roll wobble slider (0-15 degrees)")
    rollWobbleSlider: Slider

    @input
    @allowUndefined
    @hint("Base antenna movement slider (0-15 degrees)")
    baseAntennaSlider: Slider

    @input
    @allowUndefined
    @hint("Wobble speed slider (0.1-2.0)")
    wobbleSpeedSlider: Slider
    @ui.group_end

    // ═══════════════════════════════════════════════════════════
    // PANEL 5: PRESETS
    // ═══════════════════════════════════════════════════════════

    @ui.group_start("Panel 5 - Presets")
    @input
    @allowUndefined
    @hint("Preset toggle group (manages Robotic/Natural/Expressive switches)")
    presetToggleGroup: SwitchToggleGroup

    @input
    @allowUndefined
    @hint("Robotic preset switch")
    roboticPresetSwitch: Switch

    @input
    @allowUndefined
    @hint("Natural preset switch")
    naturalPresetSwitch: Switch

    @input
    @allowUndefined
    @hint("Expressive preset switch")
    expressivePresetSwitch: Switch
    @ui.group_end

    // ═══════════════════════════════════════════════════════════
    // NAVIGATION
    // ═══════════════════════════════════════════════════════════

    @ui.group_start("Navigation Buttons")
    @input
    @allowUndefined
    @hint("X button in top-left corner (returns to Tracking panel)")
    closeButton: BaseButton

    @input
    @allowUndefined
    @hint("Left sidebar panel navigation buttons array: [0]=Tracking, [1]=Speed, [2]=Movements, [3]=Character, [4]=Presets")
    panelNavButtons: BaseButton[]
    @ui.group_end

    // ═══════════════════════════════════════════════════════════
    // CONTROLLERS
    // ═══════════════════════════════════════════════════════════

    @ui.group_start("Controllers")
    @input("Component.ScriptComponent")
    @allowUndefined
    @hint("ReachyUIController component")
    uiController: ScriptComponent

    @input("Component.ScriptComponent")
    @allowUndefined
    @hint("ReachyMiniController component (the robot controller)")
    reachyController: ScriptComponent
    @ui.group_end

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
        // Initialize logger
        this.logger = new Logger("ReachyUIManager", this.enableLogging || this.enableLoggingLifecycle, true);

        if (this.enableLoggingLifecycle) {
            this.logger.debug("LIFECYCLE: onStart() - Component initializing");
        }

        this.logger.info("[ReachyUIManager] Initializing UI...")

        // Show tracking panel and hide others
        this.showTrackingPanel()

        // Bind navigation buttons
        this.bindNavigationButtons()
        this.bindRobotModeSwitches()
        this.bindPresetSwitches()

        // Initialize controller with all UI references
        if (this.uiController) {
            const controller = this.uiController as any
            if (controller.initialize) {
                controller.initialize(this, this.reachyController)
                this.logger.info("[ReachyUIManager] Controller initialized")
            }
        }

        this.logger.info("[ReachyUIManager] ✓ Initialization complete!")
    }

    private bindNavigationButtons() {
        // Bind X button (returns to tracking panel / home)
        this.bindButton(this.closeButton, () => this.showTrackingPanel(), "Close/Home Button (X)")

        // Bind left sidebar panel navigation buttons
        if (this.panelNavButtons && this.panelNavButtons.length >= 5) {
            this.bindButton(this.panelNavButtons[0], () => this.showPanel(this.panelTracking), "Tracking Panel Button")
            this.bindButton(this.panelNavButtons[1], () => this.showPanel(this.panelSpeed), "Speed Panel Button")
            this.bindButton(this.panelNavButtons[2], () => this.showPanel(this.panelMovements), "Movements Panel Button")
            this.bindButton(this.panelNavButtons[3], () => this.showPanel(this.panelCharacter), "Character Panel Button")
            this.bindButton(this.panelNavButtons[4], () => this.showPanel(this.panelPresets), "Presets Panel Button")
        } else {
            this.logger.warn(`[ReachyUIManager] WARNING: panelNavButtons not fully assigned (need 5, got ${this.panelNavButtons?.length || 0})`)
        }
    }

    private bindRobotModeSwitches() {
        // Use the SwitchToggleGroup to handle Simulation vs Real Robot selection
        if (!this.robotModeToggleGroup) {
            this.logger.warn("[ReachyUIManager] WARNING: robotModeToggleGroup not assigned, skipping robot mode binding")
            return
        }

        if (!this.uiController) {
            this.logger.warn("[ReachyUIManager] WARNING: uiController not assigned, skipping robot mode binding")
            return
        }

        // Check that all switches are assigned
        if (!this.enableSimulationSwitch || !this.enableReachySwitch) {
            this.logger.warn("[ReachyUIManager] WARNING: Robot mode switches not fully assigned, skipping robot mode binding")
            this.logger.info(`[ReachyUIManager]   enableSimulationSwitch: ${!!this.enableSimulationSwitch}`)
            this.logger.info(`[ReachyUIManager]   enableReachySwitch: ${!!this.enableReachySwitch}`)
            return
        }

        const controller = this.uiController as any

        // Check that onToggleSelected event exists
        if (!this.robotModeToggleGroup.onToggleSelected) {
            this.logger.error("[ReachyUIManager] ERROR: robotModeToggleGroup.onToggleSelected is undefined!")
            this.logger.info("[ReachyUIManager]   This usually means the SwitchToggleGroup hasn't initialized yet")
            this.logger.info("[ReachyUIManager]   Make sure the component is enabled and properly configured")
            return
        }

        // Listen to toggle group's selection event
        this.robotModeToggleGroup.onToggleSelected.add((args: any) => {
            const selectedSwitch = args.toggleable

            this.logger.info(`[ReachyUIManager] Robot mode switch selected: ${selectedSwitch.sceneObject?.name}`)

            // Determine which mode was selected
            if (selectedSwitch === this.enableSimulationSwitch && controller.enableSimulationMode) {
                controller.enableSimulationMode()
            } else if (selectedSwitch === this.enableReachySwitch && controller.enableRealRobotMode) {
                controller.enableRealRobotMode()
            }
        })

        this.logger.info("[ReachyUIManager] Robot Mode SwitchToggleGroup configured")
    }

    private bindPresetSwitches() {
        // Use the SwitchToggleGroup to handle preset selection
        if (!this.presetToggleGroup) {
            this.logger.warn("[ReachyUIManager] WARNING: presetToggleGroup not assigned, skipping preset binding")
            return
        }

        if (!this.uiController) {
            this.logger.warn("[ReachyUIManager] WARNING: uiController not assigned, skipping preset binding")
            return
        }

        // Check that all preset switches are assigned
        if (!this.roboticPresetSwitch || !this.naturalPresetSwitch || !this.expressivePresetSwitch) {
            this.logger.warn("[ReachyUIManager] WARNING: Preset switches not fully assigned, skipping preset binding")
            this.logger.info(`[ReachyUIManager]   roboticPresetSwitch: ${!!this.roboticPresetSwitch}`)
            this.logger.info(`[ReachyUIManager]   naturalPresetSwitch: ${!!this.naturalPresetSwitch}`)
            this.logger.info(`[ReachyUIManager]   expressivePresetSwitch: ${!!this.expressivePresetSwitch}`)
            return
        }

        const controller = this.uiController as any

        // Check that onToggleSelected event exists
        if (!this.presetToggleGroup.onToggleSelected) {
            this.logger.error("[ReachyUIManager] ERROR: presetToggleGroup.onToggleSelected is undefined!")
            this.logger.info("[ReachyUIManager]   This usually means the SwitchToggleGroup hasn't initialized yet")
            this.logger.info("[ReachyUIManager]   Make sure the component is enabled and properly configured")
            return
        }

        // Listen to toggle group's selection event
        this.presetToggleGroup.onToggleSelected.add((args: any) => {
            const selectedSwitch = args.toggleable

            this.logger.info(`[ReachyUIManager] Preset switch selected: ${selectedSwitch.sceneObject?.name}`)

            // Determine which preset was selected and apply it
            if (selectedSwitch === this.roboticPresetSwitch && controller.applyRoboticPreset) {
                controller.applyRoboticPreset()
            } else if (selectedSwitch === this.naturalPresetSwitch && controller.applyNaturalPreset) {
                controller.applyNaturalPreset()
            } else if (selectedSwitch === this.expressivePresetSwitch && controller.applyExpressivePreset) {
                controller.applyExpressivePreset()
            }
        })

        this.logger.info("[ReachyUIManager] Preset SwitchToggleGroup configured")
    }

    private bindButton(button: BaseButton, handler: () => void, description: string) {
        if (button && button.onTriggerUp) {
            button.onTriggerUp.add(handler)
            this.logger.info(`[ReachyUIManager] Bound ${description}`)
        } else {
            this.logger.warn(`[ReachyUIManager] WARNING: ${description} not assigned or missing onTriggerUp`)
        }
    }

    private showTrackingPanel() {
        this.setPanelEnabled(this.panelTracking, true)
        this.setPanelEnabled(this.panelSpeed, false)
        this.setPanelEnabled(this.panelMovements, false)
        this.setPanelEnabled(this.panelCharacter, false)
        this.setPanelEnabled(this.panelPresets, false)
        this.logger.info("[ReachyUIManager] Showing tracking panel (home)")
    }

    private showPanel(panel: SceneObject) {
        this.setPanelEnabled(this.panelTracking, panel === this.panelTracking)
        this.setPanelEnabled(this.panelSpeed, panel === this.panelSpeed)
        this.setPanelEnabled(this.panelMovements, panel === this.panelMovements)
        this.setPanelEnabled(this.panelCharacter, panel === this.panelCharacter)
        this.setPanelEnabled(this.panelPresets, panel === this.panelPresets)

        const panelName = this.getPanelName(panel)
        this.logger.info(`[ReachyUIManager] Showing ${panelName} panel`)
    }

    private getPanelName(panel: SceneObject): string {
        if (panel === this.panelTracking) return "Tracking"
        if (panel === this.panelSpeed) return "Speed"
        if (panel === this.panelMovements) return "Movements"
        if (panel === this.panelCharacter) return "Character"
        if (panel === this.panelPresets) return "Presets"
        return "Unknown"
    }

    private setPanelEnabled(panel: SceneObject, enabled: boolean) {
        if (panel) {
            panel.enabled = enabled
        }
    }
}
