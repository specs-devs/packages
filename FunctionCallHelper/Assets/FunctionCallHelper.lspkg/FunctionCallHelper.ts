/**
 * Specs Inc. 2026
 * Dynamic button generator for triggering component functions. Automatically creates UI buttons
 * from an array of triggerable functions, enabling dynamic UI creation with GridLayout support.
 */
// Preload ThemeService before any UIKit visual to break a circular-import init-order
// crash in the package (Visual.ts imports ThemeService before defining COLORS, and the
// theme chain reads COLORS at module-load). Loading ThemeService first lets Visual.ts
// finish initializing COLORS before the visual chain reads it.
import "SpectaclesUIKit.lspkg/Scripts/Themes/ThemeService";
import { CapsuleButton } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/CapsuleButton"
import { RectangleButton } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/RectangleButton"
import { ScrollWindow } from "SpectaclesUIKit.lspkg/Scripts/Components/ScrollWindow/ScrollWindow"
import { GridLayout } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Grid/GridLayout"
import { GridItem } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Grid/GridItem"
import { ValidationUtils } from "Utilities.lspkg/Scripts/Utils/ValidationUtils"
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent, bindUpdateEvent, bindLateUpdateEvent, bindDestroyEvent } from "SnapDecorators.lspkg/decorators";

// Defines a function that can be triggered via button click
@typedef
export class TriggerableFunction
{
    // Script component containing the function to call
    @input
    script: ScriptComponent
    
    // Name of the function to call on the script component
    @input
    functionName: string
}

@component
export class ButtonClickEvent extends BaseScriptComponent 
{
    // Array of functions to create buttons for
    @input triggerableFunctions: TriggerableFunction[]

    // Button prefab to instantiate - assign in inspector
    @input buttonPrefab: ObjectPrefab
    
    // Parent SceneObject where buttons will be instantiated - assign in inspector
    @input parentObject: SceneObject

    // Optional: ScrollWindow component - will be found automatically if not assigned
    @input
    @allowUndefined
    scrollWindow: ScrollWindow

    // Optional: GridLayout component - will be found automatically if not assigned
    @input
    @allowUndefined
    gridLayout: GridLayout

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Button Sizing</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">When enabled, every instantiated button is resized to <code>buttonSize</code> (cm) and re-initialized so the visual reflects the new size. The Layout2D grid auto-reflows on the next frame.</span>')

    @input
    @hint("Enable to stamp a custom size on every button. Leave off to use the prefab's native size.")
    overrideButtonSize: boolean = false

    @input
    @showIf("overrideButtonSize", true)
    @hint("Width (X), height (Y), depth (Z) in centimeters. Applied to each button after instantiation.")
    buttonSize: vec3 = new vec3(10, 4, 0.5)

    @input
    @showIf("overrideButtonSize", true)
    @hint("Top padding inside the grid container (cm). Increase to clear the Frame's title bar so the first button isn't clipped at the top.")
    topPadding: number = 3

    private scrollWindowInitialized: boolean = false

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Logging Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Control logging output for this script instance</span>')

  @input
  @hint("Enable general logging (animation cycles, events, etc.)")
  enableLogging: boolean = false;

  @input
  @hint("Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.)")
  enableLoggingLifecycle: boolean = false;

  // Logger instance
  private logger: Logger;

  /**
   * Called when component is initialized
   */
    onAwake()
    {
        // Initialize logger
        this.logger = new Logger("ButtonClickEvent", this.enableLogging || this.enableLoggingLifecycle, true);

        if (this.enableLoggingLifecycle) {
            this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
        }

        this.createEvent("OnStartEvent").bind(this.onStart.bind(this))
    }

    onStart()
    {
        // Validate inputs using Utilities
        ValidationUtils.assertNotNull(
            this.buttonPrefab,
            "FunctionTriggerer: Button prefab is not assigned. Assign a button prefab in the inspector."
        );
        ValidationUtils.assertNotNull(
            this.parentObject,
            "FunctionTriggerer: Parent object is not assigned. Assign a parent SceneObject in the inspector."
        );

        // Try to find ScrollWindow if not assigned
        if (!this.scrollWindow)
        {
            // Search in parent hierarchy
            let current: SceneObject = this.parentObject
            while (current)
            {
                this.scrollWindow = current.getComponent(ScrollWindow.getTypeName())
                if (this.scrollWindow)
                {
                    print(`Found ScrollWindow on: ${current.name}`)
                    break
                }
                current = current.getParent()
            }
        }

        // Try to find GridLayout if not assigned
        if (!this.gridLayout)
        {
            // Search in parent hierarchy
            let current: SceneObject = this.parentObject
            while (current)
            {
                this.gridLayout = current.getComponent(GridLayout.getTypeName())
                if (this.gridLayout)
                {
                    print(`Found GridLayout on: ${current.name}`)
                    break
                }
                current = current.getParent()
            }
        }

        // If ScrollWindow exists, wait for initialization before creating buttons
        if (this.scrollWindow)
        {
            if (this.scrollWindow.initialized)
            {
                this.scrollWindowInitialized = true
                this.createButtonsAndUpdateScroll()
            }
            else
            {
                this.scrollWindow.onInitialized.add(() =>
                {
                    this.scrollWindowInitialized = true
                    this.createButtonsAndUpdateScroll()
                })
            }
        }
        else
        {
            // No ScrollWindow, just create buttons normally
            this.createButtonsAndUpdateScroll()
        }
    }

    // Creates buttons and updates scroll dimensions
    private createButtonsAndUpdateScroll()
    {
        // Create buttons for each triggerable function
        if (this.triggerableFunctions && this.triggerableFunctions.length > 0)
        {
            for (let i = 0; i < this.triggerableFunctions.length; i++)
            {
                const triggerableFunction = this.triggerableFunctions[i]
                this.createButton(triggerableFunction, i)
            }

            // UIKit 0.1.7 Layout2D GridLayout auto-batches layout in LateUpdate —
            // newly added children with a GridItem component get positioned on the
            // next frame without an explicit reflow call.
            // If the user opted into size override, drive the grid's cell dimensions
            // from buttonSize so the visible cell matches Button.size. The grid is
            // authoritative for item footprint; the Button.size alone doesn't resize
            // the rendered cell.
            this.applyGridSizeOverride()

            // Update ScrollWindow dimensions if available
            if (this.scrollWindow && this.scrollWindowInitialized)
            {
                this.updateScrollDimensions()
            }
        }
    }

    // Updates ScrollWindow scroll dimensions based on number of functions and GridLayout
    private updateScrollDimensions()
    {
        if (!this.scrollWindow || !this.scrollWindowInitialized)
        {
            return
        }

        const functionCount = this.triggerableFunctions ? this.triggerableFunctions.length : 0
        if (functionCount === 0)
        {
            return
        }

        let scrollDimensionX: number = 0
        let scrollDimensionY: number = 0

        // If GridLayout exists, use its container size for scroll dimensions.
        // UIKit 0.1.7 Layout2D Grid: the container's `width`/`height` inputs define
        // the grid's content area directly — that's what the scroll window needs.
        // Cell dimensions are driven by templateColumns/templateRows/autoRows/autoColumns
        // and can be variable, so we no longer derive per-cell snap region here;
        // configure `snapRegion` in the Inspector if you need snapping.
        if (this.gridLayout)
        {
            scrollDimensionX = this.gridLayout.width
            scrollDimensionY = this.gridLayout.height

            print(`Updating ScrollWindow dimensions using GridLayout container size: ${scrollDimensionX} x ${scrollDimensionY}`)
        }
        else
        {
            // Fallback: use a default cell height (e.g., 4 units per button)
            // This matches the FunctionTriggerer example
            const defaultCellHeight = 4
            scrollDimensionY = functionCount * defaultCellHeight

            // Use current window width or a default
            // Access windowSize property directly or via method
            const scrollWindowAny = this.scrollWindow as any
            scrollDimensionX = scrollWindowAny.getWindowSize ? scrollWindowAny.getWindowSize().x : scrollWindowAny.windowSize?.x || 10

            print(`Updating ScrollWindow dimensions using default calculation: ${scrollDimensionX} x ${scrollDimensionY}`)
        }

        // Update scroll dimensions
        // Use type casting to access methods that may not be in TypeScript definitions
        const scrollWindowAny = this.scrollWindow as any
        if (scrollWindowAny.setScrollDimensions)
        {
            scrollWindowAny.setScrollDimensions(new vec2(scrollDimensionX, scrollDimensionY))
            const dimensions = scrollWindowAny.getScrollDimensions ? scrollWindowAny.getScrollDimensions() : scrollWindowAny.scrollDimensions
            print(`ScrollWindow scroll dimensions set to: ${dimensions}`)
        }
        else
        {
            // Fallback: try setting scrollDimensions property directly
            scrollWindowAny.scrollDimensions = new vec2(scrollDimensionX, scrollDimensionY)
            print(`ScrollWindow scroll dimensions set to: ${scrollWindowAny.scrollDimensions}`)
        }

        // Set initial scroll position to top (for vertical scrolling)
        if (this.scrollWindow.vertical)
        {
            this.scrollWindow.scrollPositionNormalized = new vec2(0, 1)
            print(`Scroll position set to top (normalized: 0, 1)`)
        }
    }

    // Splits text into multiple lines by spaces or PascalCase words, preserving capitalization
    private splitIntoLines(text: string): string
    {
        // First try splitting by spaces
        if (text.includes(" "))
        {
            return text.split(" ").join("\n")
        }
        
        // If no spaces, split by PascalCase (capital letters)
        // Match capital letters that are followed by lowercase letters or end of string
        const words = text.split(/(?=[A-Z])/).filter(word => word.length > 0)
        return words.join("\n")
    }

    /**
     * Drive the 2D grid's track sizing from `buttonSize` so the visible cell
     * (which is what the user actually sees — button visuals conform to their
     * cell, not to `Button.size`) matches the requested dimensions.
     *
     * We set `templateColumns` to a single fixed column of `buttonSize.x` cm
     * and `autoRows` to `buttonSize.y` cm, then expand `width` to match so the
     * track doesn't get clipped by the container. `height` is left alone — a
     * ScrollWindow usually owns vertical extent, and the grid auto-expands via
     * autoRows as items are added.
     */
    private applyGridSizeOverride(): void
    {
        if (!this.overrideButtonSize) return
        if (!this.gridLayout) return
        const size = this.buttonSize || new vec3(10, 4, 0.5)
        try
        {
            const colTemplate = `${size.x}cm`
            const rowTemplate = `${size.y}cm`
            const topPad = this.topPadding ?? 0
            const buttonCount = this.triggerableFunctions ? this.triggerableFunctions.length : 0
            // Expand the grid container vertically to fit every row, otherwise
            // rows beyond the existing container height overflow into / out of
            // the Frame. Include the row gap between cells and both paddings so
            // nothing is clipped. Width tracks the single column we just set.
            const rowGap = this.gridLayout.rowGap ?? 0
            const bottomPad = this.gridLayout.paddingBottom ?? 0
            const neededHeight = buttonCount > 0
                ? (buttonCount * size.y) + Math.max(0, buttonCount - 1) * rowGap + topPad + bottomPad
                : this.gridLayout.height
            print(`FunctionCallHelper: overriding grid cells -> templateColumns="${colTemplate}", autoRows="${rowTemplate}", width=${size.x}cm, height=${neededHeight}cm, paddingTop=${topPad}cm, buttons=${buttonCount}`)
            this.gridLayout.templateColumns = colTemplate
            this.gridLayout.autoRows = rowTemplate
            this.gridLayout.width = size.x
            this.gridLayout.height = neededHeight
            this.gridLayout.paddingTop = topPad
        }
        catch (e)
        {
            print(`Warning: failed to apply grid size override: ${e}`)
        }
    }

    /**
     * Apply the buttonSize override to a newly-instantiated UIKit button.
     *
     * UIKit 0.1.7 button lifecycle (VisualElement.ts + Button.ts):
     *   - Prefab-instantiated buttons are not yet initialized when our code
     *     runs synchronously after `prefab.instantiate()`. LS awakes them on a
     *     later tick, at which point `initialize()` runs and
     *     `configureVisual()` calls `this._visual.size = this._size`.
     *   - If we set `size` synchronously, we're racing with that init — the
     *     setter can no-op on the visual (visual doesn't exist yet), and a
     *     subsequent initialize snapshots `_size` correctly but any later
     *     grid re-layout can still override.
     *
     * We therefore apply size twice: (a) immediately, so `_size` is captured
     * pre-init and the first visual draw uses it; (b) on the next frame, after
     * every component's awake + the 2D grid's first reflow have landed — at
     * which point the button IS initialized, so the setter's `_initialized`
     * branch writes straight through to `visual.size`.
     */
    private applySizeOverride(button: any): void
    {
        if (!this.overrideButtonSize) return
        const targetSize = this.buttonSize || new vec3(10, 4, 0.5)
        print(`FunctionCallHelper: overriding button size -> ${targetSize.x}cm x ${targetSize.y}cm x ${targetSize.z}cm`)
        if (!("size" in button))
        {
            print(`  (button component ${(button as any).getTypeName?.() ?? "<unknown>"} has no 'size' property; skipping override)`)
            return
        }

        // Pass 1 — apply now so initialize() picks up the target size if this
        // button hasn't been awake'd yet.
        try
        {
            button.size = targetSize
            if (typeof button.initialize === "function")
            {
                button.initialize()
            }
        }
        catch (e)
        {
            print(`Warning: initial buttonSize apply failed: ${e}`)
        }

        // Pass 2 — after one frame, the button is fully initialized and the
        // 2D grid has done its first layout. A second setter call now hits the
        // `_initialized` branch and pushes size through to visual.size directly.
        const deferred = this.createEvent("DelayedCallbackEvent")
        deferred.bind(() => {
            try
            {
                button.size = targetSize
            }
            catch (e)
            {
                print(`Warning: deferred buttonSize apply failed: ${e}`)
            }
        })
        deferred.reset(0)
    }

    // Creates a button for the given triggerable function
    private createButton(triggerableFunction: TriggerableFunction, index: number)
    {
        // Instantiate button under the parent.
        // Position is handled by the Layout2D Grid on the parent — each button
        // gets a GridItem component with autoPlacement enabled so the grid's
        // auto-flow engine places it on the next available cell.
        const buttonObject = this.buttonPrefab.instantiate(this.parentObject)
        if (this.gridLayout)
        {
            const gridItem = buttonObject.createComponent(GridItem.getTypeName()) as GridItem
            gridItem.autoPlacement = true
        }
        
        // Get button component - try both CapsuleButton and RectangleButton
        // Try root first, then search children recursively
        let button: any = buttonObject.getComponent(CapsuleButton.getTypeName()) || 
                         buttonObject.getComponent(RectangleButton.getTypeName())
        
        // If not found on root, search in children
        if (!button)
        {
            for (let i = 0; i < buttonObject.children.length; i++)
            {
                const child = buttonObject.getChild(i)
                button = child.getComponent(CapsuleButton.getTypeName()) || 
                         child.getComponent(RectangleButton.getTypeName())
                if (button)
                {
                    break
                }
            }
        }
        
        if (button && button.onTriggerUp)
        {
            print(`Button component found for function: ${triggerableFunction.functionName}`)
            this.applySizeOverride(button)
            button.onTriggerUp.add(() =>
            {
                print(`Button clicked for function: ${triggerableFunction.functionName}`)
                this.invokeFunction(triggerableFunction.script, triggerableFunction.functionName)
            })
        }
        else
        {
            print(`Warning: Button component not found on button prefab. Searching for any component with onTriggerUp...`)
            // Try to find any component with onTriggerUp method
            const allComponents = buttonObject.getComponents("Component")
            for (let i = 0; i < allComponents.length; i++)
            {
                const comp = allComponents[i] as any
                if (comp && comp.onTriggerUp)
                {
                    print(`Found component with onTriggerUp: ${comp.getTypeName()}`)
                    this.applySizeOverride(comp)
                    comp.onTriggerUp.add(() =>
                    {
                        print(`Button clicked for function: ${triggerableFunction.functionName}`)
                        this.invokeFunction(triggerableFunction.script, triggerableFunction.functionName)
                    })
                    break
                }
            }
            print(`Found components: ${allComponents.map(c => c.getTypeName()).join(", ")}`)
        }

        // Set button text if text component exists
        // Use beautified function name if available, otherwise use function name
        const textChild = buttonObject.getChild(0)
        if (textChild)
        {
            const textComponent = textChild.getComponent("Text")
            if (textComponent)
            {
                let displayName = triggerableFunction.functionName
                
                // Check if script has getFunctionName method for beautified display name
                if (triggerableFunction.script)
                {
                    const script = triggerableFunction.script as any
                    print(`Setting text for function: ${triggerableFunction.functionName}, script: ${script ? script.getTypeName() : "null"}`)
                    
                    if (script.getFunctionName && typeof script.getFunctionName === "function")
                    {
                        try
                        {
                            displayName = script.getFunctionName()
                            print(`Using beautified name: ${displayName}`)
                        }
                        catch (e)
                        {
                            print(`Error calling getFunctionName: ${e}`)
                        }
                    }
                    else
                    {
                        print(`getFunctionName not found or not a function for ${triggerableFunction.functionName}`)
                    }
                }
                else
                {
                    print(`Warning: Script component is null for function: ${triggerableFunction.functionName}`)
                }
                
                // Set text on a single line (no splitting)
                textComponent.text = displayName
                print(`Button text set to: ${displayName}`)
            }
            else
            {
                print(`Warning: Text component not found on button child`)
            }
        }
        else
        {
            print(`Warning: Text child not found on button object`)
        }
    }

    // Invokes the specified function on the script component
    private invokeFunction(scriptComponent: ScriptComponent, functionName: string)
    {
        print(`invokeFunction called with functionName: ${functionName}`)
        
        if (!scriptComponent)
        {
            print(`Error: Script component is missing for function "${functionName}"`)
            throw new Error(`FunctionTriggerer: Script component is missing for function "${functionName}"`)
        }

        if (!functionName || functionName === "")
        {
            print(`Error: Function name is empty`)
            throw new Error("FunctionTriggerer: Function name is empty")
        }

        // Call the function if it exists on the script component
        const script = scriptComponent as any
        print(`Checking for function "${functionName}" on script component`)
        
        if (script[functionName] && typeof script[functionName] === "function")
        {
            print(`Calling function "${functionName}"`)
            script[functionName]("")
            print(`Function "${functionName}" called successfully`)
        }
        else
        {
            print(`Error: Function "${functionName}" not found on script component. Available methods: ${Object.getOwnPropertyNames(script).filter(name => typeof script[name] === "function").join(", ")}`)
            throw new Error(`FunctionTriggerer: Function "${functionName}" not found on script component`)
        }
    }
}
