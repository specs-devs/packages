/**
 * SPECS Inc. 2027
 * The placement modes (Ground, Wall, Tabletop) and the settings that start placement in one of
 * them.
 */
//in the order SurfacePlacementController lists the prefabs for them
export enum PlacementMode {
  GROUND,
  WALL,
  TABLETOP,
}

export class PlacementSettings {
  public readonly placementMode: PlacementMode;
  // Logs how placement goes, and near a surface marks where the depth pass aims
  // round the hand and where its hits land.
  public readonly showDebug: boolean;

  constructor(mode: PlacementMode, showDebug: boolean = false) {
    this.placementMode = mode;
    this.showDebug = showDebug;
  }
}
