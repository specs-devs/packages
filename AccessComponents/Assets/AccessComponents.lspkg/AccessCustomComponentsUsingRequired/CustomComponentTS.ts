/**
 * Specs Inc. 2026
 * A sample custom component that demonstrates how to create reusable components that can be
 * accessed by other scripts. Provides public methods and properties for cross-script communication.
 */
@component
export class CustomComponentTS extends BaseScriptComponent {
    // Public property that can be accessed
    public textureSize: number = 512;

    // Called when the component is initialized
    onAwake(): void {
        print("CustomComponentTS has been initialized");
    }

    // Public method that can be called
    public hasTexture(): boolean {
        print("CustomComponentTS.hasTexture() called successfully");
        return true;
    }
}
