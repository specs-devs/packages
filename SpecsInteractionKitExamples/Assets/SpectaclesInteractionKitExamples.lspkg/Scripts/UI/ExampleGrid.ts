// Preload ThemeService before any UIKit visual to break a circular-import init-order
// crash in the package (Visual.ts imports ThemeService before defining COLORS, and the
// theme chain reads COLORS at module-load). Entering the import cycle via ThemeService
// lets Visual.ts finish defining COLORS first. Must remain the FIRST import.
import "SpectaclesUIKit.lspkg/Scripts/Themes/ThemeService"
/**
 * Specs Inc. 2026
 * Example grid utility that creates a grid of RectangleButtons at runtime with programmatic control.
 * Supports drag-and-drop rearrangement, dynamic content updates, customizable button layouts,
 * and iPhone-style paged horizontal layout with left/right navigation, dot indicators, and masked clipping.
 */
import { Frame } from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame";
import { GridLayout } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Grid/GridLayout";
import { RectangleButton } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/RectangleButton";
import { ScrollWindow } from "SpectaclesUIKit.lspkg/Scripts/Components/ScrollWindow/ScrollWindow";
import { ButtonContentLayout, ButtonContentLayoutConfig } from "./ButtonContentLayout";
import { GridRearrangement } from "./GridRearrangement";
import { InteractableManipulation } from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent, bindUpdateEvent, bindLateUpdateEvent, bindDestroyEvent } from "SnapDecorators.lspkg/decorators";

const PANEL_TITLE_H = 3.0;
const PANEL_TITLE_GAP = 0.5;

const FONT_LIGHT: Font   = requireAsset("../../Fonts/SpecsSans-Light.otf")   as Font
const FONT_REGULAR: Font = requireAsset("../../Fonts/SpecsSans-Regular.otf") as Font
const FONT_MEDIUM: Font  = requireAsset("../../Fonts/SpecsSans-Medium.otf")  as Font
const FONT_BOLD: Font    = requireAsset("../../Fonts/SpecsSans-Bold.otf")    as Font

type FontWeight = "light" | "regular" | "medium" | "bold"

@component
export class ExampleGrid extends BaseScriptComponent {

    // ========================================
    // INSPECTOR PARAMETERS
    // ========================================

    @ui.label('<span style="color: #60A5FA;">Programmatic UI Component</span><br/><span style="color: #94A3B8; font-size: 11px;">Create a UI Manager script to customize buttons at runtime using:<br/>• <code>updateButtonText(index, title, subtitle)</code><br/>• <code>updateButtonImage(index, texture, material)</code><br/>• <code>setButtonCallback(index, callback)</code></span>')
    @ui.separator

    @input
    @hint("Panel title displayed above the grid content")
    panelTitle: string = "Grid";

    @input
    @widget(new SliderWidget(2, 4, 1))
    @hint("Number of rows in the grid (2-4)")
    rows: number = 2;

    @input
    @widget(new SliderWidget(2, 8, 1))
    @hint("Number of columns in the grid (2-8)")
    columns: number = 4;

    @input
    @widget(new SliderWidget(6, 15, 0.5))
    @hint("Button width in cm (6-15)")
    buttonWidth: number = 10;

    @input
    @widget(new SliderWidget(8, 15, 0.5))
    @hint("Button height in cm (8-15)")
    buttonHeight: number = 10;

    @input
    @allowUndefined
    @hint("Placeholder image texture for buttons (optional)")
    buttonImageTexture: Texture | null = null;

    @input
    @allowUndefined
    @hint("Placeholder image material for buttons (optional)")
    buttonImageMaterial: Material | null = null;

    @input
    @hint("Enable drag-and-drop rearrangement of buttons (per-page in scrollable mode)")
    draggable: boolean = false;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Paged Scroll</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">iPhone-style home screen: masked viewport, animated page slides, dot shortcuts + arrow navigation.</span>')

    @input
    @hint("Enable iPhone-style horizontal paging with masked viewport, navigation arrows, and dot shortcuts")
    scrollable: boolean = false;

    @input
    @widget(new SliderWidget(1, 200, 1))
    @hint("Total items spread across all pages (scrollable mode). Defaults to one page when 0.")
    totalItems: number = 24;

    @input
    @widget(new SliderWidget(0, 20, 0.5))
    @hint("Extra gap in cm between the bottom of the grid and the navigation bar")
    navGridGap: number = 3;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Position</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">World-space placement. All panels use the same defaults so they appear at the same depth.</span>')

    @input
    @hint("World X position (0 = horizontal centre)")
    positionX: number = 0;

    @input
    @hint("World Y position (0 = camera height)")
    positionY: number = 0;

    @input
    @hint("Distance from camera in cm (negative = in front)")
    positionZ: number = -110;

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
    private buttonDepth: number = 1.0;
    private get buttonSize(): vec3 { return new vec3(this.buttonWidth, this.buttonHeight, this.buttonDepth); }

    // ========================================
    // HIDDEN CONFIG
    // ========================================

    private frameAppearance: string = "Small";
    private frameAutoShowHide: boolean = false;
    private showCloseButton: boolean = true;
    private frameFollowing: boolean = true;
    private spacing: number = 0.5;
    private autoAdjustFrameSize: boolean = true;
    private gridPadding: vec2 = new vec2(2, 2);
    private manualGridSize: vec2 = new vec2(20, 20);
    private buttonStyle: string = "PrimaryNeutral";
    private hasShadow: boolean = true;
    private renderOrder: number = 0;
    private buttonZOffset: number = 0.5;
    private showButtonImage: boolean = true;
    private buttonImageSize: number = 2.0;
    private showButtonTitle: boolean = true;
    private titleTextSize: number = 40;
    private titleColor: vec4 = new vec4(1, 1, 1, 1);
    private showButtonSubtitle: boolean = true;
    private subtitleTextSize: number = 30;
    private subtitleColor: vec4 = new vec4(0.8, 0.8, 0.8, 1);
    private imageToTitleSpacing: number = 1.0;
    private titleToSubtitleSpacing: number = 1.5;
    private contentOffsetX: number = -4.0;
    private contentOffsetY: number = 1.0;
    private imageOffsetX: number = 1.0;
    private textHorizontalAlignment: string = "Left";
    private textVerticalAlignment: string = "Center";
    private textLayoutRectLeftOffset: number = 0;
    private textLayoutRectWidthRatio: number = 0.70;
    private textLayoutRectBottom: number = -2.25;
    private textLayoutRectTop: number = 2.25;
    private logInteractions: boolean = true;
    private autoGenerate: boolean = true;

    // ========================================
    // STATIC GRID STATE
    // ========================================

    private frameObject: SceneObject = null;
    private frame: Frame = null;
    private gridContainer: SceneObject = null;
    private gridLayout: GridLayout = null;
    private buttons: RectangleButton[] = [];
    private hasWarnedAboutImage: boolean = false;
    private gridRearrangement: GridRearrangement = null;

    // ========================================
    // SCROLLABLE (PAGED) STATE
    // ========================================

    private currentPage: number = 0;
    private totalPages: number = 0;
    private pageW: number = 0;         // content width of one page (no inter-page gap)
    private pageTargetX: number = 0;   // target scroll position (negative for later pages)
    private scrollWindowComp: ScrollWindow = null;
    private pageObjects: SceneObject[] = [];
    private allPageButtons: RectangleButton[][] = [];
    private activeDots: SceneObject[] = [];
    private inactiveDots: SceneObject[] = [];

    // ========================================
    // LIFECYCLE
    // ========================================

    onAwake(): void {
        this.logger = new Logger("ExampleGrid", this.enableLogging || this.enableLoggingLifecycle, true);
        if (this.enableLoggingLifecycle) this.logger.debug("LIFECYCLE: onAwake()");
    }

    @bindStartEvent
    onStart(): void {
        if (this.autoGenerate) {
            const ev = this.createEvent("DelayedCallbackEvent");
            ev.bind(() => this.generateGrid());
            ev.reset(0.2);
        }
    }

    @bindUpdateEvent
    onUpdate(): void {
        if (this.scrollable && this.scrollWindowComp) {
            this.animatePageSlide();
        }
    }

    // ========================================
    // PAGE SLIDE ANIMATION
    // Drives ScrollWindow.scrollPosition each frame (scrollingPaused does NOT block the setter).
    // ScrollWindow's MaskingComponent clips the viewport; its Interactable/Collider are
    // disabled after init so button presses are not blocked.
    // ========================================

    private animatePageSlide(): void {
        if (!(this.scrollWindowComp as any)._initialized) return;

        const currentX = this.scrollWindowComp.scrollPosition.x;
        const dx = this.pageTargetX - currentX;

        if (Math.abs(dx) < 0.05) {
            if (currentX !== this.pageTargetX) {
                this.scrollWindowComp.scrollPosition = new vec2(this.pageTargetX, 0);
            }
            return;
        }
        this.scrollWindowComp.scrollPosition = new vec2(currentX + dx * 0.15, 0);
    }

    // ========================================
    // GRID GENERATION
    // ========================================

    public generateGrid() {
        this.clearGrid();
        this.logger.debug(`=== Generating grid: ${this.rows}×${this.columns} ===`);
        this.createFrame();
        if (this.scrollable) {
            this.buildScrollableGrid();
        } else {
            this.buildStaticGrid();
        }
    }

    // ─── Static grid ──────────────────────────────────────────────────────

    private buildStaticGrid(): void {
        this.gridContainer = global.scene.createSceneObject("GridContainer");
        this.gridContainer.setParent(this.frameObject);

        this.gridLayout = this.gridContainer.createComponent(GridLayout.getTypeName()) as GridLayout;
        // UIKit's GridLayout is now a CSS-grid engine and does not auto-position bare
        // SceneObjects; buttons are positioned manually below. We configure the track/gap
        // metadata so the component reflects the intended grid shape.
        this.gridLayout.templateColumns = `repeat(${this.columns}, 1fr)`;
        this.gridLayout.templateRows = `repeat(${this.rows}, 1fr)`;
        this.gridLayout.columnGap = this.spacing;
        this.gridLayout.rowGap = this.spacing;

        const totalButtons = this.rows * this.columns;
        for (let i = 0; i < totalButtons; i++) {
            this.buttons.push(this.createButton(i + 1));
        }

        const finish = this.createEvent("DelayedCallbackEvent");
        finish.bind(() => {
            if (!this.gridLayout || !this.gridContainer) return;
            this.layoutButtonsManually();
            this.applyButtonZOffset();
            if (this.draggable) this.setupDraggable();
            this.adjustFrameSize(this.gridLayout);
            if (this.panelTitle) {
                const content = this.computeGridContentSize(this.gridLayout);
                const shift = (PANEL_TITLE_H + PANEL_TITLE_GAP) / 2;
                const pos = this.gridContainer.getTransform().getLocalPosition();
                this.gridContainer.getTransform().setLocalPosition(new vec3(pos.x, pos.y - shift, pos.z));
                this.buildPanelTitle(this.frameObject, content.width, content.height / 2 + PANEL_TITLE_GAP / 2);
            }
        });
        finish.reset(0);
    }

    // ─── Scrollable (paged) grid ──────────────────────────────────────────

    private buildScrollableGrid(): void {
        const itemsPerPage = this.rows * this.columns;
        const total = this.totalItems > 0 ? this.totalItems : itemsPerPage;
        this.totalPages = Math.ceil(total / itemsPerPage);

        const cellW = this.buttonWidth + this.spacing;
        const cellH = this.buttonHeight + this.spacing;
        const pageW = this.columns * cellW - this.spacing;
        const pageH = this.rows * cellH - this.spacing;
        this.pageW = pageW;

        const navH = Math.min(this.buttonHeight * 0.4, 5.0);
        const navGap = this.navGridGap;
        const titleShiftY = this.panelTitle ? (PANEL_TITLE_H + PANEL_TITLE_GAP) / 2 : 0;
        const gridCenterY = (navH + navGap) / 2 - titleShiftY;

        // ── Clip container: ScrollWindow provides real MaskingComponent ──
        const clipObj = global.scene.createSceneObject("PageClip");
        clipObj.setParent(this.frameObject);
        clipObj.getTransform().setLocalPosition(new vec3(0, gridCenterY, 0));

        const sw = clipObj.createComponent(ScrollWindow.getTypeName()) as ScrollWindow;
        (sw as any)._horizontal = true;
        (sw as any)._vertical = false;
        (sw as any)._windowSize = new vec2(pageW, pageH);
        (sw as any)._scrollDimensions = new vec2(-1, -1); // unbounded — driven manually
        (sw as any)._edgeFade = false;
        (sw as any)._scrollSnapping = false;

        // Fix for button interaction:
        // scrollingPaused=true causes cancelCurrentInteractor → enableChildColliders(false),
        // and onHoverEnd always calls enableChildColliders(false) but onHoverStart skips
        // enableChildColliders(true) when paused.  Solution:
        //   1. Unsubscribe all SW event handlers (removes hover/drag callbacks).
        //   2. Disable SW's own Interactable + ColliderComponent so rays reach buttons.
        //   3. Re-enable every child ColliderComponent that cancelCurrentInteractor disabled.
        sw.onInitialized.add(() => {
            (sw as any).subscribeToEvents(false);  // step 1: no more hover/drag handlers
            sw.scrollingPaused = true;              // step 2: stops internal physics
            if (sw.interactable) sw.interactable.enabled = false;   // step 3a
            if ((sw as any).collider) (sw as any).collider.enabled = false; // step 3b
            // Step 4: re-enable all child colliders disabled by cancelCurrentInteractor
            const reenableColliders = (obj: SceneObject) => {
                const col = obj.getComponent("ColliderComponent") as ColliderComponent;
                if (col && col !== (sw as any).collider) col.enabled = true;
                for (let ci = 0; ci < obj.getChildrenCount(); ci++) {
                    reenableColliders(obj.getChild(ci));
                }
            };
            reenableColliders(clipObj);
        });

        this.scrollWindowComp = sw;

        // ── Pages — children of clipObj; SW moves them into its Scroller on OnStart ──
        this.allPageButtons = [];
        this.pageObjects = [];

        for (let p = 0; p < this.totalPages; p++) {
            const pageObj = global.scene.createSceneObject(`Page_${p}`);
            pageObj.setParent(clipObj);
            // Page p is offset p * pageW along x; scrollPosition = -p*pageW reveals it
            pageObj.getTransform().setLocalPosition(new vec3(p * pageW, 0, 0));
            this.pageObjects.push(pageObj);

            const pageBtns: RectangleButton[] = [];
            const count = Math.min(itemsPerPage, total - p * itemsPerPage);

            for (let i = 0; i < count; i++) {
                const globalIndex = p * itemsPerPage + i;
                const col = i % this.columns;
                const row = Math.floor(i / this.columns);
                const xOffset = -(this.columns - 1) * cellW * 0.5;
                const yOffset = (this.rows - 1) * cellH * 0.5;

                const btnObj = global.scene.createSceneObject(`Button_${globalIndex + 1}`);
                btnObj.setParent(pageObj);
                btnObj.getTransform().setLocalPosition(new vec3(
                    xOffset + col * cellW,
                    yOffset - row * cellH,
                    this.buttonZOffset
                ));

                const button = btnObj.createComponent(RectangleButton.getTypeName()) as RectangleButton;
                (button as any)._style = this.buttonStyle;
                button.size = this.buttonSize;
                button.initialize();
                button.renderOrder = this.renderOrder;
                button.hasShadow = this.hasShadow;

                const idx = globalIndex + 1;
                button.onTriggerUp.add(() => {
                    if (this.logInteractions) this.logger.debug(`Button ${idx} pressed`);
                    this.onButtonPressed(idx, button);
                });

                this.createButtonContent(btnObj, globalIndex + 1);
                pageBtns.push(button);
                this.buttons.push(button);
            }
            this.allPageButtons.push(pageBtns);
        }

        // ── Navigation bar ──
        const navCenterY = gridCenterY - pageH / 2 - navGap - navH / 2;
        this.buildNavBar(pageW, navH, navCenterY);

        // ── Frame size ── defer until the Frame is initialized (its internal visual is
        // created on OnStartEvent; setting innerSize earlier throws "setSize of undefined").
        const titleExtra = this.panelTitle ? PANEL_TITLE_H + PANEL_TITLE_GAP : 0;
        const applyFrameSize = () => {
            this.frame.innerSize = new vec2(
                pageW + this.gridPadding.x,
                pageH + navH + navGap + this.gridPadding.y + titleExtra
            );
        };
        if (this.frame.initialized) applyFrameSize();
        else this.frame.onInitialized.add(applyFrameSize);
        if (this.panelTitle) {
            this.buildPanelTitle(this.frameObject, pageW, (pageH + navH + navGap) / 2 + PANEL_TITLE_GAP / 2);
        }

        // ── Initial state ──
        this.currentPage = 0;
        this.pageTargetX = 0;

        if (this.draggable) this.setupDraggableForPage(0);
        this.updatePageDots();

        this.logger.debug(`Scrollable grid: ${this.totalPages} pages × ${itemsPerPage} (total ${total})`);
    }

    // ─── Navigation bar ───────────────────────────────────────────────────

    private buildNavBar(pageW: number, navH: number, navCenterY: number): void {
        const navObj = global.scene.createSceneObject("NavBar");
        navObj.setParent(this.frameObject);
        navObj.getTransform().setLocalPosition(new vec3(0, navCenterY, this.buttonZOffset));

        const arrowX = pageW * 0.44;

        const prevObj = global.scene.createSceneObject("PrevBtn");
        prevObj.setParent(navObj);
        prevObj.getTransform().setLocalPosition(new vec3(-arrowX, 0, 0));
        const prevBtn = prevObj.createComponent(RectangleButton.getTypeName()) as RectangleButton;
        (prevBtn as any)._style = "Ghost";
        prevBtn.size = new vec3(navH, navH, 1);
        prevBtn.initialize();
        this.addArrowText(prevObj, "‹", navH, navH);
        prevBtn.onTriggerUp.add(() => this.navigatePage(-1));

        this.buildPageDots(navObj, navH);

        const nextObj = global.scene.createSceneObject("NextBtn");
        nextObj.setParent(navObj);
        nextObj.getTransform().setLocalPosition(new vec3(arrowX, 0, 0));
        const nextBtn = nextObj.createComponent(RectangleButton.getTypeName()) as RectangleButton;
        (nextBtn as any)._style = "Ghost";
        nextBtn.size = new vec3(navH, navH, 1);
        nextBtn.initialize();
        this.addArrowText(nextObj, "›", navH, navH);
        nextBtn.onTriggerUp.add(() => this.navigatePage(1));
    }

    private addArrowText(parent: SceneObject, glyph: string, btnW: number, btnH: number): void {
        const widthScaleFactor = btnW / 10.0;
        const heightScaleFactor = btnH / 10.0;
        const verticalScaleFactor = Math.min(widthScaleFactor, heightScaleFactor);
        const textScaleFactor = Math.sqrt(widthScaleFactor);
        const textWidth = btnW * this.textLayoutRectWidthRatio;

        const config = new ButtonContentLayoutConfig();
        config.showImage = false;
        config.showTitle = true;
        config.titleText = glyph;
        config.titleSize = this.titleTextSize * textScaleFactor * 3; // ×3 for visibility
        config.titleColor = new vec4(1, 1, 1, 1);
        config.showSubtitle = false;
        config.offsetX = 0;
        config.offsetY = 0;
        config.textHorizontalAlignment = HorizontalAlignment.Center;
        config.textVerticalAlignment = VerticalAlignment.Center;
        config.textLayoutRectLeft = -textWidth / 2;
        config.textLayoutRectRight = textWidth / 2;
        config.textLayoutRectBottom = this.textLayoutRectBottom * verticalScaleFactor;
        config.textLayoutRectTop = this.textLayoutRectTop * verticalScaleFactor;
        new ButtonContentLayout(parent, config).create();
    }

    private buildPageDots(parent: SceneObject, navH: number): void {
        if (this.totalPages <= 1) return;

        const dotSize = Math.min(navH * 0.42, 2.0);
        const dotGap = dotSize * 1.6;
        const totalW = (this.totalPages - 1) * dotGap;

        this.activeDots = [];
        this.inactiveDots = [];

        for (let i = 0; i < this.totalPages; i++) {
            const x = -totalW * 0.5 + i * dotGap;
            const pageIndex = i; // capture for closure

            // Active dot (Primary / filled blue) — shown when i === currentPage
            const activeObj = global.scene.createSceneObject(`ActiveDot_${i}`);
            activeObj.setParent(parent);
            activeObj.getTransform().setLocalPosition(new vec3(x, 0, 0.1));
            const activeDot = activeObj.createComponent(RectangleButton.getTypeName()) as RectangleButton;
            (activeDot as any)._style = "Primary";
            activeDot.size = new vec3(dotSize, dotSize, 1);
            activeDot.initialize();
            activeDot.onTriggerUp.add(() => this.goToPage(pageIndex));
            activeObj.enabled = (i === 0);
            this.activeDots.push(activeObj);

            // Inactive dot (Ghost / outline) — shown when i !== currentPage
            const inactiveObj = global.scene.createSceneObject(`InactiveDot_${i}`);
            inactiveObj.setParent(parent);
            inactiveObj.getTransform().setLocalPosition(new vec3(x, 0, 0.1));
            const inactiveDot = inactiveObj.createComponent(RectangleButton.getTypeName()) as RectangleButton;
            (inactiveDot as any)._style = "Ghost";
            inactiveDot.size = new vec3(dotSize, dotSize, 1);
            inactiveDot.initialize();
            inactiveDot.onTriggerUp.add(() => this.goToPage(pageIndex));
            inactiveObj.enabled = (i !== 0);
            this.inactiveDots.push(inactiveObj);
        }
    }

    // ─── Page navigation ──────────────────────────────────────────────────

    private navigatePage(direction: number): void {
        const newPage = this.currentPage + direction;
        if (newPage < 0 || newPage >= this.totalPages) return;

        if (this.gridRearrangement) {
            this.gridRearrangement.destroy();
            this.gridRearrangement = null;
        }

        this.currentPage = newPage;
        this.pageTargetX = -newPage * this.pageW;

        if (this.draggable) this.setupDraggableForPage(this.currentPage);
        this.updatePageDots();
        this.logger.debug(`Page: ${this.currentPage + 1} / ${this.totalPages}`);
    }

    private setupDraggableForPage(pageIndex: number): void {
        const pageBtns = this.allPageButtons[pageIndex];
        const pageObj = this.pageObjects[pageIndex];
        if (!pageBtns || !pageObj || pageBtns.length === 0) return;

        let gl = pageObj.getComponent(GridLayout.getTypeName()) as GridLayout;
        if (!gl) {
            gl = pageObj.createComponent(GridLayout.getTypeName()) as GridLayout;
            gl.templateColumns = `repeat(${this.columns}, 1fr)`;
            gl.templateRows = `repeat(${this.rows}, 1fr)`;
            gl.columnGap = this.spacing;
            gl.rowGap = this.spacing;
        }

        const buttonObjects: SceneObject[] = pageBtns.map(btn => {
            const obj = btn.getSceneObject();
            if (!obj.getComponent(InteractableManipulation.getTypeName())) {
                obj.createComponent(InteractableManipulation.getTypeName());
            }
            return obj;
        });

        this.gridRearrangement = new GridRearrangement(
            gl,
            {
                cols: this.columns, rows: this.rows,
                cellW: this.buttonSize.x + this.spacing,
                cellH: this.buttonSize.y + this.spacing,
            },
            this, 0.8, this.buttonZOffset,
            this.enableLogging || this.enableLoggingLifecycle,
            (this.buttonSize.x + this.spacing) * 0.6
        );
        this.gridRearrangement.setupDragInteractions(buttonObjects);
    }

    private updatePageDots(): void {
        for (let i = 0; i < this.totalPages; i++) {
            if (this.activeDots[i]) this.activeDots[i].enabled = (i === this.currentPage);
            if (this.inactiveDots[i]) this.inactiveDots[i].enabled = (i !== this.currentPage);
        }
    }

    // ========================================
    // PUBLIC PAGE API
    // ========================================

    public navigateNext(): void { this.navigatePage(1); }
    public navigatePrev(): void { this.navigatePage(-1); }

    public goToPage(index: number): void {
        if (index < 0 || index >= this.totalPages || index === this.currentPage) return;
        if (this.gridRearrangement) { this.gridRearrangement.destroy(); this.gridRearrangement = null; }

        this.currentPage = index;
        this.pageTargetX = -index * this.pageW;

        if (this.draggable) this.setupDraggableForPage(index);
        this.updatePageDots();
    }

    public getCurrentPage(): number { return this.currentPage; }
    public getTotalPages(): number { return this.totalPages; }

    // ========================================
    // FRAME
    // ========================================

    private createFrame() {
        this.frameObject = global.scene.createSceneObject("Frame");
        this.frameObject.setParent(this.sceneObject);
        this.frameObject.getTransform().setWorldPosition(
            new vec3(this.positionX, this.positionY, this.positionZ)
        );
        this.frame = this.frameObject.createComponent(Frame.getTypeName()) as Frame;
        (this.frame as any)._appearance = this.frameAppearance;
        (this.frame as any)._showCloseButton = this.showCloseButton;
        (this.frame as any)._showFollowButton = this.frameFollowing;
        (this.frame as any).useFollowBehavior = this.frameFollowing;
        (this.frame as any)._following = false;
        this.frame.autoShowHide = this.frameAutoShowHide;
        // Frame self-initializes on its OnStartEvent (no public initialize()
        // in the current SpectaclesUIKit). Apply post-init config once ready.
        this.frame.onInitialized.add(() => {
            this.frame.allowScaling = false;
            this.frame.autoScaleContent = false;
            if (this.frame.showVisual) this.frame.showVisual();
        });
    }

    // ========================================
    // STATIC GRID HELPERS
    // ========================================

    private setupDraggable() {
        if (!this.gridLayout) return;

        const buttonObjects: SceneObject[] = [];
        this.buttons.forEach(button => {
            const obj = button.getSceneObject();
            obj.createComponent(InteractableManipulation.getTypeName());
            buttonObjects.push(obj);
        });

        this.gridRearrangement = new GridRearrangement(
            this.gridLayout,
            {
                cols: this.columns, rows: this.rows,
                cellW: this.buttonSize.x + this.spacing,
                cellH: this.buttonSize.y + this.spacing,
            },
            this, 0.8, this.buttonZOffset,
            this.enableLogging || this.enableLoggingLifecycle,
            (this.buttonSize.x + this.spacing) * 0.6
        );
        this.gridRearrangement.setupDragInteractions(buttonObjects);
    }

    private computeGridContentSize(gridLayout: GridLayout): { width: number; height: number } {
        const cellW = this.buttonSize.x + this.spacing;
        const cellH = this.buttonSize.y + this.spacing;
        const childCount = gridLayout.sceneObject.getChildrenCount();
        const cols = this.columns;
        const flowRows = Math.ceil(childCount / cols);
        return { width: cols * cellW, height: flowRows * cellH };
    }

    private layoutButtonsManually(): void {
        if (!this.gridLayout || !this.gridContainer) return;
        const cols = this.columns;
        const rows = this.rows;
        const cellW = this.buttonSize.x + this.spacing;
        const cellH = this.buttonSize.y + this.spacing;
        const xOffset = -(cols - 1) * cellW * 0.5;
        const yOffset = (rows - 1) * cellH * 0.5;
        const childCount = this.gridContainer.getChildrenCount();
        for (let i = 0; i < childCount; i++) {
            const child = this.gridContainer.getChild(i);
            const col = i % cols;
            const row = Math.floor(i / cols);
            const prev = child.getTransform().getLocalPosition();
            child.getTransform().setLocalPosition(new vec3(xOffset + col * cellW, yOffset - row * cellH, prev.z));
        }
    }

    private adjustFrameSize(gridLayout: GridLayout) {
        if (!this.frame) return;
        let finalSize: vec2;
        if (this.autoAdjustFrameSize) {
            const content = this.computeGridContentSize(gridLayout);
            const titleExtra = this.panelTitle ? PANEL_TITLE_H + PANEL_TITLE_GAP : 0;
            finalSize = new vec2(content.width + this.gridPadding.x, content.height + this.gridPadding.y + titleExtra);
        } else {
            finalSize = this.manualGridSize;
        }
        // Defer until the Frame is initialized (visual created on OnStartEvent), else
        // setting innerSize throws "setSize of undefined".
        if (this.frame.initialized) this.frame.innerSize = finalSize;
        else this.frame.onInitialized.add(() => { this.frame.innerSize = finalSize; });
    }

    private buildPanelTitle(parent: SceneObject, contentWidth: number, titleCenterY: number): void {
        const titleObj = global.scene.createSceneObject("PanelTitle");
        titleObj.setParent(parent);
        titleObj.getTransform().setLocalPosition(new vec3(0, titleCenterY, this.buttonZOffset));
        const text = titleObj.createComponent("Component.Text") as Text;
        text.text = this.panelTitle;
        text.size = 36;
        text.horizontalAlignment = HorizontalAlignment.Center;
        text.verticalAlignment = VerticalAlignment.Center;
        text.renderOrder = 10;
        text.font = this.fontForWeight("medium");
    }

    private fontForWeight(w: FontWeight): Font {
        switch (w) {
            case "light":  return FONT_LIGHT;
            case "medium": return FONT_MEDIUM;
            case "bold":   return FONT_BOLD;
            default:       return FONT_REGULAR;
        }
    }

    // ========================================
    // BUTTON CREATION
    // ========================================

    private createButton(index: number): RectangleButton {
        const btnObj = global.scene.createSceneObject(`Button_${index}`);
        btnObj.setParent(this.gridContainer);
        const button = btnObj.createComponent(RectangleButton.getTypeName()) as RectangleButton;
        (button as any)._style = this.buttonStyle;
        button.size = this.buttonSize;
        button.initialize();
        button.renderOrder = this.renderOrder;
        button.hasShadow = this.hasShadow;
        button.onTriggerUp.add(() => {
            if (this.logInteractions) this.logger.debug(`Button ${index} pressed`);
            this.onButtonPressed(index, button);
        });
        this.createButtonContent(btnObj, index);
        return button;
    }

    private applyButtonZOffset() {
        if (!this.gridContainer) return;
        for (let i = 0; i < this.gridContainer.getChildrenCount(); i++) {
            const obj = this.gridContainer.getChild(i);
            const p = obj.getTransform().getLocalPosition();
            obj.getTransform().setLocalPosition(new vec3(p.x, p.y, this.buttonZOffset));
        }
    }

    private createButtonContent(buttonObj: SceneObject, index: number) {
        const config = new ButtonContentLayoutConfig();
        const wSF = this.buttonSize.x / 10.0;
        const hSF = this.buttonSize.y / 10.0;
        const vSF = Math.min(wSF, hSF);
        const tSF = Math.sqrt(wSF);

        config.showImage = this.showButtonImage;
        config.imageSize = this.buttonImageSize * vSF;
        config.showTitle = this.showButtonTitle;
        config.titleText = `Item ${index}`;
        config.titleSize = this.titleTextSize * tSF;
        config.titleColor = this.titleColor;
        config.showSubtitle = this.showButtonSubtitle;
        config.subtitleText = `Description ${index}`;
        config.subtitleSize = this.subtitleTextSize * tSF;
        config.subtitleColor = this.subtitleColor;
        config.imageToTitleSpacing = this.imageToTitleSpacing * vSF;
        config.titleToSubtitleSpacing = this.titleToSubtitleSpacing * vSF;
        config.offsetX = this.contentOffsetX * wSF;
        config.offsetY = this.contentOffsetY * hSF;
        config.imageOffsetX = this.imageOffsetX * wSF;
        config.buttonWidth = this.buttonSize.x;
        config.textHorizontalAlignment = this.getHorizontalAlignment(this.textHorizontalAlignment);
        config.textVerticalAlignment = this.getVerticalAlignment(this.textVerticalAlignment);
        const textWidth = this.buttonSize.x * this.textLayoutRectWidthRatio;
        config.textLayoutRectLeft = this.textLayoutRectLeftOffset;
        config.textLayoutRectRight = this.textLayoutRectLeftOffset + textWidth;
        config.textLayoutRectBottom = this.textLayoutRectBottom * vSF;
        config.textLayoutRectTop = this.textLayoutRectTop * vSF;

        const cl = new ButtonContentLayout(buttonObj, config);
        cl.create();
        if (this.showButtonImage) this.setImageMaterial(cl);
    }

    private getHorizontalAlignment(a: string): HorizontalAlignment {
        switch (a) {
            case "Left": return HorizontalAlignment.Left;
            case "Right": return HorizontalAlignment.Right;
            case "Center": return HorizontalAlignment.Center;
            default: return HorizontalAlignment.Left;
        }
    }

    private getVerticalAlignment(a: string): VerticalAlignment {
        switch (a) {
            case "Top": return VerticalAlignment.Top;
            case "Bottom": return VerticalAlignment.Bottom;
            case "Center": return VerticalAlignment.Center;
            default: return VerticalAlignment.Center;
        }
    }

    private setImageMaterial(cl: ButtonContentLayout) {
        const img = cl.getImageComponent();
        if (!img) return;
        if (!this.hasWarnedAboutImage && !this.buttonImageTexture && !this.buttonImageMaterial) {
            this.logger.debug("WARNING: Button Image Texture and Material are not set.");
            this.hasWarnedAboutImage = true;
        }
        if (this.buttonImageMaterial) img.mainMaterial = this.buttonImageMaterial.clone();
        const mat = img.mainMaterial;
        if (mat && mat.mainPass) {
            if (this.buttonImageTexture) mat.mainPass.baseTex = this.buttonImageTexture;
            else mat.mainPass.baseColor = new vec4(0.7, 0.7, 0.7, 1);
        }
    }

    // ========================================
    // CLEAR
    // ========================================

    public clearGrid() {
        if (this.gridRearrangement) { this.gridRearrangement.destroy(); this.gridRearrangement = null; }
        if (this.gridContainer) { this.gridContainer.destroy(); this.gridContainer = null; }
        if (this.frameObject) { this.frameObject.destroy(); this.frameObject = null; this.frame = null; }
        this.gridLayout = null;
        this.buttons = [];
        this.hasWarnedAboutImage = false;
        this.scrollWindowComp = null;
        this.allPageButtons = [];
        this.pageObjects = [];
        this.activeDots = [];
        this.inactiveDots = [];
        this.currentPage = 0;
        this.totalPages = 0;
        this.pageTargetX = 0;
        this.pageW = 0;
    }

    // ========================================
    // OVERRIDE HOOK
    // ========================================

    protected onButtonPressed(index: number, button: RectangleButton) {}

    // ========================================
    // PUBLIC BUTTON API
    // ========================================

    public getButton(index: number): RectangleButton {
        if (index < 1 || index > this.buttons.length) return null;
        return this.buttons[index - 1];
    }

    public getButtons(): RectangleButton[] { return this.buttons; }

    public updateButtonText(index: number, title?: string, subtitle?: string) {
        const button = this.getButton(index);
        if (!button) return;
        const contentContainer = button.getSceneObject().getChild(0);
        if (!contentContainer) return;
        let tc: SceneObject = null;
        for (let i = 0; i < contentContainer.getChildrenCount(); i++) {
            if (contentContainer.getChild(i).name === "TextContainer") { tc = contentContainer.getChild(i); break; }
        }
        if (!tc) return;
        if (title !== undefined) {
            for (let i = 0; i < tc.getChildrenCount(); i++) {
                if (tc.getChild(i).name === "Title") {
                    const t = tc.getChild(i).getComponent("Component.Text") as Text;
                    if (t) t.text = title; break;
                }
            }
        }
        if (subtitle !== undefined) {
            for (let i = 0; i < tc.getChildrenCount(); i++) {
                if (tc.getChild(i).name === "Subtitle") {
                    const t = tc.getChild(i).getComponent("Component.Text") as Text;
                    if (t) t.text = subtitle; break;
                }
            }
        }
    }

    public updateButtonImage(index: number, texture?: Texture, material?: Material) {
        const button = this.getButton(index);
        if (!button) return;
        const contentContainer = button.getSceneObject().getChild(0);
        if (!contentContainer) return;
        let imgObj: SceneObject = null;
        for (let i = 0; i < contentContainer.getChildrenCount(); i++) {
            if (contentContainer.getChild(i).name === "Image") { imgObj = contentContainer.getChild(i); break; }
        }
        if (!imgObj) return;
        const imgComp = imgObj.getComponent("Component.Image") as Image;
        if (!imgComp) return;
        if (material) imgComp.mainMaterial = material.clone();
        const mat = imgComp.mainMaterial;
        if (texture && mat && mat.mainPass) mat.mainPass.baseTex = texture;
    }

    public setButtonCallback(index: number, callback: () => void) {
        const button = this.getButton(index);
        if (button) button.onTriggerUp.add(callback);
    }

    public updateGridSize() {
        if (!this.gridContainer) return;
        const gl = this.gridContainer.getComponent(GridLayout.getTypeName()) as GridLayout;
        if (gl) this.adjustFrameSize(gl);
    }

    public getGridSize(): vec2 {
        if (!this.gridContainer) return vec2.zero();
        const gl = this.gridContainer.getComponent(GridLayout.getTypeName()) as GridLayout;
        if (!gl) return vec2.zero();
        const c = this.computeGridContentSize(gl);
        return new vec2(c.width, c.height);
    }

    public getFrame(): Frame { return this.frame; }
}
