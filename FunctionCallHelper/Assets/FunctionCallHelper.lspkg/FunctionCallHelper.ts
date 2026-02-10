/**
 * Specs Inc. 2026
 * Dynamic button generator for triggering component functions. Automatically creates UI buttons
 * from an array of triggerable functions, enabling dynamic UI creation with GridLayout support.
 */
import { CapsuleButton } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/CapsuleButton"
import { RectangleButton } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/RectangleButton"
import { ScrollWindow } from "SpectaclesUIKit.lspkg/Scripts/Components/ScrollWindow/ScrollWindow"
import { GridLayout } from "SpectaclesUIKit.lspkg/Scripts/Components/GridLayout/GridLayout"

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
    @input scrollWindow: ScrollWindow

    // Optional: GridLayout component - will be found automatically if not assigned
    @input gridLayout: GridLayout

    private scrollWindowInitialized: boolean = false

    onAwake() 
    {
        this.createEvent("OnStartEvent").bind(this.onStart.bind(this))
    }

    onStart()
    {
        // Validate inputs
        if (!this.buttonPrefab)
        {
            throw new Error("FunctionTriggerer: Button prefab is not assigned. Assign a button prefab in the inspector.")
        }

        if (!this.parentObject)
        {
            throw new Error("FunctionTriggerer: Parent object is not assigned. Assign a parent SceneObject in the inspector.")
        }

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
            if (this.scrollWindow.isInitialized)
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

            // Ensure GridLayout is updated after adding new children
            if (this.gridLayout)
            {
                if (!this.gridLayout.isInitialized)
                {
                    this.gridLayout.initialize()
                }
                else
                {
                    // Re-layout to position newly added buttons
                    this.gridLayout.layout()
                }
            }

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

        // If GridLayout exists, use its cell size for calculations
        if (this.gridLayout)
        {
            // GridLayout properties are available even if not initialized
            // But we should ensure it's initialized for accurate calculations
            if (!this.gridLayout.isInitialized)
            {
                print(`GridLayout not initialized yet, initializing now...`)
                this.gridLayout.initialize()
            }

            const totalCellSize = this.gridLayout.totalCellSize
            const totalRows = this.gridLayout.totalRows
            const totalColumns = this.gridLayout.totalColumns

            // Calculate scroll dimensions based on GridLayout
            scrollDimensionX = totalColumns * totalCellSize.x
            scrollDimensionY = totalRows * totalCellSize.y

            print(`Updating ScrollWindow dimensions using GridLayout: ${scrollDimensionX} x ${scrollDimensionY}`)
            print(`GridLayout: ${totalRows} rows x ${totalColumns} columns, cell size: ${totalCellSize.x} x ${totalCellSize.y}`)

            // Update snap region if scroll snapping is enabled
            if (this.scrollWindow.scrollSnapping)
            {
                // Set snap region to match cell size (for vertical scrolling, use Y component)
                const snapRegion = this.scrollWindow.snapRegion
                if (this.scrollWindow.vertical)
                {
                    this.scrollWindow.snapRegion = new vec2(snapRegion.x, totalCellSize.y)
                    print(`Updated snap region Y to: ${totalCellSize.y} (matches cell height)`)
                }
                if (this.scrollWindow.horizontal)
                {
                    this.scrollWindow.snapRegion = new vec2(totalCellSize.x, snapRegion.y)
                    print(`Updated snap region X to: ${totalCellSize.x} (matches cell width)`)
                }
            }
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

    // Creates a button for the given triggerable function
    private createButton(triggerableFunction: TriggerableFunction, index: number)
    {
        // Instantiate button under the parent
        // Position is handled by external behavior
        const buttonObject = this.buttonPrefab.instantiate(this.parentObject)
        
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
