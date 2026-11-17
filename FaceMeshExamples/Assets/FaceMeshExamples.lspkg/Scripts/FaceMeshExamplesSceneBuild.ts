// FaceMeshExamplesSceneBuild.ts
// Owns: creating the primitive placeholder sphere under a FaceMeshExamples slot, and
// finding an existing one. Plain TS module (not a component, no @input).
// Contract:
//   - A placeholder is created ONLY when the slot has no children at all.
//   - An existing direct child named SCENE_NAMES.placeholder is returned as-is.
//   - If the slot holds any other child (an imported Head Generator head), the
//     user has replaced the placeholder: nothing is created, nothing is hidden.
// Must not: create semantic roots, touch/hide/reparent other slot children.

import { SCENE_NAMES, PLACEHOLDER_DIAMETER_CM } from "./FaceMeshExamplesSceneContracts";

const SPHERE_SEGMENTS = 24;
const SPHERE_RINGS = 16;

let TEMPLATE_MATERIAL: Material | null = null;
try {
    TEMPLATE_MATERIAL = requireAsset("../Materials/Placeholder_Capybara.mat") as Material;
} catch (e) {
    print("[FaceMeshExamplesSceneBuild] template material load failed: " + e);
    TEMPLATE_MATERIAL = null;
}

const meshCache: { [key: string]: RenderMesh } = {};

/** Direct child of `slot` named SCENE_NAMES.placeholder, else null. */
export function findPlaceholder(slot: SceneObject): SceneObject | null {
    if (!slot) return null;
    const count = slot.getChildrenCount();
    for (let i = 0; i < count; i++) {
        const child = slot.getChild(i);
        if (child && child.name === SCENE_NAMES.placeholder) return child;
    }
    return null;
}

/**
 * Returns the existing Placeholder untouched; returns null (and does nothing)
 * if the slot holds any other child; otherwise creates a tinted UV sphere.
 */
export function ensurePlaceholder(
    slot: SceneObject,
    color: vec4,
    diameterCm: number = PLACEHOLDER_DIAMETER_CM
): SceneObject | null {
    if (!slot) {
        print("[FaceMeshExamplesSceneBuild] ensurePlaceholder: slot is null");
        return null;
    }
    const existing = findPlaceholder(slot);
    if (existing) return existing;
    if (slot.getChildrenCount() > 0) return null; // imported head replaced it

    const obj = global.scene.createSceneObject(SCENE_NAMES.placeholder);
    obj.setParent(slot);
    const t = obj.getTransform();
    t.setLocalPosition(vec3.zero());
    t.setLocalRotation(quat.quatIdentity());
    t.setLocalScale(vec3.one());

    const visual = obj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    const mesh = getSphereMesh(diameterCm * 0.5);
    if (mesh) {
        visual.mesh = mesh;
    } else {
        print("[FaceMeshExamplesSceneBuild] sphere mesh build failed; visual has no mesh");
    }

    if (TEMPLATE_MATERIAL) {
        const mat = TEMPLATE_MATERIAL.clone();
        try {
            mat.mainPass.baseColor = color;
        } catch (e) {
            print("[FaceMeshExamplesSceneBuild] baseColor tint failed, keeping untinted clone: " + e);
        }
        visual.mainMaterial = mat;
    } else {
        print("[FaceMeshExamplesSceneBuild] no template material; placeholder created without material");
    }
    return obj;
}

function getSphereMesh(radiusCm: number): RenderMesh | null {
    const key = radiusCm.toFixed(3);
    if (meshCache[key]) return meshCache[key];
    const mesh = buildSphereMesh(radiusCm);
    if (mesh) meshCache[key] = mesh;
    return mesh;
}

/** UV sphere at true cm size: positions + normals + uv, indexed CCW-outward. */
function buildSphereMesh(radiusCm: number): RenderMesh | null {
    const builder = new MeshBuilder([
        { name: "position", components: 3 },
        { name: "normal", components: 3, normalized: true },
        { name: "texture0", components: 2 },
    ]);
    builder.topology = MeshTopology.Triangles;
    builder.indexType = MeshIndexType.UInt16;

    const verts: number[] = [];
    for (let r = 0; r <= SPHERE_RINGS; r++) {
        const phi = (Math.PI * r) / SPHERE_RINGS; // 0 at +Y pole
        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);
        for (let s = 0; s <= SPHERE_SEGMENTS; s++) {
            const theta = (2 * Math.PI * s) / SPHERE_SEGMENTS;
            const nx = sinPhi * Math.sin(theta);
            const ny = cosPhi;
            const nz = sinPhi * Math.cos(theta);
            verts.push(nx * radiusCm, ny * radiusCm, nz * radiusCm, nx, ny, nz,
                s / SPHERE_SEGMENTS, 1 - r / SPHERE_RINGS);
        }
    }
    builder.appendVerticesInterleaved(verts);

    const indices: number[] = [];
    const row = SPHERE_SEGMENTS + 1;
    for (let r = 0; r < SPHERE_RINGS; r++) {
        for (let s = 0; s < SPHERE_SEGMENTS; s++) {
            const a = r * row + s;
            const b = a + row;
            // Viewed from outside: a top-left, a+1 top-right, b bottom-left.
            indices.push(a, b, a + 1);
            indices.push(a + 1, b, b + 1);
        }
    }
    builder.appendIndices(indices);

    if (!builder.isValid()) {
        print("[FaceMeshExamplesSceneBuild] MeshBuilder invalid");
        return null;
    }
    builder.updateMesh();
    return builder.getMesh();
}
