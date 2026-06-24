/**
 * Specs Inc. 2026
 * Place-in-scene manager for AnimationExamples.
 * Single script on the PLACE_IN_SCENE prefab root: spawns the 7 animation example
 * prefabs as disabled children, then dynamically builds a UIKit left/right arrow
 * cycler (buttons + title/description labels) from code. No other authored
 * SceneObjects are needed — drop this prefab into a scene and it just works.
 *
 * Architecture (spawned hierarchy):
 *   [AnimationExamples-__PLACE_IN_SCENE]   ← root, ScriptComponent (this)
 *   ├── Guide_ReadAndDisable             ← static Text, authored manually
 *   ├── Animations                       ← spawned container, holds the 7 prefab instances
 *   │     └── <PrefabName>               ← one enabled, rest disabled
 *   └── UI                               ← spawned container
 *         ├── LeftButton                 ← UIKit Button
 *         │     └── LeftText             ← Text "<"
 *         ├── RightButton                ← UIKit Button
 *         │     └── RightText            ← Text ">"
 *         ├── AnimationName              ← Text (current title)
 *         └── Pivot                      ← empty SceneObject
 *               └── AnimationDescription ← Text (current description)
 *
 * Public API: getCount, getCurrentIndex, getCurrentName, next, previous,
 * setActive — exposed so a custom UI (touch, voice, gaze) can drive the manager
 * without modifying it.
 */

// Preload ThemeService before any UIKit visual to break a circular-import init-order
// crash in the package (Visual.ts imports ThemeService before defining COLORS, and the
// theme chain reads COLORS at module-load). Loading ThemeService first lets Visual.ts
// finish initializing COLORS before the visual chain reads it.
import "SpectaclesUIKit.lspkg/Scripts/Themes/ThemeService";
import { Button } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button";

// ─── Layout constants ────────────────────────────────────────────────────────
// Tweak these to nudge the spawned hierarchy. The prefab root itself controls
// global position/scale via its own Transform; values below are local-space.
const LAYOUT = {
    // Animations container — sits above center, pushed back -5cm in Z so the
    // spawned Frame stack sits slightly behind the cycler arrow buttons.
    // Scale 1 because Frame prefabs are sized in cm directly (no 5× boost
    // needed like the old Box cubes had).
    animationsLocalPosition: new vec3(0, 8, -5),
    animationsLocalScale: new vec3(1, 1, 1),

    // Arrow buttons flank the animation. SceneObject scale stays at 1 so the
    // Button.size below controls visible dimensions directly (centimeters).
    leftButtonLocalPosition: new vec3(-8, -2, 0),
    rightButtonLocalPosition: new vec3(8, -2, 0),
    buttonLocalScale: new vec3(1, 1, 1),
    buttonSize: new vec3(6, 3, 3),

    titleLocalPosition: new vec3(0, -7, 0),
    titleFontSize: 56,

    pivotLocalPosition: new vec3(0, -11, 0),
    descriptionLocalPosition: new vec3(0, 0, 0),
    descriptionFontSize: 52,

    arrowGlyphFontSize: 44,

    leftGlyph: "<",
    rightGlyph: ">"
};

// ─── Entries map ─────────────────────────────────────────────────────────────
// Keys match each example prefab's root SceneObject name. Edit titles and
// descriptions here to retitle the cycler — the script picks up the matching
// entry by spawned SceneObject name.
type Entry = { key: string; title: string; description: string };

const ENTRIES: Entry[] = [
    {
        key: "ScaleSquishExample",
        title: "Scale Squish",
        description: "Spring-out easing curve that overshoots then settles — the classic squish-and-release feel."
    },
    {
        key: "PushOutZExample",
        title: "Push Out (Z)",
        description: "Explicit keyframes drive a Z translation past the target before settling back."
    },
    {
        key: "OpacityCallbackExample",
        title: "Opacity Callback",
        description: "AnimationPropertyLayer.setCustomProperty drives a material pass parameter via a callback."
    },
    {
        key: "SubscribeToFinishExample",
        title: "Subscribe To Finish",
        description: "Named event planted at the clip end acts as an onFinish hook through player.onEvent."
    },
    {
        key: "CustomTimestampEventExample",
        title: "Custom Timestamp Event",
        description: "Named event fires mid-clip — sync sounds, particles, or state changes to a precise moment."
    },
    {
        key: "FromAnimationAssetExample",
        title: "From Animation Asset",
        description: "Play an authored .animationAsset by dropping it on the AnimationPlayer's clip."
    },
    {
        key: "ExistingPlayerExample",
        title: "Existing Player",
        description: "Drive an AnimationPlayer that was fully configured in the Inspector — play its first clip on awake."
    },
    {
        key: "FrameSizingExample",
        title: "Frame Sizing",
        description: "Animate the Frame's innerSize directly — height pulses, then width pulses. Non-transform: the container itself resizes in place."
    }
];

@component
export class AnimationExamplesManager extends BaseScriptComponent {

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Animations</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Drag the 7 example prefabs from AnimationExamples.lspkg/Prefabs/ in any order.</span>')

    @input
    @hint("The animation example prefabs to spawn and cycle through.")
    animationPrefabs: ObjectPrefab[];

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Logging Configuration</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Control logging output for this script instance</span>')

    @input
    @hint("Enable general logging (spawn steps, cycle events, label updates, etc.)")
    enableLogging: boolean = false;

    @input
    @hint("Enable lifecycle logging (onAwake, onStart, onDestroy, etc.)")
    enableLoggingLifecycle: boolean = false;

    // Runtime state
    private instances: SceneObject[] = [];
    private currentIndex: number = 0;
    private animationsContainer: SceneObject | null = null;
    private uiContainer: SceneObject | null = null;
    private leftButton: Button | null = null;
    private rightButton: Button | null = null;
    private titleLabel: Text | null = null;
    private descriptionLabel: Text | null = null;

    // ─── Lifecycle ──────────────────────────────────────────────────────────

    /**
     * Component awake — spawn the animations container, the UI cycler, activate
     * the first entry, and defer button-handler wiring to OnStartEvent (UIKit
     * Button initializes `onTriggerUp` in its own onAwake; awake order is not
     * guaranteed).
     */
    onAwake(): void {
        if (this.enableLoggingLifecycle) print(`[${this.sceneObject.name}] AnimationExamplesManager.onAwake`);

        this.spawnAnimations();
        this.spawnUI();

        if (this.instances.length > 0) {
            this.activate(0);
        } else if (this.enableLogging) {
            print(`[${this.sceneObject.name}] AnimationExamplesManager: no animation prefabs assigned — nothing to cycle.`);
        }

        this.createEvent("OnStartEvent").bind(() => this.bindButtonHandlers());
    }

    // ─── Public API ─────────────────────────────────────────────────────────

    /**
     * Number of spawned animation instances.
     */
    public getCount(): number {
        return this.instances.length;
    }

    /**
     * Index of the currently-active animation instance.
     */
    public getCurrentIndex(): number {
        return this.currentIndex;
    }

    /**
     * Name of the currently-active animation instance (the SceneObject name of
     * the spawned prefab, e.g. "ScaleSquishExample"). Empty string if nothing
     * is active.
     */
    public getCurrentName(): string {
        if (this.instances.length === 0) return "";
        return this.instances[this.currentIndex].name;
    }

    /**
     * Advance to the next animation, wrapping at the end.
     */
    public next(): void {
        this.cycle(+1);
    }

    /**
     * Step to the previous animation, wrapping at the start.
     */
    public previous(): void {
        this.cycle(-1);
    }

    /**
     * Activate a specific animation by index. Out-of-range indices are clamped.
     *
     * @param index - Target index into the spawned instances
     */
    public setActive(index: number): void {
        if (this.instances.length === 0) return;
        const clamped = Math.max(0, Math.min(index, this.instances.length - 1));
        this.activate(clamped);
    }

    // ─── Private helpers ────────────────────────────────────────────────────

    /**
     * Create the `Animations` container under this SceneObject and instantiate
     * each non-null prefab into it. Each spawned instance is disabled until
     * `activate()` chooses one.
     */
    private spawnAnimations(): void {
        this.animationsContainer = global.scene.createSceneObject("Animations");
        this.animationsContainer.setParent(this.sceneObject);
        const t = this.animationsContainer.getTransform();
        t.setLocalPosition(LAYOUT.animationsLocalPosition);
        t.setLocalScale(LAYOUT.animationsLocalScale);

        if (!this.animationPrefabs || this.animationPrefabs.length === 0) {
            if (this.enableLogging) print(`[${this.sceneObject.name}] AnimationExamplesManager: animationPrefabs is empty.`);
            return;
        }

        for (let i = 0; i < this.animationPrefabs.length; i++) {
            const prefab = this.animationPrefabs[i];
            if (!prefab) continue;
            const instance = prefab.instantiate(this.animationsContainer);
            instance.enabled = false;
            this.instances.push(instance);
        }

        if (this.enableLogging) print(`[${this.sceneObject.name}] AnimationExamplesManager: spawned ${this.instances.length} animation instance(s).`);
    }

    /**
     * Create the `UI` container with two arrow buttons, a title label, and a
     * Pivot wrapping the description label.
     */
    private spawnUI(): void {
        this.uiContainer = global.scene.createSceneObject("UI");
        this.uiContainer.setParent(this.sceneObject);

        const left = this.spawnArrowButton("LeftButton", "LeftText", LAYOUT.leftGlyph, LAYOUT.leftButtonLocalPosition);
        this.leftButton = left.button;

        const right = this.spawnArrowButton("RightButton", "RightText", LAYOUT.rightGlyph, LAYOUT.rightButtonLocalPosition);
        this.rightButton = right.button;

        this.titleLabel = this.spawnTextLabel(this.uiContainer, "AnimationName", LAYOUT.titleLocalPosition, LAYOUT.titleFontSize);
        this.descriptionLabel = this.spawnPivotWithDescription();
    }

    /**
     * Create an arrow Button SceneObject under `UI` with a child Text glyph.
     * Hierarchy: UI → {buttonName} → {textName}.
     *
     * @param buttonName - SceneObject name for the button container
     * @param textName - SceneObject name for the glyph child
     * @param glyph - String shown in the child Text (e.g. "<" or ">")
     * @param localPosition - Local position of the button under UI
     */
    private spawnArrowButton(
        buttonName: string,
        textName: string,
        glyph: string,
        localPosition: vec3
    ): { sceneObject: SceneObject; button: Button } {
        const buttonSO = global.scene.createSceneObject(buttonName);
        buttonSO.setParent(this.uiContainer);
        const t = buttonSO.getTransform();
        t.setLocalPosition(localPosition);
        t.setLocalScale(LAYOUT.buttonLocalScale);

        const button = buttonSO.createComponent(Button.getTypeName()) as Button;
        button.size = LAYOUT.buttonSize;

        this.spawnTextLabel(buttonSO, textName, new vec3(0, 0, 0), LAYOUT.arrowGlyphFontSize, glyph);

        return { sceneObject: buttonSO, button };
    }

    /**
     * Create a SceneObject with a Component.Text child of `parent`.
     *
     * @param parent - SceneObject to parent the new Text under
     * @param name - SceneObject name
     * @param localPosition - Local position relative to `parent`
     * @param fontSize - Optional font size (defaults to LAYOUT.titleFontSize)
     * @param initialText - Optional initial text content
     * @returns The created Text component
     */
    private spawnTextLabel(
        parent: SceneObject,
        name: string,
        localPosition: vec3,
        fontSize: number = LAYOUT.titleFontSize,
        initialText: string = ""
    ): Text {
        const so = global.scene.createSceneObject(name);
        so.setParent(parent);
        so.getTransform().setLocalPosition(localPosition);
        const text = so.createComponent("Component.Text") as Text;
        text.size = fontSize;
        text.text = initialText;
        return text;
    }

    /**
     * Create the `Pivot` empty SceneObject under `UI` and place the
     * `AnimationDescription` Text under it. Matches the prior authored
     * hierarchy so the description can be anchored/rotated via the pivot.
     */
    private spawnPivotWithDescription(): Text {
        const pivot = global.scene.createSceneObject("Pivot");
        pivot.setParent(this.uiContainer);
        pivot.getTransform().setLocalPosition(LAYOUT.pivotLocalPosition);
        return this.spawnTextLabel(pivot, "AnimationDescription", LAYOUT.descriptionLocalPosition, LAYOUT.descriptionFontSize);
    }

    /**
     * Wire button taps to `previous()` / `next()`. Called from OnStartEvent so
     * the buttons' own onAwake has already initialized `onTriggerUp`.
     */
    private bindButtonHandlers(): void {
        if (this.enableLoggingLifecycle) print(`[${this.sceneObject.name}] AnimationExamplesManager.OnStartEvent — binding button handlers`);

        if (this.leftButton) {
            this.leftButton.onTriggerUp.add(() => {
                if (this.enableLogging) print(`[${this.sceneObject.name}] left arrow pressed`);
                this.previous();
            });
        }

        if (this.rightButton) {
            this.rightButton.onTriggerUp.add(() => {
                if (this.enableLogging) print(`[${this.sceneObject.name}] right arrow pressed`);
                this.next();
            });
        }
    }

    /**
     * Advance by `direction` (+1 or -1), wrapping at either end.
     *
     * @param direction - Step direction; +1 for next, -1 for previous
     */
    private cycle(direction: number): void {
        const n = this.instances.length;
        if (n === 0) return;
        const next = ((this.currentIndex + direction) % n + n) % n;
        this.activate(next);
    }

    /**
     * Enable the instance at `index`, disable the others, and refresh the
     * title and description labels from the matching ENTRIES entry.
     *
     * @param index - Index of the instance to activate
     */
    private activate(index: number): void {
        this.currentIndex = index;

        for (let i = 0; i < this.instances.length; i++) {
            this.instances[i].enabled = (i === index);
        }

        const active = this.instances[index];
        const entry = this.lookupEntry(active.name);

        if (this.titleLabel) this.titleLabel.text = entry.title;
        if (this.descriptionLabel) this.descriptionLabel.text = entry.description;

        if (this.enableLogging) print(`[${this.sceneObject.name}] activated [${index}] "${active.name}" → "${entry.title}"`);
    }

    /**
     * Resolve an ENTRIES entry from a spawned SceneObject name. Strips
     * surrounding brackets if present. Falls back to a synthesized entry that
     * uses the raw name as the title.
     *
     * @param childName - Raw spawned SceneObject name
     * @returns The matching Entry, or a fallback if no match exists
     */
    private lookupEntry(childName: string): Entry {
        const key = childName.replace(/^\[|\]$/g, "");
        for (let i = 0; i < ENTRIES.length; i++) {
            if (ENTRIES[i].key === key) return ENTRIES[i];
        }
        return { key, title: key, description: "" };
    }
}
