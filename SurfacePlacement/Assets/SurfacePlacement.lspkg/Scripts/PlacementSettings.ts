export enum PlacementMode {
  HORIZONTAL,
  VERTICAL,
  NEAR_SURFACE,
}

export class PlacementSettings {
  public readonly placementMode: PlacementMode;
  public readonly useAdjustmentWidget: boolean;
  public readonly adjustmentWidgetOffset: vec3;
  public readonly onSliderUpdate: ((value: vec3) => void) | null = null;

  constructor(
    mode: PlacementMode,
    useWidget = true,
    widgetOffset = new vec3(2, 2, 0),
    onSliderUpdated: ((value: vec3) => void) | null = null
  ) {
    this.placementMode = mode;
    this.useAdjustmentWidget = useWidget;
    this.adjustmentWidgetOffset = widgetOffset;
    this.onSliderUpdate = onSliderUpdated;
  }
}
