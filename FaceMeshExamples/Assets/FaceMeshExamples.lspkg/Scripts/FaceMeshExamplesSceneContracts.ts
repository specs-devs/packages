import WorldCameraFinderProvider from "InteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider";
// FaceMeshExamplesSceneContracts.ts
// Owns: the shared, plain-data surface of FaceMeshExamples — the character catalog,
// authored SceneObject names, placeholder defaults, Head Generator prompts and
// user drop-target paths. Every other FaceMeshExamples module imports from here.
// @inputs: none (plain TS module, not a component).
// Must not: touch the scene, create components, or hold runtime state.

export interface FaceMeshExamplesCharacter {
    /** Stable id, also the suffix of the slot name (Slot_<id>). */
    id: string;
    /** Label pushed to the selector UI. */
    displayName: string;
    /** Name of the authored slot SceneObject under HeadSlots. */
    slotName: string;
    /** Placeholder sphere tint (RGBA 0-1). */
    placeholderColor: vec4;
    /** Prompt to paste into the GenAI Suite Head Generator. */
    headGeneratorPrompt: string;
    /** Where the user drops the imported head in the Scene Hierarchy. */
    dropTarget: string;
}

/** Authored SceneObject names (created by the skeleton/bootstrap steps). */
export const SCENE_NAMES = {
    root: "FaceMeshExamplesRoot",
    headAnchor: "HeadAnchor",
    headStage: "HeadStage",
    headSlots: "HeadSlots",
    placeholder: "Placeholder",
    selectorUI: "HeadSelectorUI",
} as const;

/** Placeholder sphere diameter in cm (matches plan size_cm 22). */
export const PLACEHOLDER_DIAMETER_CM = 22;

/** Stage defaults (mirrored by FaceMeshExamplesMain's @input slider defaults). */
export const DEFAULT_STAGE_DISTANCE_CM = 110;
export const DEFAULT_STAGE_HEIGHT_OFFSET_CM = 0;

/** Face index the Head Binding tracks. */
export const FACE_INDEX = 0;

export const CHARACTERS: FaceMeshExamplesCharacter[] = [
    {
        id: "Capybara",
        displayName: "Capybara",
        slotName: "Slot_Capybara",
        placeholderColor: new vec4(0.55, 0.38, 0.24, 1.0), // warm brown
        headGeneratorPrompt: "1 capybara head, brown fur, realistic portrait, highres, hipoly model",
        dropTarget: "HeadStage/HeadSlots/Slot_Capybara",
    },
    {
        id: "EggWithEyes",
        displayName: "Egg Guy",
        slotName: "Slot_EggWithEyes",
        placeholderColor: new vec4(0.95, 0.93, 0.88, 1.0), // off-white
        headGeneratorPrompt: "1 egg head, big googly eyes, white eggshell, smooth glossy, highres, hipoly model",
        dropTarget: "HeadStage/HeadSlots/Slot_EggWithEyes",
    },
    {
        id: "Frog",
        displayName: "Frog",
        slotName: "Slot_Frog",
        placeholderColor: new vec4(0.35, 0.7, 0.25, 1.0), // green
        headGeneratorPrompt: "1 frog head, green glossy skin, big round eyes, wide mouth, pixar style, highres, hipoly model",
        dropTarget: "HeadStage/HeadSlots/Slot_Frog",
    },
    {
        id: "PirateShark",
        displayName: "Pirate Shark",
        slotName: "Slot_PirateShark",
        placeholderColor: new vec4(0.45, 0.56, 0.68, 1.0), // grey-blue
        headGeneratorPrompt: "1 shark head, grey-blue skin, pirate tricorn hat, sharp teeth, highres, hipoly model",
        dropTarget: "HeadStage/HeadSlots/Slot_PirateShark",
    },
];

/** Clamp + wrap an index into [0, count). */
export function wrapIndex(index: number, count: number): number {
    if (count <= 0) return 0;
    const i = Math.round(index) % count;
    return i < 0 ? i + count : i;
}

/**
 * The package prefab can't reference the developer's camera, so an empty `camera` input falls back to
 * SIK's world camera (the Camera with Device Tracking). Returns null if SIK hasn't found it yet.
 */
export function resolveCamera(camera: SceneObject | null | undefined): SceneObject | null {
    if (camera) return camera;
    try {
        const cam = WorldCameraFinderProvider.getInstance().getComponent();
        return cam ? cam.getSceneObject() : null;
    } catch (e) {
        return null;
    }
}
