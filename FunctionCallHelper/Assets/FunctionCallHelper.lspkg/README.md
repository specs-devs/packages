# Function Call Helper

## What is this about?

The Function Call Helper package provides a system for exposing function callbacks in the inspector, allowing you to configure and trigger script functions through UI buttons in Lens Studio. It enables you to set up function calls visually in the inspector without writing additional code, supports beautified display names, and handles button text formatting with multi-line support.

## How to use

1. **Import the package** into your Lens Studio project
2. **Add the FunctionCallHelper prefab** to your scene from the Prefabs folder
3. **Assign a button prefab** (CapsuleButton or RectangleButton) to the Button Prefab field
4. **Assign a parent SceneObject** where buttons will be instantiated
5. **Configure triggerable functions** by adding entries with script components and function names
6. **Create your script components** with public functions that can be triggered
7. **Optionally implement getFunctionName()** in your scripts for custom button labels

## Details

- **Inspector-Based Configuration**: Configure function callbacks directly in the inspector without code
- **Function Callback Exposure**: Expose and trigger script functions through a visual interface
- **Function Invocation**: Calls specified functions on script components when buttons are clicked
- **Beautified Labels**: Supports custom display names via `getFunctionName()` method
- **Multi-line Text**: Automatically splits button text across multiple lines for better readability
- **Flexible Button Types**: Works with both CapsuleButton and RectangleButton prefabs
- **External Layout Control**: Button positioning is handled by external layout systems (e.g., GridLayout)

## Description of Scripts

- **FunctionCallHelper.ts**: Main component that creates buttons and handles click events
- **TriggerableFunction**: Type definition for configuring which functions to trigger
- **Examples/**: Contains example scripts demonstrating different function patterns
  - Each example script includes a triggerable function and optional `getFunctionName()` method
  - Example scripts show how to update Text components when functions are called

## Example Usage

Create a script component with a public function:

```typescript
@component
export class MyScript extends BaseScriptComponent 
{
    @input
    displayText: Text

    public myFunction() 
    {
        if (this.displayText)
        {
            this.displayText.text = "Function called!"
        }
    }

    public getFunctionName()
    {
        return "My Function"
    }
}
```

Then configure the FunctionCallHelper component in the inspector:
- Add the script component to the TriggerableFunction array
- Set the function name (e.g., "myFunction")
- The button will display "My Function" split across lines as "My" and "Function"









