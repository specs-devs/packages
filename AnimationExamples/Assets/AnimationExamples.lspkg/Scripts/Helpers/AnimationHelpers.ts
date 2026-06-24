/**
 * Specs Inc. 2026
 * Shared helpers for the AnimationPlayer examples.
 * Two utilities:
 *   - playFirstClip: wire the AnimationPlayer's first clip to either the
 *     Inspector-assigned AnimationAsset or a script-built fallback.
 *   - buildFrameUI: spawn a SpectaclesUIKit Frame's contents (Text label +
 *     Button with its own Text) as children of a SceneObject whose Frame
 *     ScriptComponent is already attached.
 */

// Preload ThemeService before any UIKit visual to break a circular-import init-order
// crash in the package (Visual.ts imports ThemeService before defining COLORS, and the
// theme chain reads COLORS at module-load). Loading ThemeService first lets Visual.ts
// finish initializing COLORS before the visual chain reads it.
import "SpectaclesUIKit.lspkg/Scripts/Themes/ThemeService";
import { Button } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button";
import { Frame } from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame";

// ─── Frame UI spawn ──────────────────────────────────────────────────────────

/** Layout values for the spawned Frame children — adjust in one place. */
const FRAME_UI_LAYOUT = {
    titleLocalPosition: new vec3(0, 2, 0),
    titleFontSize: 36,
    // Text wrap is controlled by text.worldSpaceRect (the "Layout Rect" in the
    // Inspector). Width tuned just inside the Frame's 7.5×7.5 bounds; height is
    // generous so wrapped lines aren't clipped vertically.
    titleBoxWidth: 7,
    titleBoxHeight: 4,
    buttonLocalPosition: new vec3(0, -3, 0),
    buttonSize: new vec3(8, 3, 3),
    buttonTextFontSize: 32,
    buttonTextBoxWidth: 7.5,
    buttonTextBoxHeight: 3,
    // Render order: Frame background at 0, Button visual at 1, all Text on top at 2.
    // Higher renders later (in front). UIKit's VisualElement.renderOrder forwards to
    // its internal renderMeshVisual.
    frameRenderOrder: 0,
    buttonRenderOrder: 1,
    textRenderOrder: 2
};

/**
 * Build a centered Rect of `width` × `height` for use as Text.worldSpaceRect.
 *
 * @param width - Rect width in centimeters
 * @param height - Rect height in centimeters
 */
function centeredRect(width: number, height: number): Rect {
    return Rect.create(-width / 2, width / 2, -height / 2, height / 2);
}

/** References returned from buildFrameUI for later runtime manipulation. */
export type FrameUI = {
    titleText: Text;
    button: Button;
    buttonText: Text;
    /** Convenience for opacity sweeps — every Text in the stack. */
    allTexts: Text[];
};

/**
 * Spawn a UIKit Frame stack (Text label + Button with its own Text) as
 * children of `parent`. The Frame ScriptComponent is expected to already be
 * attached to `parent` (configured in the prefab); this helper only creates
 * the children that live inside the Frame.
 *
 * @param parent - SceneObject hosting the Frame ScriptComponent
 * @param options - title (rendered above the button) and buttonText (rendered inside the button)
 * @returns References to the spawned Text and Button components
 */
export function buildFrameUI(
    parent: SceneObject,
    options: { title: string; buttonText: string }
): FrameUI {
    // Pin the Frame's own render order so it stays behind the Button and Text.
    const frame = parent.getComponent(Frame.getTypeName()) as Frame;
    if (frame) frame.renderOrder = FRAME_UI_LAYOUT.frameRenderOrder;

    // Title label above the button
    const titleSO = global.scene.createSceneObject("AnimationName");
    titleSO.setParent(parent);
    titleSO.getTransform().setLocalPosition(FRAME_UI_LAYOUT.titleLocalPosition);
    const titleText = titleSO.createComponent("Component.Text") as Text;
    titleText.size = FRAME_UI_LAYOUT.titleFontSize;
    titleText.text = options.title;
    titleText.horizontalOverflow = HorizontalOverflow.Wrap;
    titleText.worldSpaceRect = centeredRect(FRAME_UI_LAYOUT.titleBoxWidth, FRAME_UI_LAYOUT.titleBoxHeight);
    titleText.renderOrder = FRAME_UI_LAYOUT.textRenderOrder;

    // Button below the title
    const buttonSO = global.scene.createSceneObject("Button");
    buttonSO.setParent(parent);
    buttonSO.getTransform().setLocalPosition(FRAME_UI_LAYOUT.buttonLocalPosition);
    const button = buttonSO.createComponent(Button.getTypeName()) as Button;
    button.size = FRAME_UI_LAYOUT.buttonSize;
    button.renderOrder = FRAME_UI_LAYOUT.buttonRenderOrder;

    // Button's own text label (child of the button SceneObject) — renders on top of the button.
    const buttonTextSO = global.scene.createSceneObject("ButtonText");
    buttonTextSO.setParent(buttonSO);
    const buttonText = buttonTextSO.createComponent("Component.Text") as Text;
    buttonText.size = FRAME_UI_LAYOUT.buttonTextFontSize;
    buttonText.text = options.buttonText;
    buttonText.horizontalOverflow = HorizontalOverflow.Wrap;
    buttonText.worldSpaceRect = centeredRect(FRAME_UI_LAYOUT.buttonTextBoxWidth, FRAME_UI_LAYOUT.buttonTextBoxHeight);
    buttonText.renderOrder = FRAME_UI_LAYOUT.textRenderOrder;

    return { titleText, button, buttonText, allTexts: [titleText, buttonText] };
}

// ─── AnimationPlayer wiring ──────────────────────────────────────────────────

/**
 * Drive the AnimationPlayer's first clip with either the Inspector-assigned
 * animation asset or a script-built fallback. The developer fully owns the
 * AnimationPlayer component (Add an AnimationPlayer; add one clip; configure
 * Name / Playback Mode / Speed / Weight / Range). If the clip's Animation Asset
 * slot is empty, the runtime fallback asset is used.
 *
 * @param sceneObject - The SceneObject hosting the AnimationPlayer component
 * @param fallbackAsset - Runtime-built asset used when the Inspector clip's
 *   Animation Asset slot is empty
 * @param onEvent - Optional subscriber for player.onEvent
 * @param logSetup - When true, prints the chosen asset path and clip configuration
 * @returns The AnimationPlayer that was driven, or null if setup is incomplete
 */
export function playFirstClip(
    sceneObject: SceneObject,
    fallbackAsset: AnimationAsset,
    onEvent?: (args: AnimationPlayerOnEventArgs) => void,
    logSetup: boolean = false
): AnimationPlayer | null {
    const player = sceneObject.getComponent("Component.AnimationPlayer") as AnimationPlayer;
    if (!player) {
        print(`[${sceneObject.name}] requires an AnimationPlayer component — add one in the Inspector.`);
        return null;
    }

    const template = player.clips && player.clips.length > 0 ? player.clips[0] : null;
    if (!template) {
        print(`[${sceneObject.name}] AnimationPlayer has no clips — add a Clip in the Inspector.`);
        return null;
    }

    const clipName = template.name;
    const inspectorAsset = template.animation;
    const asset = inspectorAsset ?? fallbackAsset;

    if (logSetup) {
        print(`[${sceneObject.name}] playing clip "${clipName}" — ${inspectorAsset ? "using Inspector-wired asset (Clip 0 → Animation Asset)" : "using runtime-built fallback asset"}. Mode=${template.playbackMode}, weight=${template.weight}, speed=${template.playbackSpeed}, begin=${template.begin}, end=${template.end}.`);
    }

    const clip = AnimationClip.createFromAnimation(clipName, asset);
    clip.playbackMode = template.playbackMode;
    clip.weight = template.weight;
    clip.playbackSpeed = template.playbackSpeed;
    clip.begin = template.begin;
    clip.end = template.end;
    clip.offset = template.offset;
    clip.reversed = template.reversed;
    clip.disabled = template.disabled;
    clip.blendMode = template.blendMode;
    clip.scaleMode = template.scaleMode;

    player.removeClip(clipName);
    player.addClip(clip);

    if (onEvent) {
        player.onEvent.add(onEvent);
    }

    player.playClip(clipName);
    return player;
}

/**
 * Flat curve that holds its starting value across t=0..1. Useful as a "this
 * axis doesn't move" placeholder when assembling a vec3 track.
 *
 * @returns An AnimationCurve that stays at 0 for the full duration
 */
export function flatCurve(): AnimationCurve {
    return AnimationCurve.createEasingCurve(0, 0, 0, 0, 1, 1);
}
