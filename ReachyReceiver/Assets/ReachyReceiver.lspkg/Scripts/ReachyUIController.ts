import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent, bindUpdateEvent } from "SnapDecorators.lspkg/decorators";


/**
 * Reachy UI Controller
 *
 * Handles logic for updating Reachy control parameters based on UI inputs.
 * Maps slider values to ReachyMiniController properties in real-time.
 */

import { Switch } from "SpectaclesUIKit.lspkg/Scripts/Components/Switch/Switch"
import { Slider } from "SpectaclesUIKit.lspkg/Scripts/Components/Slider/Slider"
import { DaemonInterface } from "./DaemonInterface"

// Slider configuration type
interface SliderConfig {
    slider: Slider
    min: number
    max: number
    controllerProperty: string
    label: string
}

@component
export class ReachyUIController extends BaseScriptComponent {
    // HARDCODED: Bridge runs on your computer, both simulation and real robot connect through it
    // The bridge (websocket_bridge.py) forwards commands to the robot at ROBOT_IP:8000 (e.g., 192.168.1.200:8000)
    private static readonly SIMULATION_URL: string = "http://localhost:8000";
    private static readonly REAL_ROBOT_URL: string = "http://localhost:8000"; // Bridge forwards to real robot
    private static readonly START_IN_SIMULATION_MODE: boolean = false; // Start with real robot

    private get simulationUrl(): string { return ReachyUIController.SIMULATION_URL; }
    private get realRobotUrl(): string { return ReachyUIController.REAL_ROBOT_URL; }
    private get startInSimulationMode(): boolean { return ReachyUIController.START_IN_SIMULATION_MODE; }

    private uiManager: any = null
    private reachyController: any = null
    private sliderConfigs: SliderConfig[] = []

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
     * Initialize controller with UI references
     * Called by ReachyUIManager.onStart()
     */
    public initialize(uiManager: any, reachyController: any) {
        this.uiManager = uiManager
        this.reachyController = reachyController

        // Initialize logger
        this.logger = new Logger("ReachyUIController", this.enableLogging || this.enableLoggingLifecycle, true);

        if (this.enableLoggingLifecycle) {
            this.logger.debug("LIFECYCLE: initialize() - Component initializing");
        }

        if (this.enableLogging) {
            this.logger.info("[ReachyUIController] Initializing with UI and robot controller...");
        }

        // Set initial robot connection mode
        if (this.startInSimulationMode) {
            this.enableSimulationMode()
        } else {
            this.enableRealRobotMode()
        }

        this.setupSliders()
        this.setupSwitches()
        this.syncUIFromController() // Read initial values from ReachyMiniController

        this.logger.info("[ReachyUIController] Initialization complete!")
    }

    /**
     * Sync UI sliders and switches to match ReachyMiniController Inspector values
     * Call this whenever you change values in the Inspector
     */
    public syncUIFromController() {
        if (!this.reachyController) {
            this.logger.info("[ReachyUIController] Cannot sync: reachyController not set")
            return
        }

        this.logger.info("[ReachyUIController] Syncing UI from ReachyMiniController Inspector values...")

        let syncedCount = 0
        let skippedCount = 0

        // Update all sliders to match controller values
        for (const config of this.sliderConfigs) {
            if (!config.slider) {
                skippedCount++
                continue
            }

            const currentValue = this.reachyController[config.controllerProperty]
            if (currentValue !== undefined) {
                try {
                    const normalizedValue = (currentValue - config.min) / (config.max - config.min)
                    config.slider.currentValue = normalizedValue
                    this.logger.info(`[ReachyUIController]   ${config.label}: ${currentValue.toFixed(3)} (${(normalizedValue * 100).toFixed(0)}%)`)
                    syncedCount++
                } catch (e) {
                    this.logger.warn(`[ReachyUIController]   WARNING: Could not sync ${config.label}: ${e}`)
                    skippedCount++
                }
            } else {
                this.logger.warn(`[ReachyUIController]   WARNING: ${config.controllerProperty} is undefined in controller`)
                skippedCount++
            }
        }

        // Update wobble switch
        if (this.uiManager && this.uiManager.enableWobbleSwitch) {
            const wobbleEnabled = this.reachyController.enableWobble === true
            if (this.uiManager.enableWobbleSwitch.toggle) {
                try {
                    this.uiManager.enableWobbleSwitch.toggle(wobbleEnabled)
                    this.logger.info(`[ReachyUIController]   Wobble switch: ${wobbleEnabled ? "ON" : "OFF"}`)
                } catch (e) {
                    this.logger.warn(`[ReachyUIController]   WARNING: Could not sync wobble switch: ${e}`)
                }
            }
        }

        this.logger.info(`[ReachyUIController] ✓ UI sync complete: ${syncedCount} synced, ${skippedCount} skipped`)
    }

    /**
     * Configure all sliders with ranges
     * Note: Default values are read from ReachyMiniController, not hardcoded here
     */
    private setupSliders() {
        if (!this.uiManager) return

        // Speed Panel Sliders
        this.addSlider(
            this.uiManager.headYawSpeedSlider,
            0.01, 0.2,
            "HEAD_YAW_SMOOTHING",
            "Head Yaw Speed"
        )
        this.addSlider(
            this.uiManager.headPitchSpeedSlider,
            0.01, 0.2,
            "HEAD_PITCH_SMOOTHING",
            "Head Pitch Speed"
        )
        this.addSlider(
            this.uiManager.bodyFollowSpeedSlider,
            0.01, 0.2,
            "BODY_SMOOTHING",
            "Body Follow Speed"
        )
        this.addSlider(
            this.uiManager.antennaSpeedSlider,
            0.01, 0.1,
            "ANTENNA_SMOOTHING",
            "Antenna Speed"
        )
        this.addSlider(
            this.uiManager.motionIntensitySlider,
            0.01, 0.2,
            "MOTION_INTENSITY_SMOOTHING",
            "Motion Intensity"
        )

        // Movements Panel Sliders
        this.addSlider(
            this.uiManager.maxYawSlider,
            1, 10,
            "maxYawChangeDegrees",
            "Max Yaw Speed"
        )
        this.addSlider(
            this.uiManager.maxPitchSlider,
            0.5, 5,
            "maxPitchChangeDegrees",
            "Max Pitch Speed"
        )
        this.addSlider(
            this.uiManager.maxAntennaSlider,
            1, 5,
            "maxAntennaChangeDegrees",
            "Max Antenna Speed"
        )

        // Character Panel Sliders
        this.addSlider(
            this.uiManager.pitchWobbleSlider,
            0, 10,
            "pitchWobbleDegrees",
            "Pitch Wobble"
        )
        this.addSlider(
            this.uiManager.yawWobbleSlider,
            0, 10,
            "yawWobbleDegrees",
            "Yaw Wobble"
        )
        this.addSlider(
            this.uiManager.rollWobbleSlider,
            0, 15,
            "rollWobbleDegrees",
            "Roll Wobble"
        )
        this.addSlider(
            this.uiManager.baseAntennaSlider,
            0, 15,
            "antennaBaseDegrees",
            "Base Antenna"
        )
        this.addSlider(
            this.uiManager.wobbleSpeedSlider,
            0.1, 2.0,
            "WOBBLE_SPEED",
            "Wobble Speed"
        )

        this.logger.info(`[ReachyUIController] Configured ${this.sliderConfigs.length} sliders`)
    }

    /**
     * Add a slider configuration and bind its events
     * Note: Initial values are set via syncUIFromController(), not here
     */
    private addSlider(
        slider: Slider,
        min: number,
        max: number,
        controllerProperty: string,
        label: string
    ) {
        if (!slider) {
            this.logger.warn(`[ReachyUIController] WARNING: Slider for ${label} not assigned`)
            return
        }

        const config: SliderConfig = {
            slider,
            min,
            max,
            controllerProperty,
            label
        }

        this.sliderConfigs.push(config)

        // Bind to slider value changes
        if (slider.onValueChange) {
            slider.onValueChange.add((normalizedValue: number) => {
                this.handleSliderChange(config, normalizedValue)
            })
        }
    }

    /**
     * Setup switch (toggle) controls
     */
    private setupSwitches() {
        if (!this.uiManager) return

        // Tracking mode switch - controls robot state (Idle vs LookAtTarget)
        if (this.uiManager.trackingModeSwitch && this.uiManager.trackingModeSwitch.onValueChange) {
            this.uiManager.trackingModeSwitch.onValueChange.add((value: number) => {
                const isIdle = value === 0  // 0 = Idle, 1 = LookAtTarget
                this.logger.info(`[ReachyUIController] Tracking mode: ${isIdle ? "Idle" : "Look-At Target"}`)

                // Update robot state
                if (this.reachyController && this.reachyController.setStateFromUI) {
                    this.reachyController.setStateFromUI(isIdle)
                }
            })
        }

        // Enable wobble switch
        if (this.uiManager.enableWobbleSwitch && this.uiManager.enableWobbleSwitch.onValueChange) {
            this.uiManager.enableWobbleSwitch.onValueChange.add((value: number) => {
                const enabled = value === 1
                if (this.reachyController) {
                    this.reachyController.enableWobble = enabled
                    this.logger.info(`[ReachyUIController] Wobble: ${enabled ? "ENABLED" : "DISABLED"}`)
                }
            })
        }

        this.logger.info("[ReachyUIController] Switches configured")
    }

    /**
     * Handle slider value change
     */
    private handleSliderChange(config: SliderConfig, normalizedValue: number) {
        if (!this.reachyController) return

        // Map normalized value (0-1) to actual range
        const actualValue = config.min + normalizedValue * (config.max - config.min)

        // Update ReachyMiniController property
        this.reachyController[config.controllerProperty] = actualValue

        this.logger.info(`[ReachyUIController] ${config.label}: ${actualValue.toFixed(3)}`)
    }


    /**
     * Enable Simulation Mode
     * Connects to localhost:8000 for MuJoCo simulation
     */
    public enableSimulationMode() {
        this.logger.info("[ReachyUIController] Enabling SIMULATION mode")

        const daemon = DaemonInterface.getInstance()
        if (daemon) {
            daemon.setBaseUrl(this.simulationUrl)
            this.logger.info(`[ReachyUIController] ✓ Simulation mode enabled: ${this.simulationUrl}`)
        } else {
            this.logger.error("[ReachyUIController] ERROR: DaemonInterface not found!")
        }
    }

    /**
     * Enable Real Robot Mode
     * Connects to physical Reachy Mini on network
     */
    public enableRealRobotMode() {
        this.logger.info("[ReachyUIController] Enabling REAL ROBOT mode")

        const daemon = DaemonInterface.getInstance()
        if (daemon) {
            daemon.setBaseUrl(this.realRobotUrl)
            this.logger.info(`[ReachyUIController] ✓ Real robot mode enabled: ${this.realRobotUrl}`)
        } else {
            this.logger.error("[ReachyUIController] ERROR: DaemonInterface not found!")
        }
    }

    /**
     * Preset: Robotic (fast, precise, no wobble)
     */
    public applyRoboticPreset() {
        this.logger.info("[ReachyUIController] Applying ROBOTIC preset")

        this.applyPreset({
            HEAD_YAW_SMOOTHING: 0.15,
            HEAD_PITCH_SMOOTHING: 0.15,
            BODY_SMOOTHING: 0.1,
            ANTENNA_SMOOTHING: 0.05,
            MOTION_INTENSITY_SMOOTHING: 0.1,
            maxYawChangeDegrees: 10,
            maxPitchChangeDegrees: 5,
            maxAntennaChangeDegrees: 5,
            enableWobble: false,
            pitchWobbleDegrees: 0,
            yawWobbleDegrees: 0,
            rollWobbleDegrees: 0,
            antennaBaseDegrees: 2,
            WOBBLE_SPEED: 0.1
        })
    }

    /**
     * Preset: Natural (balanced, medium wobble)
     */
    public applyNaturalPreset() {
        this.logger.info("[ReachyUIController] Applying NATURAL preset")

        this.applyPreset({
            HEAD_YAW_SMOOTHING: 0.06,
            HEAD_PITCH_SMOOTHING: 0.04,
            BODY_SMOOTHING: 0.04,
            ANTENNA_SMOOTHING: 0.025,
            MOTION_INTENSITY_SMOOTHING: 0.05,
            maxYawChangeDegrees: 3,
            maxPitchChangeDegrees: 1.5,
            maxAntennaChangeDegrees: 2,
            enableWobble: true,
            pitchWobbleDegrees: 6,
            yawWobbleDegrees: 5,
            rollWobbleDegrees: 8,
            antennaBaseDegrees: 8,
            WOBBLE_SPEED: 0.4
        })
    }

    /**
     * Preset: Expressive (slow, high wobble, animated)
     */
    public applyExpressivePreset() {
        this.logger.info("[ReachyUIController] Applying EXPRESSIVE preset")

        this.applyPreset({
            HEAD_YAW_SMOOTHING: 0.03,
            HEAD_PITCH_SMOOTHING: 0.02,
            BODY_SMOOTHING: 0.02,
            ANTENNA_SMOOTHING: 0.02,
            MOTION_INTENSITY_SMOOTHING: 0.03,
            maxYawChangeDegrees: 2,
            maxPitchChangeDegrees: 1,
            maxAntennaChangeDegrees: 1.5,
            enableWobble: true,
            pitchWobbleDegrees: 10,
            yawWobbleDegrees: 8,
            rollWobbleDegrees: 12,
            antennaBaseDegrees: 12,
            WOBBLE_SPEED: 0.6
        })
    }

    /**
     * Apply a preset configuration
     */
    private applyPreset(preset: { [key: string]: number | boolean }) {
        this.logger.info("[ReachyUIController] Applying preset...")

        // Update controller properties directly
        if (this.reachyController) {
            for (const key in preset) {
                this.reachyController[key] = preset[key]
                this.logger.info(`[ReachyUIController]   ${key} = ${preset[key]}`)
            }
        }

        // Update slider positions
        for (const config of this.sliderConfigs) {
            const presetValue = preset[config.controllerProperty]
            if (presetValue !== undefined && typeof presetValue === "number" && config.slider) {
                const normalizedValue = (presetValue - config.min) / (config.max - config.min)
                config.slider.currentValue = normalizedValue
                this.logger.info(`[ReachyUIController]   ${config.label} slider → ${(normalizedValue * 100).toFixed(0)}%`)
            }
        }

        // Update wobble switch
        if (this.uiManager && this.uiManager.enableWobbleSwitch) {
            const wobbleEnabled = preset.enableWobble === true
            if (this.uiManager.enableWobbleSwitch.toggle) {
                this.uiManager.enableWobbleSwitch.toggle(wobbleEnabled)
                this.logger.info(`[ReachyUIController]   Wobble switch → ${wobbleEnabled ? "ON" : "OFF"}`)
            }
        }

        this.logger.info("[ReachyUIController] ✓ Preset applied successfully!")
    }
}
