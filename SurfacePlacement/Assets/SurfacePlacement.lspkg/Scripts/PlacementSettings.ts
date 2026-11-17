/**
 * SPECS Inc. 2027
 * Placement configuration classes for surface detection modes and widget settings. Defines PlacementMode
 * enum (HORIZONTAL for ground, VERTICAL for walls, NEAR_SURFACE for tabletop), PlacementSettings for
 * mode selection with optional height adjustment widget, configurable widget offset position, and slider
 * update callback for real-time height changes during placement workflow.
 */
export enum PlacementMode {
  HORIZONTAL,
  VERTICAL,
  NEAR_SURFACE,
}

/** Confirmation for horizontal and vertical surfaces. Near Surface uses palms. */
export enum PlacementInteraction {
  HEAD_POSE,
  PINCH_OR_TAP,
}

export class PlacementSettings {
  public readonly interaction: PlacementInteraction;
  public readonly placementMode: PlacementMode;
  public readonly useAdjustmentWidget: boolean;
  public readonly adjustmentWidgetOffset: vec3;
  public readonly onSliderUpdate: ((value: vec3) => void) | null = null;

  constructor(
    mode: PlacementMode = PlacementMode.HORIZONTAL,
    useWidget = true,
    widgetOffset = new vec3(2, 2, 0),
    onSliderUpdated: ((value: vec3) => void) | null = null,
    interaction: PlacementInteraction = PlacementInteraction.HEAD_POSE
  ) {
    this.placementMode = mode;
    this.interaction = interaction;
    this.useAdjustmentWidget = useWidget;
    this.adjustmentWidgetOffset = widgetOffset;
    this.onSliderUpdate = onSliderUpdated;
  }
}
