/**
 * Specs Inc. 2026
 * Fast grid utility that creates a grid of RectangleButtons at runtime with programmatic control.
 * Supports drag-and-drop rearrangement, dynamic content updates, and customizable button layouts.
 */
import { Frame } from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame";
import { GridLayout } from "SpectaclesUIKit.lspkg/Scripts/Components/GridLayout/GridLayout";
import { RectangleButton } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/RectangleButton";
import { ButtonContentLayout, ButtonContentLayoutConfig } from "./ButtonContentLayout";
import { GridRearrangement } from "./GridRearrangement";
import { InteractableManipulation } from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation";

@component
export class FastGrid extends BaseScriptComponent {

    // ========================================
    // VISIBLE PARAMETERS (User-configurable)
    // ========================================

    @ui.label('<span style="color: #60A5FA;">ℹ️ Programmatic UI Component</span><br/><span style="color: #94A3B8; font-size: 11px;">Create a UI Manager script to customize buttons at runtime using:<br/>• <code>updateButtonText(index, title, subtitle)</code><br/>• <code>updateButtonImage(index, texture, material)</code><br/>• <code>setButtonCallback(index, callback)</code></span>')
    @ui.separator

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
    @hint("Enable drag-and-drop rearrangement of buttons")
    draggable: boolean = false;

    // Hidden button depth (fixed at 1.0)
    private buttonDepth: number = 1.0;

    // Computed button size vec3
    private get buttonSize(): vec3 {
        return new vec3(this.buttonWidth, this.buttonHeight, this.buttonDepth);
    }

    // ========================================
    // HIDDEN PARAMETERS (Fixed defaults, scale proportionally)
    // ========================================

    // Frame configuration
    private frameAppearance: string = "Small";
    private frameAutoShowHide: boolean = false;
    private showCloseButton: boolean = true;
    private frameFollowing: boolean = true;

    // Grid configuration
    private spacing: number = 0.5;

    // Grid size
    private autoAdjustFrameSize: boolean = true;
    private gridPadding: vec2 = new vec2(2, 2);
    private manualGridSize: vec2 = new vec2(20, 20);

    // Button style
    private buttonStyle: string = "PrimaryNeutral";
    private hasShadow: boolean = true;
    private renderOrder: number = 0;
    private buttonZOffset: number = 0.5;

    // Button content (Fixed defaults based on 10x10 button)
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
    private imageOffsetX: number = 1.0; // Additional offset to move image right relative to text
    private textHorizontalAlignment: string = "Left";
    private textVerticalAlignment: string = "Center";

    // Text layout rect - defines rendering bounds for text
    // Text aligns with image at x=0, width scales with button size
    private textLayoutRectLeftOffset: number = 0;    // Start at 0 to align with image
    private textLayoutRectWidthRatio: number = 0.70; // Text width as ratio of button width (70%)
    private textLayoutRectBottom: number = -2.25;
    private textLayoutRectTop: number = 2.25;

    // Interaction
    private logInteractions: boolean = true;
    private autoGenerate: boolean = true;

    // ========================================
    // INTERNAL STATE
    // ========================================

    private frameObject: SceneObject = null;
    private frame: Frame = null;
    private gridContainer: SceneObject = null;
    private gridLayout: GridLayout = null;
    private buttons: RectangleButton[] = [];
    private hasWarnedAboutImage: boolean = false;
    private gridRearrangement: GridRearrangement = null;

    onAwake() {
        if (this.autoGenerate) {
            // Delay initialization to ensure Frame is ready
            const delayedEvent = this.createEvent("DelayedCallbackEvent");
            delayedEvent.bind(() => {
                this.generateGrid();
            });
            delayedEvent.reset(0.2);
        }
    }

    /**
     * Generate the grid of buttons
     */
    public generateGrid() {
        // Clear existing grid if any
        this.clearGrid();

        print(`=== Generating PresetGrid: ${this.rows}×${this.columns} ===`);
        print(`ℹ️  INFO: Use updateButtonText(), updateButtonImage(), and setButtonCallback() to customize buttons at runtime.`);

        // Create Frame
        this.createFrame();

        // Create grid container
        this.gridContainer = global.scene.createSceneObject("GridContainer");
        this.gridContainer.setParent(this.frameObject);

        // Create GridLayout component
        this.gridLayout = this.gridContainer.createComponent(GridLayout.getTypeName()) as GridLayout;

        // Configure GridLayout (but DON'T initialize yet)
        this.gridLayout.rows = this.rows;
        this.gridLayout.columns = this.columns;
        this.gridLayout.cellSize = new vec2(this.buttonSize.x, this.buttonSize.y);
        this.gridLayout.cellPadding = new vec4(this.spacing, this.spacing, this.spacing, this.spacing);
        this.gridLayout.layoutBy = 0; // LayoutDirection.Row

        print(`  ✓ GridLayout configured: ${this.rows}×${this.columns}, cell size: ${this.buttonSize.x}×${this.buttonSize.y}, spacing: ${this.spacing}`);

        // Create buttons FIRST (children must exist before layout)
        const totalButtons = this.rows * this.columns;
        for (let i = 0; i < totalButtons; i++) {
            const button = this.createButton(i + 1);
            this.buttons.push(button);
        }

        print(`  ✓ Created ${totalButtons} buttons`);

        // NOW initialize GridLayout - this will position all the children
        this.gridLayout.initialize();

        // Apply z-offset to all buttons AFTER GridLayout positions them
        this.applyButtonZOffset();

        // Setup draggable functionality if enabled
        if (this.draggable) {
            this.setupDraggable();
        }

        // Adjust Frame size to fit the grid
        this.adjustFrameSize(this.gridLayout);

        print(`✓ FastGrid generation complete`);
    }

    /**
     * Create Frame component
     * Following UIKit docs pattern: create → initialize → set properties
     */
    private createFrame() {
        this.frameObject = global.scene.createSceneObject("Frame");
        this.frameObject.setParent(this.sceneObject);

        // Create Frame component
        this.frame = this.frameObject.createComponent(Frame.getTypeName()) as Frame;

        // Configure Frame properties BEFORE initialization (some need to be set before initialize())
        (this.frame as any)._appearance = this.frameAppearance;
        (this.frame as any)._showCloseButton = this.showCloseButton;
        (this.frame as any)._showFollowButton = this.frameFollowing;
        (this.frame as any).useFollowBehavior = this.frameFollowing; // Enable built-in follow behavior
        (this.frame as any)._following = false; // Start with following OFF, user can toggle it on via button
        this.frame.autoShowHide = this.frameAutoShowHide;

        // Initialize Frame (this sets up buttons and event handlers based on above properties)
        this.frame.initialize();

        // Configure remaining Frame properties (after initialization)
        this.frame.allowScaling = false;
        this.frame.autoScaleContent = false;

        // Show the frame explicitly (otherwise it stays hidden)
        if (this.frame.showVisual) {
            this.frame.showVisual();
        }

        print(`  ✓ Frame created: ${this.frameAppearance}, autoShowHide: ${this.frameAutoShowHide}, closeButton: ${this.showCloseButton}, following: ${this.frameFollowing}`);
    }

    /**
     * Setup draggable functionality for the grid
     */
    private setupDraggable() {
        if (!this.gridLayout) {
            print("ERROR: GridLayout not initialized. Cannot setup draggable.");
            return;
        }

        // Add InteractableManipulation component to each button's scene object
        const buttonObjects: SceneObject[] = [];

        this.buttons.forEach((button, index) => {
            const buttonObj = button.getSceneObject();

            // Create InteractableManipulation component
            const manipulation = buttonObj.createComponent(
                InteractableManipulation.getTypeName()
            ) as InteractableManipulation;

            buttonObjects.push(buttonObj);
        });

        // Initialize GridRearrangement helper (pass buttonZOffset to preserve Z position)
        this.gridRearrangement = new GridRearrangement(this.gridLayout, this, 0.8, this.buttonZOffset);
        this.gridRearrangement.setupDragInteractions(buttonObjects);

        print(`  ✓ Draggable functionality enabled for ${this.buttons.length} buttons`);
    }

    /**
     * Adjust Frame size to fit the grid
     */
    private adjustFrameSize(gridLayout: GridLayout) {
        if (!this.frame) {
            return;
        }

        let finalSize: vec2;

        if (this.autoAdjustFrameSize) {
            // Calculate total grid size
            const totalCellSize = gridLayout.totalCellSize;
            const gridWidth = this.columns * totalCellSize.x;
            const gridHeight = this.rows * totalCellSize.y;

            // Add padding
            finalSize = new vec2(
                gridWidth + this.gridPadding.x,
                gridHeight + this.gridPadding.y
            );

            print(`  ✓ Auto-calculated grid size: ${gridWidth.toFixed(1)}×${gridHeight.toFixed(1)} cm`);
            print(`  ✓ Frame size (with padding): ${finalSize.x.toFixed(1)}×${finalSize.y.toFixed(1)} cm`);
        } else {
            // Use manual size
            finalSize = this.manualGridSize;
            print(`  ✓ Using manual grid size: ${finalSize.x}×${finalSize.y} cm`);
        }

        // Set Frame innerSize
        this.frame.innerSize = finalSize;
    }

    /**
     * Create a single button with image, title, and subtitle
     */
    private createButton(index: number): RectangleButton {
        const btnObj = global.scene.createSceneObject(`Button_${index}`);
        btnObj.setParent(this.gridContainer);

        // Note: z-offset will be applied AFTER GridLayout positions the buttons

        // Create RectangleButton component
        const button = btnObj.createComponent(RectangleButton.getTypeName()) as RectangleButton;

        // Set style BEFORE initialize (private field, cast to any)
        (button as any)._style = this.buttonStyle;

        // Set size BEFORE initialize (UIKit requirement)
        button.size = this.buttonSize;

        // Initialize button
        button.initialize();

        // Configure button properties (after initialization)
        button.renderOrder = this.renderOrder;
        button.hasShadow = this.hasShadow;

        // Add interaction event
        button.onTriggerUp.add(() => {
            if (this.logInteractions) {
                print(`  → Button ${index} pressed`);
            }
            this.onButtonPressed(index, button);
        });

        // Add button content (image, title, subtitle)
        this.createButtonContent(btnObj, index);

        return button;
    }

    /**
     * Apply z-offset to all buttons after GridLayout positions them
     */
    private applyButtonZOffset() {
        if (!this.gridContainer) {
            return;
        }

        // Iterate through all button objects and adjust their z position
        for (let i = 0; i < this.gridContainer.getChildrenCount(); i++) {
            const buttonObj = this.gridContainer.getChild(i);
            const currentPos = buttonObj.getTransform().getLocalPosition();
            buttonObj.getTransform().setLocalPosition(new vec3(
                currentPos.x,
                currentPos.y,
                this.buttonZOffset
            ));
        }

        print(`  ✓ Applied z-offset (${this.buttonZOffset} cm) to all buttons`);
    }

    /**
     * Create button content using ButtonContentLayout utility
     * Layout: Image → Title → Subtitle (top to bottom in a container)
     * Automatically scales all properties based on button size (reference: 10x10 cm)
     * Uses aspect-ratio-aware scaling to handle wide/short buttons properly
     */
    private createButtonContent(buttonObj: SceneObject, index: number) {
        // Create configuration
        const config = new ButtonContentLayoutConfig();

        // Calculate scale factors (reference size is 10x10 cm)
        const widthScaleFactor = this.buttonSize.x / 10.0;
        const heightScaleFactor = this.buttonSize.y / 10.0;

        // For image and vertical spacing, use the SMALLER dimension to ensure fit
        // This prevents oversized images when buttons are wide but short
        const verticalScaleFactor = Math.min(widthScaleFactor, heightScaleFactor);

        // Use dampened scaling for text (square root of width) for better fit
        const textScaleFactor = Math.sqrt(widthScaleFactor);

        // Image settings (scale based on vertical space available)
        config.showImage = this.showButtonImage;
        config.imageSize = this.buttonImageSize * verticalScaleFactor;

        // Title settings (use dampened scale factor for better fit)
        config.showTitle = this.showButtonTitle;
        config.titleText = `Item ${index}`;
        config.titleSize = this.titleTextSize * textScaleFactor;
        config.titleColor = this.titleColor;

        // Subtitle settings (use dampened scale factor for better fit)
        config.showSubtitle = this.showButtonSubtitle;
        config.subtitleText = `Description ${index}`;
        config.subtitleSize = this.subtitleTextSize * textScaleFactor;
        config.subtitleColor = this.subtitleColor;

        // Layout settings (vertical spacing scales with height, horizontal with width)
        config.imageToTitleSpacing = this.imageToTitleSpacing * verticalScaleFactor;
        config.titleToSubtitleSpacing = this.titleToSubtitleSpacing * verticalScaleFactor;
        config.offsetX = this.contentOffsetX * widthScaleFactor;
        // Adjust vertical offset: move content UP more when button is shorter
        config.offsetY = this.contentOffsetY * heightScaleFactor;
        // Move image to the right relative to text
        config.imageOffsetX = this.imageOffsetX * widthScaleFactor;
        config.buttonWidth = this.buttonSize.x;

        // Text alignment and layout rect (aligned with image at x=0)
        config.textHorizontalAlignment = this.getHorizontalAlignment(this.textHorizontalAlignment);
        config.textVerticalAlignment = this.getVerticalAlignment(this.textVerticalAlignment);
        // Text rect starts at 0 (aligned with image) and extends right based on button width
        // Using ratio ensures text stays within button bounds regardless of contentOffset
        const textWidth = this.buttonSize.x * this.textLayoutRectWidthRatio;
        config.textLayoutRectLeft = this.textLayoutRectLeftOffset;
        config.textLayoutRectRight = this.textLayoutRectLeftOffset + textWidth;
        // Vertical bounds scale with vertical space to prevent overflow
        config.textLayoutRectBottom = this.textLayoutRectBottom * verticalScaleFactor;
        config.textLayoutRectTop = this.textLayoutRectTop * verticalScaleFactor;

        // Create content layout
        const contentLayout = new ButtonContentLayout(buttonObj, config);
        contentLayout.create();

        // Set image material/texture (if image exists)
        if (this.showButtonImage) {
            this.setImageMaterial(contentLayout);
        }
    }

    /**
     * Convert string to HorizontalAlignment enum
     */
    private getHorizontalAlignment(alignment: string): HorizontalAlignment {
        switch (alignment) {
            case "Left": return HorizontalAlignment.Left;
            case "Right": return HorizontalAlignment.Right;
            case "Center": return HorizontalAlignment.Center;
            default: return HorizontalAlignment.Left;
        }
    }

    /**
     * Convert string to VerticalAlignment enum
     */
    private getVerticalAlignment(alignment: string): VerticalAlignment {
        switch (alignment) {
            case "Top": return VerticalAlignment.Top;
            case "Bottom": return VerticalAlignment.Bottom;
            case "Center": return VerticalAlignment.Center;
            default: return VerticalAlignment.Center;
        }
    }

    /**
     * Set image material and texture
     */
    private setImageMaterial(contentLayout: ButtonContentLayout) {
        const imageComponent = contentLayout.getImageComponent();
        if (!imageComponent) {
            return;
        }

        // Warn once if texture or material are not set
        if (!this.hasWarnedAboutImage) {
            if (!this.buttonImageTexture && !this.buttonImageMaterial) {
                print(`⚠️  WARNING: Button Image Texture and Material are not set. Please assign an image texture and material to visualize icons.`);
                this.hasWarnedAboutImage = true;
            } else if (!this.buttonImageTexture) {
                print(`⚠️  WARNING: Button Image Texture is not set. Please assign an image texture to visualize icons.`);
                this.hasWarnedAboutImage = true;
            } else if (!this.buttonImageMaterial) {
                print(`ℹ️  INFO: Button Image Material is not set. Using default unlit material.`);
                this.hasWarnedAboutImage = true;
            }
        }

        // Use custom material if provided, otherwise use default
        if (this.buttonImageMaterial) {
            imageComponent.mainMaterial = this.buttonImageMaterial.clone();
        }

        // Set texture if provided
        const material = imageComponent.mainMaterial;
        if (material && material.mainPass) {
            if (this.buttonImageTexture) {
                material.mainPass.baseTex = this.buttonImageTexture;
            } else {
                // Gray placeholder
                material.mainPass.baseColor = new vec4(0.7, 0.7, 0.7, 1);
            }
        }
    }

    /**
     * Clear existing grid and Frame
     */
    public clearGrid() {
        // Cleanup drag functionality if it exists
        if (this.gridRearrangement) {
            this.gridRearrangement.destroy();
            this.gridRearrangement = null;
        }

        if (this.gridContainer) {
            this.gridContainer.destroy();
            this.gridContainer = null;
        }
        if (this.frameObject) {
            this.frameObject.destroy();
            this.frameObject = null;
            this.frame = null;
        }
        this.gridLayout = null;
        this.buttons = [];
        this.hasWarnedAboutImage = false;
    }

    /**
     * Override this method to handle button presses
     */
    protected onButtonPressed(index: number, button: RectangleButton) {
        // Override in derived classes for custom behavior
    }

    /**
     * Get a specific button by index (1-based)
     */
    public getButton(index: number): RectangleButton {
        if (index < 1 || index > this.buttons.length) {
            print(`ERROR: Button index ${index} out of range (1-${this.buttons.length})`);
            return null;
        }
        return this.buttons[index - 1];
    }

    /**
     * Get all buttons
     */
    public getButtons(): RectangleButton[] {
        return this.buttons;
    }

    /**
     * Update button text by index (1-based)
     * @param index Button index (1 to total buttons)
     * @param title New title text (optional)
     * @param subtitle New subtitle text (optional)
     */
    public updateButtonText(index: number, title?: string, subtitle?: string) {
        const button = this.getButton(index);
        if (!button) {
            return;
        }

        const buttonObj = button.getSceneObject();
        const contentContainer = buttonObj.getChild(0); // ContentContainer

        if (!contentContainer) {
            print(`ERROR: Button ${index} has no content container`);
            return;
        }

        // Find TextContainer (second child if image exists, first child otherwise)
        let textContainer: SceneObject = null;
        for (let i = 0; i < contentContainer.getChildrenCount(); i++) {
            const child = contentContainer.getChild(i);
            if (child.name === "TextContainer") {
                textContainer = child;
                break;
            }
        }

        if (!textContainer) {
            print(`ERROR: Button ${index} has no text container`);
            return;
        }

        // Update title
        if (title !== undefined) {
            for (let i = 0; i < textContainer.getChildrenCount(); i++) {
                const child = textContainer.getChild(i);
                if (child.name === "Title") {
                    const textComp = child.getComponent("Component.Text") as Text;
                    if (textComp) {
                        textComp.text = title;
                    }
                    break;
                }
            }
        }

        // Update subtitle
        if (subtitle !== undefined) {
            for (let i = 0; i < textContainer.getChildrenCount(); i++) {
                const child = textContainer.getChild(i);
                if (child.name === "Subtitle") {
                    const textComp = child.getComponent("Component.Text") as Text;
                    if (textComp) {
                        textComp.text = subtitle;
                    }
                    break;
                }
            }
        }
    }

    /**
     * Update button image by index (1-based)
     * @param index Button index (1 to total buttons)
     * @param texture New texture (optional)
     * @param material New material (optional)
     */
    public updateButtonImage(index: number, texture?: Texture, material?: Material) {
        const button = this.getButton(index);
        if (!button) {
            return;
        }

        const buttonObj = button.getSceneObject();
        const contentContainer = buttonObj.getChild(0); // ContentContainer

        if (!contentContainer) {
            print(`ERROR: Button ${index} has no content container`);
            return;
        }

        // Find Image object
        let imageObj: SceneObject = null;
        for (let i = 0; i < contentContainer.getChildrenCount(); i++) {
            const child = contentContainer.getChild(i);
            if (child.name === "Image") {
                imageObj = child;
                break;
            }
        }

        if (!imageObj) {
            print(`ERROR: Button ${index} has no image object`);
            return;
        }

        const imageComp = imageObj.getComponent("Component.Image") as Image;
        if (!imageComp) {
            print(`ERROR: Button ${index} image object has no Image component`);
            return;
        }

        // Update material
        if (material) {
            imageComp.mainMaterial = material.clone();
        }

        // Update texture
        const mat = imageComp.mainMaterial;
        if (texture && mat && mat.mainPass) {
            mat.mainPass.baseTex = texture;
        }
    }

    /**
     * Set button callback by index (1-based)
     * @param index Button index (1 to total buttons)
     * @param callback Function to call when button is pressed
     */
    public setButtonCallback(index: number, callback: () => void) {
        const button = this.getButton(index);
        if (!button) {
            return;
        }

        // Add callback to button's onTriggerUp event
        button.onTriggerUp.add(callback);
    }

    /**
     * Update grid size (recalculate and apply Frame size)
     */
    public updateGridSize() {
        if (!this.gridContainer) {
            print("ERROR: Grid not generated yet. Call generateGrid() first.");
            return;
        }

        const gridLayout = this.gridContainer.getComponent(GridLayout.getTypeName()) as GridLayout;
        if (gridLayout) {
            this.adjustFrameSize(gridLayout);
        }
    }

    /**
     * Get the calculated grid dimensions
     */
    public getGridSize(): vec2 {
        if (!this.gridContainer) {
            return vec2.zero();
        }

        const gridLayout = this.gridContainer.getComponent(GridLayout.getTypeName()) as GridLayout;
        if (!gridLayout) {
            return vec2.zero();
        }

        const totalCellSize = gridLayout.totalCellSize;
        return new vec2(
            this.columns * totalCellSize.x,
            this.rows * totalCellSize.y
        );
    }

    /**
     * Get the Frame component
     */
    public getFrame(): Frame {
        return this.frame;
    }
}
