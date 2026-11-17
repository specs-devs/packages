# VolumetricLine lifecycle and geometry

[← Agent usage index](../README.md)

## Use when

Understand initialization, coordinates and update cost.

## Initialization

onAwake initializes the Logger. SnapDecorators binds onStart and onUpdate. onStart returns when pathPoints is missing or has fewer than two entries, otherwise creates a RenderMeshVisual and generates the mesh. updateMesh/refreshPath guard on an existing mesh visual; they cannot recover skipped setup. forceRefresh directly generates and can dereference the missing visual. Set required inputs in the authored Inspector before start rather than relying on late inputs. Do not manually invoke lifecycle methods.

RandomPositionAnimator caches initial local positions/random phases in onAwake. Changing its object array afterward does not seed new entries; an undefined array is still iterated onUpdate. Wire the array (an empty array is safer than absent) before awake. It applies local transforms every frame.

## Coordinates and offset

useWorldPosition=true and useRelativeToComponent=true by default. getPathPositions maps each point's world position through the line root's inverse world transform (position, rotation and scale). Other modes use point local coordinates or world values directly in the mesh. Different point parents can make local coordinates inconsistent. zOffset applies to generated local Z. Automatic correction is disabled for the default world+relative mode; otherwise only a first-point discrepancy strictly between 50 and 500 cm adds 2% of that discrepancy. resetOffsetDetection recalculates; setManualOffset fixes the cached offset. testPositionModes ends in world+relative mode. setTestPositions moves up to five existing points to fixed world coordinates.

## Spline and geometry

Exactly two points, or interpolationSteps<=1, bypass spline interpolation. Otherwise each of N-1 spans contributes interpolationSteps samples plus the initial point: R=(N-1)*steps+1 rings. The cubic Hermite implementation uses tangent scale smoothness*0.5; smoothness=0 zeros tangents, rather than providing uniformly spaced linear interpolation. Ring frames use parallel transport and cylindrical UVs.

With C circle segments, vertex count is R*C plus 2 cap centers when capEnds=true. Indices use UInt16; there is no splitting/overflow guard. Duplicate points, invalid radii/segment counts, sharp reversals and self-intersections are not repaired. The shipped prefab uses N=4, steps=400, C=20, radius=5, smoothness=.98: 24,022 vertices with caps, below the 65,536-addressable vertex limit but substantial per-frame rebuilding. This is a source calculation, not a measured frame budget.

## Update semantics

continuousUpdate=false disables automatic refresh but not public setters/manual updates. smoothUpdate=true rebuilds every frame using lerp(current,target,1-positionSmoothing); 0 snaps, 1 freezes after initial positions. With smoothUpdate=false, updateRate throttles rebuilding; its public setter clamps to >=.01 seconds, but the shipped prefab's private input is 0. Setting smoothUpdate resets interpolation history. Changing capEnds or assigning material/pathPoints directly does not itself invoke a setter; call updateMesh after valid initialized setup.

RandomPositionAnimator uses lerp(current,target,smoothing) without clamping: 0 freezes, 1 snaps. Its Inspector hint claims the reverse, so follow the implementation. Defaults are ranges 10 cm, speed1, smoothing.1; prefab speed.2 and smoothing1.

## Materials and visibility

updateMaterial assigns the same input Material and attempts mainPass.baseColor=vec4(color,1). Unsupported parameters are caught; no fallback material is created. Color changes can affect all consumers of that material. isEnabled toggles only the created RenderMeshVisual; it does not disable update processing, and setting it before setup is not reapplied by setupMeshVisual.
