import "SpectaclesUIKit.lspkg/Scripts/Themes/ThemeService"
import {ToggleGroup} from "SpectaclesUIKit.lspkg/Scripts/Components/Toggle/ToggleGroup"
import {
  RocketConfigurator,
  RocketPart,
  RocketStyle,
  ROCKET_PARTS,
  ROCKET_STYLES
} from "./RocketConfigurator"
import {RocketUI} from "./RocketUI"

const PANEL_WIDTH = 34
const PANEL_HEIGHT = 48
const WINDOW_WIDTH = 31
const WINDOW_HEIGHT = 33

const TITLE_HEIGHT = 8
// Vertical scroll bar in the margin right of the scroll window. CENTER_Y mirrors the
// window's vertical placement in the outer flex column (padTop 0.3 + title 8 + gap 2.5
// from the 46-tall column's top edge → window center sits 4.3 below panel center).
const SCROLL_BAR_THICKNESS = 1.2
const SCROLL_BAR_MARGIN = 0.9
const SCROLL_BAR_CENTER_Y = -4.3
const HEADER_HEIGHT = 8 // section label ("Nose Cone" …); sized for the large LABEL_SIZE text
const ROW_HEIGHT = 10 // tall enough for the large icon + BODY_SIZE style name
const LIST_GAP = 1.8 // gap between every header/row in the flat scroll list

const ICON_SIZE = 6
// Shared text scale (see RocketUI) so this panel matches the Launch Controls panel.
const ROW_TEXT_SIZE = RocketUI.BODY_SIZE
const SUBTITLE_TEXT_SIZE = Math.round(RocketUI.BODY_SIZE) // smaller "category" line under the style name
const HEADER_TEXT_SIZE = RocketUI.LABEL_SIZE
const TITLE_TEXT_SIZE = RocketUI.TITLE_SIZE

// `requireAsset` only accepts static string literals, so every thumbnail is listed explicitly
// here, keyed by "<Part> <Style>". The authored thumbnail variants are: rocket-A = the silver
// starter (Space Age), rocket-B = Modern, rocket-C = the yellow / Snap rocket (Sleek).
const THUMBNAILS: {[key: string]: Texture} = {
  "Nose Cone Space Age": requireAsset("../Textures/ScrollViewThumbnails/nose-cone_rocket-A.png") as Texture,
  "Nose Cone Modern": requireAsset("../Textures/ScrollViewThumbnails/nose-cone_rocket-B.png") as Texture,
  "Nose Cone Sleek": requireAsset("../Textures/ScrollViewThumbnails/nose-cone_rocket-C.png") as Texture,
  "Body Tube Space Age": requireAsset("../Textures/ScrollViewThumbnails/body-tube_rocket-A.png") as Texture,
  "Body Tube Modern": requireAsset("../Textures/ScrollViewThumbnails/body-tube_rocket-B.png") as Texture,
  "Body Tube Sleek": requireAsset("../Textures/ScrollViewThumbnails/body-tube_rocket-C.png") as Texture,
  "Fins Space Age": requireAsset("../Textures/ScrollViewThumbnails/fins_rocket-A.png") as Texture,
  "Fins Modern": requireAsset("../Textures/ScrollViewThumbnails/fins_rocket-B.png") as Texture,
  "Fins Sleek": requireAsset("../Textures/ScrollViewThumbnails/fins_rocket-C.png") as Texture
}

/**
 * PartSelectorPanel — builds the scrollable rocket-part picker entirely in code.
 *
 * Layout: a big title, then a {@link RocketUI.scrollWindow} whose content is a single FLAT
 * vertical list — for each part (Nose Cone / Body Tube / Fins) a section header followed by
 * three tall rows (icon + style name). A flat list (rather than nested per-section columns)
 * keeps every item correctly sized and masked by the scroll window. Each part's rows are a
 * {@link ToggleGroup}, so selecting one calls {@link RocketConfigurator.setRocketPartSection}
 * and the group's radio behaviour gives the selected row its glowing outline.
 *
 * Like LaunchControlPanel, this is a plain class the RocketWorkshop entry point constructs —
 * no @input wiring.
 */
export class PartSelectorPanel {
  constructor(parent: SceneObject, private readonly config: RocketConfigurator) {
    this.buildUI(parent)
  }

  private buildUI(parent: SceneObject): void {
    const panelContent = RocketUI.frame(parent, "RocketPartSelector", PANEL_WIDTH, PANEL_HEIGHT)
    const outer = RocketUI.flexColumn(panelContent, PANEL_WIDTH - 2, PANEL_HEIGHT - 2, {gap: 2.5, padX: 0.5, padTop: 0.3, padBottom: 1.5})

    // Title
    RocketUI.flexChild(outer, {w: WINDOW_WIDTH, h: TITLE_HEIGHT}, (t) => {
      RocketUI.label(t, "Rocket Parts", WINDOW_WIDTH, TITLE_HEIGHT, {
        textSize: TITLE_TEXT_SIZE, align: "center", fontWeight: "bold"
      })
    })

    // Scrollable, flat list of section headers + part rows
    RocketUI.flexChild(outer, {w: WINDOW_WIDTH, h: WINDOW_HEIGHT}, (scrollContainer) => {
      const contentHeight = this.computeContentHeight()
      const sw = RocketUI.scrollWindow(scrollContainer, WINDOW_WIDTH, WINDOW_HEIGHT, contentHeight)

      const listContainer = RocketUI.obj(scrollContainer, "ScrollContent")
      const list = RocketUI.flexColumn(listContainer, WINDOW_WIDTH, contentHeight, {gap: LIST_GAP})

      ROCKET_PARTS.forEach((part) => this.buildPartSection(list, listContainer, part))

      // Start the list scrolled to the top (first section: Nose Cone).
      sw.onInitialized.add(() => {
        ;(sw as any).scrollPositionNormalized = new vec2(0, 1)
      })

      // Vertical scroll bar beside the list so the scrollable region is visible at a
      // glance. Parented to the frame content (NOT the scroll container — the window's
      // mask would clip it) and placed in the margin right of the window.
      RocketUI.scrollBar(
        panelContent, sw, WINDOW_HEIGHT, SCROLL_BAR_THICKNESS,
        new vec3(WINDOW_WIDTH / 2 + SCROLL_BAR_MARGIN, SCROLL_BAR_CENTER_Y, 0.06)
      )
    })
  }

  private computeContentHeight(): number {
    const headerCount = ROCKET_PARTS.length
    const rowCount = ROCKET_PARTS.length * ROCKET_STYLES.length
    const itemCount = headerCount + rowCount
    return headerCount * HEADER_HEIGHT + rowCount * ROW_HEIGHT + (itemCount - 1) * LIST_GAP
  }

  /**
   * Append one part's section to the flat list: a header row, then a tappable row per style.
   * The ToggleGroup lives on a non-layout child of `listContainer` so it doesn't take space.
   */
  private buildPartSection(list: SceneObject, listContainer: SceneObject, part: RocketPart): void {
    // Section header — bottom-aligned text so it sits just above its rows.
    RocketUI.flexChild(list, {w: WINDOW_WIDTH, h: HEADER_HEIGHT}, (h) => {
      RocketUI.label(h, part, WINDOW_WIDTH, HEADER_HEIGHT, {
        textSize: HEADER_TEXT_SIZE, align: "left", fontWeight: "medium", color: new vec4(1, 1, 1, 0.9)
      })
    })

    const group = RocketUI.obj(listContainer, `${part} ToggleGroup`).createComponent(
      ToggleGroup.getTypeName()
    ) as ToggleGroup
    ;(group as any)._allowAllTogglesOff = false

    const currentStyle = this.config.getStyle(part)

    // The two text lines are centered in the area to the RIGHT of the icon (dynamic Text
    // renders centered on its anchor, so we use the midpoint of that area rather than its
    // left edge). Icon occupies roughly [-W/2+1.5, -W/2+1.5+ICON_SIZE].
    const iconRightEdge = -WINDOW_WIDTH / 2 + 1.5 + ICON_SIZE
    const textX = (iconRightEdge + WINDOW_WIDTH / 2) / 2 + 1

    ROCKET_STYLES.forEach((style) => {
      RocketUI.flexChild(list, {w: WINDOW_WIDTH, h: ROW_HEIGHT}, (rowObj) => {
        const btn = RocketUI.toggleBtn(rowObj, "PrimaryNeutral", "Rectangle", WINDOW_WIDTH, ROW_HEIGHT)
        // Icon only (no text) on the left — the labels are drawn as two stacked lines so the
        // style name can sit above a smaller "category" subtitle, matching the original design.
        RocketUI.content(rowObj, {
          leadingIcon: this.thumbnail(part, style),
          leadingIconSize: ICON_SIZE,
          contentAlignment: "left",
          paddingLeft: 1.5
        })
        RocketUI.dynamicText(
          rowObj, "StyleName", style, ROW_TEXT_SIZE,
          new vec4(1, 1, 1, 1), RocketUI.FONT_MEDIUM, HorizontalAlignment.Left,
          new vec3(textX, 1.4, 0.15)
        )
        RocketUI.dynamicText(
          rowObj, "CategoryName", part, SUBTITLE_TEXT_SIZE,
          new vec4(1, 1, 1, 0.5), RocketUI.FONT_LIGHT, HorizontalAlignment.Left,
          new vec3(textX, -2.2, 0.15)
        )
        if (style === currentStyle) btn.isOn = true
        group.registerToggleable(btn, style)
      })
    })

    // Register the selection handler AFTER setting initial state so it doesn't fire on build.
    group.onToggleSelected.add((args) => {
      this.config.setRocketPartSection(args.value as RocketStyle, part)
    })
  }

  private thumbnail(part: RocketPart, style: RocketStyle): Texture | undefined {
    const tex = THUMBNAILS[`${part} ${style}`]
    return isNull(tex) ? undefined : tex
  }
}
