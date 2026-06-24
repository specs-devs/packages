/**
 * Specs Inc. 2026
 * Mesh generation utilities for creating 2D shapes (circles, lines) and render mesh operations.
 * Provides functions for generating meshes with proper indices and vertices for rendering.
 */

/**
 * Utility class for mesh operations and 2D shape generation
 */
export class MeshUtils {
  /**
   * Create a 2D circle mesh
   * @param position - Center position
   * @param radius - Circle radius
   * @returns Generated render mesh
   */
  static makeCircle2DMesh(position: vec3, radius: number): RenderMesh {
    const builder = new MeshBuilder([{name: "position", components: 3}]);

    builder.topology = MeshTopology.Triangles;
    builder.indexType = MeshIndexType.UInt16;

    const [indices, vertices] = MeshUtils.makeCircle2DIndicesVerticesPair(position, radius, 16, 0);

    builder.appendIndices(indices);
    builder.appendVerticesInterleaved(vertices);

    builder.updateMesh();

    return builder.getMesh();
  }

  /**
   * Generate circle indices and vertices pair
   * @param position - Center position
   * @param radius - Circle radius
   * @param segments - Number of segments (default: 16)
   * @param indicesOffset - Starting index offset
   * @returns [indices, vertices] arrays
   */
  static makeCircle2DIndicesVerticesPair(
    position: vec3,
    radius: number,
    segments: number,
    indicesOffset: number
  ): number[][] {
    const indices: number[] = [];
    const vertices: number[] = [];

    vertices.push(position.x, position.y, position.z);

    // Add the vertices around the circle
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = position.x + Math.cos(angle) * radius;
      const y = position.y + Math.sin(angle) * radius;
      const z = position.z;

      vertices.push(x, y, z);
    }

    // Add the indices for the triangles
    for (let i = 1; i <= segments; i++) {
      indices.push(indicesOffset, i + indicesOffset, i + indicesOffset + 1);
    }

    return [indices, vertices];
  }

  /**
   * Create a 2D line strip mesh with rounded joints
   * @param positions - Array of line positions
   * @param thickness - Line thickness
   * @returns Generated render mesh
   */
  static makeLineStrip2DMeshWithJoints(positions: vec3[], thickness: number): RenderMesh {
    const builder = new MeshBuilder([{name: "position", components: 3}]);

    builder.topology = MeshTopology.Triangles;
    builder.indexType = MeshIndexType.UInt16;

    for (let i = 0; i < positions.length - 1; ++i) {
      const [indices, vertices] = MeshUtils.makeLine2DIndicesVerticesPair(
        positions[i],
        positions[i + 1],
        thickness,
        i * 4
      );

      builder.appendIndices(indices);
      builder.appendVerticesInterleaved(vertices);
    }

    const segments = 16;
    const radius = thickness / 2;
    const linesIndicesOffset = (positions.length - 1) * 4;

    for (let i = 0; i < positions.length; ++i) {
      const [indices, vertices] = MeshUtils.makeCircle2DIndicesVerticesPair(
        positions[i],
        radius,
        segments,
        linesIndicesOffset + i * segments
      );

      builder.appendIndices(indices);
      builder.appendVerticesInterleaved(vertices);
    }

    builder.updateMesh();

    return builder.getMesh();
  }

  /**
   * Generate line indices and vertices pair
   * @param start - Line start position
   * @param end - Line end position
   * @param thickness - Line thickness
   * @param indicesOffset - Starting index offset
   * @returns [indices, vertices] arrays
   */
  static makeLine2DIndicesVerticesPair(
    start: vec3,
    end: vec3,
    thickness: number,
    indicesOffset: number
  ): number[][] {
    const halfThickness = thickness / 2;
    const up = vec3.forward();
    const direction = end.sub(start).normalize();
    const right = up.cross(direction).normalize().uniformScale(halfThickness);

    return [
      // indices
      [0 + indicesOffset, 1 + indicesOffset, 2 + indicesOffset, 2 + indicesOffset, 1 + indicesOffset, 3 + indicesOffset],
      // vertices
      [
        start.x + right.x,
        start.y + right.y,
        start.z + right.z,
        start.x - right.x,
        start.y - right.y,
        start.z - right.z,
        end.x + right.x,
        end.y + right.y,
        end.z + right.z,
        end.x - right.x,
        end.y - right.y,
        end.z - right.z,
      ],
    ];
  }

  /**
   * Add a render mesh visual to scene object
   * @param sceneObject - Target scene object
   * @param mesh - Render mesh to add
   * @param material - Material to apply
   * @param renderOrder - Render order value
   * @returns Created RenderMeshVisual component
   */
  static addRenderMeshVisual(
    sceneObject: SceneObject,
    mesh: RenderMesh,
    material: Material,
    renderOrder: number
  ): RenderMeshVisual {
    const renderMeshVisual = sceneObject.createComponent("Component.RenderMeshVisual");
    renderMeshVisual.addMaterial(material);
    renderMeshVisual.mesh = mesh;
    renderMeshVisual.setRenderOrder(renderOrder);
    return renderMeshVisual;
  }
}
