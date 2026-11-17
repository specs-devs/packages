// Preload ThemeService before any UIKit visual to break a circular-import init-order
// crash in the package (Visual.ts imports ThemeService before defining COLORS, and the
// theme chain reads COLORS at module-load). Entering the import cycle via ThemeService
// lets Visual.ts finish defining COLORS first. Must remain the FIRST import.
import "SpectaclesUIKit.lspkg/Scripts/Themes/ThemeService"
// The next/previous nav buttons in the scene are UIKit RoundButton components. The @input
// type MUST match the wired component's concrete @component class, otherwise Lens Studio
// hands back a bare ScriptComponent without the typed API (onTriggerUp), which is what
// caused "Cannot read property 'add' of undefined". RoundButton inherits onTriggerUp from
// the Element base class.
import { RoundButton } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/RoundButton";

@component
export class UIController extends BaseScriptComponent {
  @input
  sceneObjects: SceneObject[];

  @input
  textObject: Text | undefined;

  @input
  counterText: Text | undefined;

  @input
  nextButton: RoundButton | undefined;

  @input
  previousButton: RoundButton | undefined;

  private currentIndex: number = 0;

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => {
      this.onStart();
    });
  }

  onStart() {
    if (!this.sceneObjects || this.sceneObjects.length === 0) {
      print("No scene objects to navigate.");
      return;
    }

    // Activate the initial object
    this.activateCurrentObject();

    this.bindNav(this.nextButton, +1, "nextButton");
    this.bindNav(this.previousButton, -1, "previousButton");
  }

  // Subscribes a nav button's trigger to a step through sceneObjects. Guards against a
  // mis-wired input (onTriggerUp absent) so a bad reference logs instead of crashing.
  private bindNav(button: RoundButton | undefined, step: number, label: string) {
    if (!button) return;
    if (!button.onTriggerUp) {
      print(`[UIController] ${label} is wired but is not a RoundButton (no onTriggerUp); skipping.`);
      return;
    }
    button.onTriggerUp.add(() => {
      const len = this.sceneObjects.length;
      this.currentIndex = (this.currentIndex + step + len) % len;
      const delayEvent = this.createEvent("DelayedCallbackEvent");
      delayEvent.bind(() => {
        this.activateCurrentObject();
      });
      delayEvent.reset(0.2);
    });
  }

  activateCurrentObject() {
    // Deactivate all objects
    this.sceneObjects.forEach((obj) => {
      obj.enabled = false;
    });

    // Activate the current object
    let currentObject = this.sceneObjects[this.currentIndex];
    currentObject.enabled = true;

    // Update the text object with the current object's name
    if (this.textObject) {
      this.textObject.text = currentObject.name;
    }

    // Update the counter text with current index / total count
    if (this.counterText) {
      this.counterText.text = `${this.currentIndex + 1}/${this.sceneObjects.length}`;
    }
  }
}

