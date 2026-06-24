/**
 * Tree structure utilities for diagram/mind-map layout. Used by DiagramComponent.
 */

export interface TreeNodeRef {
  nodeId: string;
  position: vec3;
  treeLevel: number;
  parentNodeId: string | null;
  childNodeIds: string[];
}

export interface YSeparationConflict<T extends TreeNodeRef = TreeNodeRef> {
  nodeA: T;
  nodeB: T;
  distance: number;
}

export interface TreeStats {
  totalNodes: number;
  maxLevel: number;
  nodesByLevel: Map<number, number>;
}

export class TreeStructureUtils {
  static findNodesNeedingYSeparation<T extends TreeNodeRef>(
    nodes: Map<string, T>,
    minXDistance: number
  ): YSeparationConflict<T>[] {
    const conflicts: YSeparationConflict<T>[] = [];
    const arr = Array.from(nodes.values());
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i];
        const b = arr[j];
        const dx = a.position.x - b.position.x;
        const dist = Math.abs(dx);
        if (dist < minXDistance && dist > 0.0001) {
          conflicts.push({ nodeA: a, nodeB: b, distance: dist });
        }
      }
    }
    return conflicts;
  }

  static calculateYSeparationOffset(
    position: vec3,
    otherNodes: TreeNodeRef[],
    _minXDistance: number,
    maxYOffset: number
  ): number {
    let offset = 0;
    for (const other of otherNodes) {
      const dx = Math.abs(position.x - other.position.x);
      if (dx < 0.0001) {
        offset += maxYOffset * 0.5;
      }
    }
    return Math.min(offset, maxYOffset);
  }

  static calculateChildPositions(
    parentPosition: vec3,
    childCount: number,
    level: number,
    levelSeparation: number,
    angularSpread: number,
    minBranchDistance: number,
    startDirection?: vec3,
    _endDirection?: vec3,
    enableYVariation?: boolean,
    maxYVariation?: number
  ): vec3[] {
    const positions: vec3[] = [];
    const step = childCount > 1 ? angularSpread / (childCount - 1) : 0;
    const startAngle = childCount > 1 ? -angularSpread / 2 : 0;
    for (let i = 0; i < childCount; i++) {
      const angle = startAngle + step * i;
      const rad = (angle * Math.PI) / 180;
      const dist = Math.max(levelSeparation * level, minBranchDistance);
      let x = parentPosition.x + Math.sin(rad) * dist;
      const y = parentPosition.y + (enableYVariation && maxYVariation ? (Math.random() - 0.5) * 2 * maxYVariation : 0);
      const z = parentPosition.z;
      if (startDirection) {
        const dir = startDirection.normalize();
        x = parentPosition.x + dir.x * dist * (i - (childCount - 1) / 2);
      }
      positions.push(new vec3(x, y, z));
    }
    return positions;
  }

  static establishParentChild(parent: TreeNodeRef, child: TreeNodeRef): void {
    (child as { parentNodeId: string | null }).parentNodeId = parent.nodeId;
    (parent as { childNodeIds: string[] }).childNodeIds.push(child.nodeId);
  }

  static getNodesAtLevel<T extends TreeNodeRef>(nodes: Map<string, T>, level: number): T[] {
    return Array.from(nodes.values()).filter((n) => n.treeLevel === level) as T[];
  }

  static getTreeStats(nodes: Map<string, TreeNodeRef>): TreeStats {
    const nodesByLevel = new Map<number, number>();
    let maxLevel = 0;
    for (const n of nodes.values()) {
      maxLevel = Math.max(maxLevel, n.treeLevel);
      nodesByLevel.set(n.treeLevel, (nodesByLevel.get(n.treeLevel) || 0) + 1);
    }
    return {
      totalNodes: nodes.size,
      maxLevel,
      nodesByLevel,
    };
  }
}
