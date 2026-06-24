/**
 * FastRoundedRectangle – a single resizable button (rounded rectangle) driven by text content.
 * No prefabs. Builds RectangleButton + RoundedRectangleVisual + Text programmatically.
 * Use as a component on a scene object, or call FastRoundedRectangle.buildRoundedRectangleOnto() / createRoundedRectangle() from FastChat.
 */
import { RectangleButton } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/RectangleButton";
import {
  RoundedRectangleVisual,
  RoundedRectangleVisualState,
} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangleVisual";
import { StateName } from "SpectaclesUIKit.lspkg/Scripts/Components/Element";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent } from "SnapDecorators.lspkg/decorators";

export type FastRoundedRectangleStyle = "bot" | "user" | "green";

export type FastRoundedRectangleTextColor = "white" | "black" | "gray";

export interface FastRoundedRectangleOptions {
  content: string;
  width?: number;
  minHeight?: number;
  /** Max height in cm; height gradients linearly from minHeight (1 line) to maxHeight (maxLines). */
  maxHeight?: number;
  /** Line count at which height reaches maxHeight; height interpolates linearly between 1 line and this. */
  maxLines?: number;
  style?: FastRoundedRectangleStyle;
  borderSize?: number;
  /** Text fill color: white, black, or gray */
  textColor?: FastRoundedRectangleTextColor;
  /** Optional overrides; if not set, default user/bot colors are used */
  colorDefault?: vec4;
  colorHover?: vec4;
  colorTriggered?: vec4;
  borderColor?: vec4;
}

/** Reference: 1 row of 30 chars → rect 21×4; 4 rows → 21×10. Layout rect width 18, font 48. */
const DEFAULT_WIDTH = 21;
const DEFAULT_MIN_HEIGHT = 4;
/** Characters per row (space included) – matches reference text layout. */
const CHARS_PER_LINE = 30;
/** Vertical padding (cm): top and bottom insets so text doesn't touch card edges.
 *  Asymmetry compensates for font ascender/line spacing so top and bottom gaps look equal (Top alignment). */
const TEXT_INSET_TOP = 0.04;
const TEXT_INSET_BOTTOM = 0.36;
/** Total vertical padding for height formula. */
const TEXT_INSET_TOTAL = TEXT_INSET_TOP + TEXT_INSET_BOTTOM;
/** Height (cm) per line of text – card height = total inset + lines*this so gap stays constant. */
const HEIGHT_PER_LINE = 2.0;
/** Text layout rect: left -9, right 9 → width 18. */
const TEXT_LAYOUT_WIDTH_HALF = 9;
const TEXT_FONT_SIZE = 48;

/** Truncate content to fit within maxLines; add "..." if truncated. */
function truncateToMaxLines(content: string, maxLines: number): string {
  const maxChars = Math.max(1, Math.floor(maxLines) * CHARS_PER_LINE);
  const s = (content || "").trim();
  if (s.length <= maxChars) return s;
  return s.substring(0, maxChars - 3) + "...";
}

/** Text fill colors for content (dropdown presets). */
const TEXT_COLORS: Record<FastRoundedRectangleTextColor, vec4> = {
  white: new vec4(0.99, 0.99, 0.99, 1),
  black: new vec4(0.08, 0.08, 0.08, 1),
  gray: new vec4(0.45, 0.45, 0.48, 1),
};

const USER_COLORS = {
  default: new vec4(0.2, 0.5, 0.9, 1),
  hover: new vec4(0.3, 0.55, 0.95, 1),
  triggered: new vec4(0.1, 0.35, 0.75, 1),
  border: new vec4(0.1, 0.35, 0.75, 1),
};

const BOT_COLORS = {
  default: new vec4(0.25, 0.25, 0.28, 1),
  hover: new vec4(0.35, 0.35, 0.38, 1),
  triggered: new vec4(0.2, 0.2, 0.22, 1),
  border: new vec4(0.2, 0.2, 0.2, 1),
};

/** Gradient stop helper for multi-stop rectangle gradients. */
function rectGrad(
  s0: number,
  c0: vec4,
  s1: number,
  c1: vec4,
  s2: number,
  c2: vec4,
  s3: number,
  c3: vec4
) {
  return {
    enabled: true,
    type: "Rectangle" as const,
    stop0: { enabled: true, percent: s0, color: c0 },
    stop1: { enabled: true, percent: s1, color: c1 },
    stop2: { enabled: true, percent: s2, color: c2 },
    stop3: { enabled: true, percent: s3, color: c3 },
  };
}

/** Flat single-color gradient (legacy user/bot). */
function flatGrad(c: vec4) {
  return rectGrad(0, c, 0.5, c, 1, c, 1, c);
}

/** Preset palettes: bot/user use flat colors in buildVisualStyle; green is gradient, no border. */
const VISUAL_STYLE_PRESETS: Record<
  FastRoundedRectangleStyle,
  Partial<Record<StateName, RoundedRectangleVisualState>>
> = {
  user: {}, // built in buildVisualStyle (blue)
  bot: {}, // built in buildVisualStyle (gray)
  green: {
    default: {
      baseType: "Gradient",
      hasBorder: false,
      baseGradient: rectGrad(
        0,
        new vec4(0.25, 0.82, 0.35, 1),   // light green
        0.35,
        new vec4(0.12, 0.58, 0.22, 1),   // mid green
        0.7,
        new vec4(0.06, 0.38, 0.14, 1),   // dark green
        1,
        new vec4(0.03, 0.22, 0.08, 1)    // deeper green
      ),
    },
    hovered: {
      baseGradient: rectGrad(
        0,
        new vec4(0.35, 0.88, 0.42, 1),
        0.25,
        new vec4(0.18, 0.65, 0.28, 1),
        0.6,
        new vec4(0.1, 0.45, 0.18, 1),
        1,
        new vec4(0.05, 0.28, 0.1, 1)
      ),
    },
    triggered: {
      baseGradient: rectGrad(
        0,
        new vec4(0.18, 0.6, 0.25, 1),
        0.4,
        new vec4(0.1, 0.42, 0.16, 1),
        0.75,
        new vec4(0.05, 0.28, 0.1, 1),
        1,
        new vec4(0.03, 0.18, 0.06, 1)
      ),
    },
  },
};

function buildVisualStyle(options: FastRoundedRectangleOptions): Partial<Record<StateName, RoundedRectangleVisualState>> {
  const styleName = (options.style || "bot") as FastRoundedRectangleStyle;
  const borderSize = options.borderSize ?? 0.1;

  const preset = VISUAL_STYLE_PRESETS[styleName];
  if (preset && Object.keys(preset).length > 0) {
    const base = preset.default ?? {};
    const useBorder = (base as RoundedRectangleVisualState).hasBorder !== false;
    return {
      default: {
        ...base,
        hasBorder: useBorder,
        ...(useBorder && { borderSize }),
      },
      hovered: preset.hovered ?? base,
      triggered: preset.triggered ?? base,
    };
  }

  const def = options.colorDefault ?? (styleName === "user" ? USER_COLORS.default : BOT_COLORS.default);
  const hov = options.colorHover ?? (styleName === "user" ? USER_COLORS.hover : BOT_COLORS.hover);
  const trig = options.colorTriggered ?? (styleName === "user" ? USER_COLORS.triggered : BOT_COLORS.triggered);
  const border = options.borderColor ?? (styleName === "user" ? USER_COLORS.border : BOT_COLORS.border);
  return {
    default: {
      baseType: "Gradient",
      hasBorder: true,
      borderSize,
      borderType: "Color",
      borderColor: border,
      baseGradient: flatGrad(def),
    },
    hovered: { baseGradient: flatGrad(hov) },
    triggered: { baseGradient: flatGrad(trig) },
  };
}

/**
 * Compute size from text (width fixed, height from line count).
 * Card height = total inset + lines*HEIGHT_PER_LINE so padding stays constant regardless of line count.
 * Result is clamped to [minHeight, maxHeight] when maxHeight is set.
 */
export function getRoundedRectangleSizeFromText(
  content: string,
  width: number = DEFAULT_WIDTH,
  minHeight: number = DEFAULT_MIN_HEIGHT,
  maxHeight?: number,
  maxLines?: number
): vec3 {
  const lines = Math.max(1, Math.ceil((content || "").length / CHARS_PER_LINE));
  const contentHeight = TEXT_INSET_TOTAL + lines * HEIGHT_PER_LINE;
  let height = Math.max(minHeight, contentHeight);
  if (maxHeight != null && maxHeight >= minHeight) {
    height = Math.min(height, maxHeight);
  }
  return new vec3(width, height, 0.5);
}

/**
 * Build rounded rectangle UI onto an existing scene object: RectangleButton + RoundedRectangleVisual + Text child.
 * Does not create the scene object. Use from FastChat: createSceneObject, then buildRoundedRectangleOnto(obj, options).
 */
export function buildRoundedRectangleOnto(sceneObject: SceneObject, options: FastRoundedRectangleOptions): void {
  const width = options.width ?? DEFAULT_WIDTH;
  const minHeight = options.minHeight ?? DEFAULT_MIN_HEIGHT;
  const maxHeight = options.maxHeight;
  const maxLines = options.maxLines;
  const displayContent =
    maxLines != null && maxLines > 0
      ? truncateToMaxLines(options.content, maxLines)
      : (options.content || "");
  const size = getRoundedRectangleSizeFromText(displayContent, width, minHeight, maxHeight, maxLines);

  let button = sceneObject.getComponent(RectangleButton.getTypeName()) as RectangleButton | null;
  if (!button) {
    button = sceneObject.createComponent(RectangleButton.getTypeName()) as RectangleButton;
  }

  const style = buildVisualStyle(options);
  const visual = new RoundedRectangleVisual({ sceneObject: sceneObject, style });
  button.visual = visual;
  button.size = size;
  button.initialize();

  const rectHeight = size.y;
  const half = rectHeight * 0.5;
  const textBottom = -half + TEXT_INSET_BOTTOM;
  const textTop = half - TEXT_INSET_TOP;
  let textObj: SceneObject | null = null;
  for (let i = 0; i < sceneObject.getChildrenCount(); i++) {
    const c = sceneObject.getChild(i);
    if (c.name === "Content") {
      textObj = c;
      break;
    }
  }
  const textColorName = options.textColor ?? "white";
  const textColor = TEXT_COLORS[textColorName] ?? TEXT_COLORS.white;

  if (!textObj) {
    textObj = global.scene.createSceneObject("Content");
    textObj.setParent(sceneObject);
    textObj.getTransform().setLocalPosition(new vec3(0, 0, 0.1));
    const textComp = textObj.createComponent("Component.Text") as Text;
    if (textComp) {
      textComp.text = displayContent;
      textComp.size = TEXT_FONT_SIZE;
      textComp.worldSpaceRect = Rect.create(-TEXT_LAYOUT_WIDTH_HALF, TEXT_LAYOUT_WIDTH_HALF, textBottom, textTop);
      textComp.horizontalOverflow = HorizontalOverflow.Wrap;
      textComp.verticalOverflow = VerticalOverflow.Overflow;
      textComp.horizontalAlignment = HorizontalAlignment.Left;
      textComp.verticalAlignment = VerticalAlignment.Center;
      textComp.textFill.mode = TextFillMode.Solid;
      textComp.textFill.color = textColor;
    }
  } else {
    const textComp = (textObj as any).getComponent("Component.Text") as Text | null;
    if (textComp) {
      textComp.text = displayContent;
      textComp.size = TEXT_FONT_SIZE;
      textComp.worldSpaceRect = Rect.create(-TEXT_LAYOUT_WIDTH_HALF, TEXT_LAYOUT_WIDTH_HALF, textBottom, textTop);
      textComp.horizontalAlignment = HorizontalAlignment.Left;
      textComp.verticalAlignment = VerticalAlignment.Center;
      textComp.textFill.mode = TextFillMode.Solid;
      textComp.textFill.color = textColor;
    }
  }
}

/**
 * Create a new scene object under parent and build rounded rectangle onto it. Returns the new scene object.
 */
export function createRoundedRectangle(parent: SceneObject, name: string, options: FastRoundedRectangleOptions): SceneObject {
  const obj = global.scene.createSceneObject(name);
  obj.setParent(parent);
  buildRoundedRectangleOnto(obj, options);
  return obj;
}

@component
export class FastRoundedRectangle extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">FastRoundedRectangle – resizable button from text</span><br/><span style="color: #94A3B8; font-size: 11px;">No prefabs. Size is derived from content. Use in scene or via FastRoundedRectangle.createRoundedRectangle() from FastChat.</span>')
  @ui.separator

  @input
  @hint("Text content (height grows with content, truncated at max lines)")
  content: string = "Card content";

  /** Width in cm; not exposed in inspector. */
  private cardWidth: number = DEFAULT_WIDTH;
  /** Minimum height in cm (1 line); not exposed in inspector. */
  private cardMinHeight: number = DEFAULT_MIN_HEIGHT;
  /** Maximum height in cm (reached at max lines); not exposed in inspector. */
  private cardMaxHeight: number = 30;
  /** Line count at which height reaches cardMaxHeight; text is truncated beyond this. */
  private cardMaxLines: number = 20;

  @input("string")
  @hint("Visual style: Gray (bot), Blue (user), or Green (no border)")
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("Gray", "bot"),
      new ComboBoxItem("Blue", "user"),
      new ComboBoxItem("Green", "green"),
    ])
  )
  style: string = "bot";

  /** Border size; not exposed in inspector. */
  private cardBorderSize: number = 0.1;

  @input("string")
  @hint("Text color (content)")
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("White", "white"),
      new ComboBoxItem("Black", "black"),
      new ComboBoxItem("Gray", "gray"),
    ])
  )
  textColor: string = "white";

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Logging Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Control logging output for this script instance</span>')

  @input
  @hint("Enable general logging (animation cycles, events, etc.)")
  enableLogging: boolean = false;

  @input
  @hint("Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.)")
  enableLoggingLifecycle: boolean = false;

  private logger: Logger;
  private built: boolean = false;

  onAwake(): void {
    this.logger = new Logger("FastRoundedRectangle", this.enableLogging || this.enableLoggingLifecycle, true);
    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }
    const valid: FastRoundedRectangleTextColor[] = ["white", "black", "gray"];
    if (valid.indexOf(this.textColor as FastRoundedRectangleTextColor) < 0) {
      this.textColor = "white";
    }
  }

  @bindStartEvent
  onStart(): void {
    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onStart() - Building rounded rectangle");
    }
    this.buildRoundedRectangle();
  }

  /**
   * Build or rebuild from current content and size params.
   * Call from inspector or script when content/size changes.
   */
  public buildRoundedRectangle(): void {
    const styleName = this.style as FastRoundedRectangleStyle;
    const style: FastRoundedRectangleStyle =
      styleName === "user" || styleName === "bot" || styleName === "green" ? styleName : "bot";
    const textColorName = this.textColor as FastRoundedRectangleTextColor;
    const textColor: FastRoundedRectangleTextColor =
      textColorName === "white" || textColorName === "black" || textColorName === "gray" ? textColorName : "white";
    buildRoundedRectangleOnto(this.sceneObject, {
      content: this.content,
      width: this.cardWidth,
      minHeight: this.cardMinHeight,
      maxHeight: this.cardMaxHeight,
      maxLines: this.cardMaxLines,
      style,
      borderSize: this.cardBorderSize,
      textColor,
    });
    this.built = true;
    if (this.enableLogging) {
      const size = getRoundedRectangleSizeFromText(
        this.content,
        this.cardWidth,
        this.cardMinHeight,
        this.cardMaxHeight,
        this.cardMaxLines
      );
      const lines = Math.max(1, Math.ceil((this.content || "").length / CHARS_PER_LINE));
      const rectHeight = size.y;
      const half = rectHeight * 0.5;
      const textBottom = -half + TEXT_INSET_BOTTOM;
      const textTop = half - TEXT_INSET_TOP;
      this.logger.debug(
        "[build] chars=" +
          this.content.length +
          " lines=" +
          lines +
          " | size(w×h)=" +
          size.x.toFixed(2) +
          "×" +
          size.y.toFixed(2) +
          " | rectHeight=" +
          rectHeight.toFixed(2) +
          " | textRect bottom=" +
          textBottom.toFixed(2) +
          " top=" +
          textTop.toFixed(2) +
          " (height=" +
          (textTop - textBottom).toFixed(2) +
          ")"
      );
    }
  }

  /**
   * Update content and resize. Call after changing this.content.
   */
  public setContent(newContent: string): void {
    this.content = newContent;
    this.buildRoundedRectangle();
  }

  /**
   * Get the current computed size (width × height from text).
   */
  public getSize(): vec3 {
    return getRoundedRectangleSizeFromText(
      this.content,
      this.cardWidth,
      this.cardMinHeight,
      this.cardMaxHeight,
      this.cardMaxLines
    );
  }
}
