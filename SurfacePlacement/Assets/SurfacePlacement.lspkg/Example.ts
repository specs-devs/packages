/**
 * SPECS Inc. 2027
 * Example of driving surface placement: starts it in the mode picked in the Inspector, places the
 * content and its menu on the surface found, sizes them for near or far placement, and starts
 * placement again from the menu's Reset button.
 */
import { PlacementMode, PlacementSettings } from "./Scripts/PlacementSettings";

import { SurfacePlacementController } from "./Scripts/SurfacePlacementController";
import WorldCameraFinderProvider from "InteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider";

// Far placement lands the object metres away, so the visuals have to be larger
// there than for a surface within arm's reach.
const FAR_PLACEMENT_SCALE = 2;
const NEAR_PLACEMENT_SCALE = 1;

// A wall placement stands the object out of the wall, so the menu has to pitch
// back out of the wall plane to stay facing the wearer. It is also raised up the
// wall, along the object's -Z there, to sit behind the object's head as seen.
const WALL_MENU_PITCH = -90; // degrees about X
const DEFAULT_MENU_PITCH = 0;
const WALL_MENU_RAISE = 20; // cm

// Logs how placement goes, and near a surface marks where the depth pass aims
// round the hand and where its hits land.
const SHOW_DEBUG = false;

// The first time the visuals are drawn on device, the GPU compiles their
// shaders, uploads their textures and sets up any shadow pass. For heavier
// content, such as a skinned PBR character, that can be around a second of work
// in a single frame. Later reveals reuse all of it. Drawing the visuals once,
// unseen, while the wearer is still placing moves that freeze away from the
// moment the content appears. The warm-up waits out the first second after lens
// start: on device, textures on a material first drawn that early have
// rendered wrongly.
const WARMUP_DELAY_SECONDS = 1.5;
const WARMUP_FRAMES = 3; // frames the visuals stay up, so the render thread draws them
const WARMUP_SCALE = 0.001; // shrinks 30cm of content to a third of a millimetre
const WARMUP_DISTANCE = 100; // cm in front of the camera, inside the view

@component
export class Example extends BaseScriptComponent {
  @input
  objectVisuals!: SceneObject;

  //the menu holding the reset button, which turns to face the wearer on a wall
  //and is put back above the object each time placement starts
  @input
  menuObj!: SceneObject;

  @input("int")
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("Tabletop", 0),
      new ComboBoxItem("Ground", 1),
      new ComboBoxItem("Wall", 2),
    ]),
  )
  placementSettingMode: number = 0;

  private transform!: Transform;
  //where the menu was authored, which dragging it moves away from
  private menuHome!: vec3;
  //true from a placement result until the next placement starts
  private placed = false;
  //true while this example's placement runs, from its start to its result
  private active = false;
  private started = false;

  private surfacePlacement: SurfacePlacementController =
    SurfacePlacementController.getInstance();

  onAwake() {
    this.transform = this.getSceneObject().getTransform();
    this.menuHome = this.menuObj.getTransform().getLocalPosition();
    this.createEvent("OnStartEvent").bind(this.onStart.bind(this));
    // Placement is one at a time, so with several examples in a scene (a
    // carousel showing one at a time) each stops a placement still running
    // when hidden and places again when shown, as whatever showed it may have
    // moved it.
    this.createEvent("OnEnableEvent").bind(() => {
      if (this.started && !this.active) {
        this.startPlacement();
      }
    });
    this.createEvent("OnDisableEvent").bind(() => {
      if (this.active) {
        this.active = false;
        this.surfacePlacement.stopSurfacePlacement();
      }
    });
  }

  private onStart() {
    this.started = true;
    this.objectVisuals.enabled = false;
    this.startPlacement();
    const warmup = this.createEvent("DelayedCallbackEvent");
    warmup.bind(() => this.warmUpVisuals());
    warmup.reset(WARMUP_DELAY_SECONDS);
  }

  // Draws the visuals for a few frames, shrunk to nothing just in front of the
  // camera, then puts them away at their real size. The root is free to move:
  // every placement sets its pose.
  private warmUpVisuals() {
    if (this.placed) {
      return; //already placed, so the first draw has happened
    }
    const camTrans = WorldCameraFinderProvider.getInstance().getTransform();
    const visualsTrans = this.objectVisuals.getTransform();
    //the size startPlacement chose for this mode
    const realScale = visualsTrans.getLocalScale();
    this.transform.setWorldPosition(
      camTrans
        .getWorldPosition()
        .add(camTrans.forward.uniformScale(-WARMUP_DISTANCE)),
    );
    visualsTrans.setLocalScale(vec3.one().uniformScale(WARMUP_SCALE));
    this.objectVisuals.enabled = true;
    let frames = 0;
    const tick = this.createEvent("UpdateEvent");
    tick.bind(() => {
      if (this.placed) {
        //placed for real meanwhile: leave them shown, back at their real size
        visualsTrans.setLocalScale(realScale);
        this.removeEvent(tick);
        return;
      }
      if (++frames < WARMUP_FRAMES) {
        return;
      }
      this.removeEvent(tick);
      this.objectVisuals.enabled = false;
      visualsTrans.setLocalScale(realScale);
    });
  }

  startPlacement() {
    this.placed = false;
    this.active = true;
    this.objectVisuals.enabled = false;

    let mode = PlacementMode.TABLETOP;
    let visualScale = NEAR_PLACEMENT_SCALE;
    let menuPitch = DEFAULT_MENU_PITCH;
    let menuRaise = 0;
    switch (this.placementSettingMode) {
      case 1:
        mode = PlacementMode.GROUND;
        visualScale = FAR_PLACEMENT_SCALE;
        break;
      case 2:
        mode = PlacementMode.WALL;
        visualScale = FAR_PLACEMENT_SCALE;
        menuPitch = WALL_MENU_PITCH;
        menuRaise = WALL_MENU_RAISE;
        break;
      //0, Tabletop, is the default
    }
    const placementSettings = new PlacementSettings(mode, SHOW_DEBUG);
    this.objectVisuals
      .getTransform()
      .setLocalScale(vec3.one().uniformScale(visualScale));
    const menuTrans = this.menuObj.getTransform();
    //the visuals' scale applies to the menu's position, and the raise is in cm
    menuTrans.setLocalPosition(
      this.menuHome.add(new vec3(0, 0, -menuRaise / visualScale)),
    );
    menuTrans.setLocalRotation(
      quat.fromEulerVec(new vec3(menuPitch * MathUtils.DegToRad, 0, 0)),
    );

    this.surfacePlacement.startSurfacePlacement(
      placementSettings,
      (pos, rot) => {
        this.onSurfaceDetected(pos, rot);
      },
    );
  }

  resetPlacement() {
    this.surfacePlacement.stopSurfacePlacement();
    this.startPlacement();
  }

  private onSurfaceDetected(pos: vec3, rot: quat) {
    this.placed = true;
    this.active = false;
    this.objectVisuals.enabled = true;
    this.transform.setWorldPosition(pos);
    this.transform.setWorldRotation(rot);
  }
}
