/**
 * Specs Inc. 2026
 * Button content layout utility for creating and positioning button content vertically.
 * Arranges Image → Title → Subtitle from top to bottom with configurable spacing and alignment.
 */
export class ButtonContentLayoutConfig {
    // Image settings
    showImage: boolean = true;
    imageSize: number = 2;

    // Title settings
    showTitle: boolean = true;
    titleText: string = "Title";
    titleSize: number = 10;
    titleColor: vec4 = new vec4(1, 1, 1, 1);

    // Subtitle settings
    showSubtitle: boolean = true;
    subtitleText: string = "Subtitle";
    subtitleSize: number = 6;
    subtitleColor: vec4 = new vec4(0.8, 0.8, 0.8, 1);

    // Layout settings
    imageToTitleSpacing: number = 0.4; // Spacing between image and title
    titleToSubtitleSpacing: number = 0.1; // Spacing between title and subtitle (tighter)
    offsetX: number = 0; // Container X offset from button center
    offsetY: number = 0; // Container Y offset from button center
    imageOffsetX: number = 0; // Additional X offset for image only (relative to container)
    buttonWidth: number = 10; // Button width for alignment calculations

    // Text alignment and layout rect
    textHorizontalAlignment: HorizontalAlignment = HorizontalAlignment.Left;
    textVerticalAlignment: VerticalAlignment = VerticalAlignment.Center;
    textLayoutRectLeft: number = -7.5;
    textLayoutRectRight: number = 7.5;
    textLayoutRectBottom: number = -2.25;
    textLayoutRectTop: number = 2.25;
}

export class ButtonContentLayout {
    private buttonObject: SceneObject;
    private config: ButtonContentLayoutConfig;

    private containerObject: SceneObject = null;
    private imageObject: SceneObject = null;
    private textContainer: SceneObject = null;
    private titleObject: SceneObject = null;
    private subtitleObject: SceneObject = null;

    constructor(buttonObject: SceneObject, config: ButtonContentLayoutConfig) {
        this.buttonObject = buttonObject;
        this.config = config;
    }

    /**
     * Create content container with vertical layout
     */
    public create() {
        // Create main container
        this.containerObject = global.scene.createSceneObject("ContentContainer");
        this.containerObject.setParent(this.buttonObject);

        // Position container with offsets
        this.containerObject.getTransform().setLocalPosition(new vec3(
            this.config.offsetX,
            this.config.offsetY,
            0.15
        ));

        // Simple top-to-bottom layout starting at Y = 0
        let currentY = 0;

        // Create image at top
        if (this.config.showImage) {
            this.imageObject = this.createImage(currentY);
            // Move down: image takes up imageSize, plus spacing
            currentY -= (this.config.imageSize + this.config.imageToTitleSpacing);
        }

        // Create text container for title and subtitle
        if (this.config.showTitle || this.config.showSubtitle) {
            this.textContainer = global.scene.createSceneObject("TextContainer");
            this.textContainer.setParent(this.containerObject);
            this.textContainer.getTransform().setLocalPosition(new vec3(0, currentY, 0));

            // Inside text container, simple vertical layout
            let textY = 0;

            if (this.config.showTitle) {
                this.titleObject = this.createTitle(textY);
                textY -= this.config.titleToSubtitleSpacing;
            }

            if (this.config.showSubtitle) {
                this.subtitleObject = this.createSubtitle(textY);
            }
        }
    }


    /**
     * Create image component (parented to container)
     */
    private createImage(yPosition: number): SceneObject {
        const imageObj = global.scene.createSceneObject("Image");
        imageObj.setParent(this.containerObject);

        const imageComponent = imageObj.createComponent("Component.Image") as Image;

        // Set render order to 10
        imageComponent.renderOrder = 10;

        // Note: Material/texture will be set from PresetGrid

        // Position with optional X offset (alignment controlled by ContentContainer offset + imageOffsetX)
        imageObj.getTransform().setLocalPosition(new vec3(
            this.config.imageOffsetX,
            yPosition,
            0
        ));

        imageObj.getTransform().setLocalScale(new vec3(
            this.config.imageSize,
            this.config.imageSize,
            1
        ));

        return imageObj;
    }

    /**
     * Create title text component (parented to textContainer)
     */
    private createTitle(yPosition: number): SceneObject {
        const titleObj = global.scene.createSceneObject("Title");
        titleObj.setParent(this.textContainer);

        // Add ScreenTransform for layout rect control
        const screenTransform = titleObj.createComponent("Component.ScreenTransform") as ScreenTransform;

        // Set layout rect from config (no offset for title)
        const anchors = screenTransform.anchors;
        anchors.left = this.config.textLayoutRectLeft;
        anchors.right = this.config.textLayoutRectRight;
        anchors.bottom = this.config.textLayoutRectBottom;
        anchors.top = this.config.textLayoutRectTop;
        screenTransform.anchors = anchors;

        const titleText = titleObj.createComponent("Component.Text") as Text;
        titleText.text = this.config.titleText;
        titleText.size = this.config.titleSize;
        titleText.textFill.color = this.config.titleColor;

        // Use alignment from config
        titleText.horizontalAlignment = this.config.textHorizontalAlignment;
        titleText.verticalAlignment = this.config.textVerticalAlignment;

        // Set render order to 10
        titleText.renderOrder = 10;

        titleObj.getTransform().setLocalPosition(new vec3(
            0,
            0,
            0
        ));

        return titleObj;
    }

    /**
     * Create subtitle text component (parented to textContainer)
     */
    private createSubtitle(yPosition: number): SceneObject {
        const subtitleObj = global.scene.createSceneObject("Subtitle");
        subtitleObj.setParent(this.textContainer);

        // Add ScreenTransform for layout rect control
        const screenTransform = subtitleObj.createComponent("Component.ScreenTransform") as ScreenTransform;

        // Offset the layout rect by yPosition to maintain spacing
        const anchors = screenTransform.anchors;
        anchors.left = this.config.textLayoutRectLeft;
        anchors.right = this.config.textLayoutRectRight;
        anchors.bottom = this.config.textLayoutRectBottom + yPosition;
        anchors.top = this.config.textLayoutRectTop + yPosition;
        screenTransform.anchors = anchors;

        const subtitleText = subtitleObj.createComponent("Component.Text") as Text;
        subtitleText.text = this.config.subtitleText;
        subtitleText.size = this.config.subtitleSize;
        subtitleText.textFill.color = this.config.subtitleColor;

        // Use alignment from config
        subtitleText.horizontalAlignment = this.config.textHorizontalAlignment;
        subtitleText.verticalAlignment = this.config.textVerticalAlignment;

        // Set render order to 10
        subtitleText.renderOrder = 10;

        subtitleObj.getTransform().setLocalPosition(new vec3(
            0,
            0,
            0
        ));

        return subtitleObj;
    }

    /**
     * Update text content
     */
    public updateText(title?: string, subtitle?: string) {
        if (title && this.titleObject) {
            const titleText = this.titleObject.getComponent("Component.Text") as Text;
            if (titleText) {
                titleText.text = title;
            }
        }

        if (subtitle && this.subtitleObject) {
            const subtitleText = this.subtitleObject.getComponent("Component.Text") as Text;
            if (subtitleText) {
                subtitleText.text = subtitle;
            }
        }
    }

    /**
     * Update colors
     */
    public updateColors(titleColor?: vec4, subtitleColor?: vec4) {
        if (titleColor && this.titleObject) {
            const titleText = this.titleObject.getComponent("Component.Text") as Text;
            if (titleText) {
                titleText.textFill.color = titleColor;
            }
        }

        if (subtitleColor && this.subtitleObject) {
            const subtitleText = this.subtitleObject.getComponent("Component.Text") as Text;
            if (subtitleText) {
                subtitleText.textFill.color = subtitleColor;
            }
        }
    }

    /**
     * Get created objects
     */
    public getContainerObject(): SceneObject { return this.containerObject; }
    public getImageObject(): SceneObject { return this.imageObject; }
    public getTitleObject(): SceneObject { return this.titleObject; }
    public getSubtitleObject(): SceneObject { return this.subtitleObject; }

    /**
     * Get image component for material assignment
     */
    public getImageComponent(): Image | null {
        if (this.imageObject) {
            return this.imageObject.getComponent("Component.Image") as Image;
        }
        return null;
    }

    /**
     * Destroy all created content
     */
    public destroy() {
        // Destroying container will destroy all children
        if (this.containerObject) {
            this.containerObject.destroy();
        }
    }
}
