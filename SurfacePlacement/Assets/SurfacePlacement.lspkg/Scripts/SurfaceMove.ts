/**
 * SPECS Inc. 2027
 * Lets the UIKit Frame beside placed content be dragged: the content follows it across the surface
 * it was placed on, turns to face the wearer, and the Frame eases back beside it when let go.
 */
import { Billboard } from "InteractionKit.lspkg/Components/Interaction/Billboard/Billboard";
import { Interactable } from "InteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { InteractableManipulation } from "InteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation";
import { InteractorEvent } from "InteractionKit.lspkg/Core/Interactor/InteractorEvent";
import animate, {
  CancelSet,
} from "InteractionKit.lspkg/Utils/animate";
import { Frame } from "UIKit.lspkg/Scripts/Components/Frame/Frame";

// How quickly the frame turns to face the wearer while dragged: the share of
// the turn left that is made every 33ms, 1 being at once.
const TURN_EASING = 0.3;

// Content whose up is at least this close to the world's stands on a floor or
// table; any steeper and it hangs on a wall.
const LEVEL_MIN_UP_Y = 0.9;

// How long the Frame takes to settle back beside the content once let go.
const SNAP_SECONDS = 0.12;

// Lets a UIKit Frame move a placed object's content across the surface it was
// placed on. Goes on the Frame's own object. The content sits on the surface,
// with its up facing out of it; where each sits in the hierarchy is free.
// The Frame moves itself, freely, as any Frame does. Every frame the content
// follows it across the surface, keeping the offset between them from before
// the first drag, and drops whatever part of the Frame's move takes it off the
// surface: beneath the Frame on a floor or table, behind it on a wall. Let go,
// the Frame eases back to that offset from the content.
// On a floor or table the Frame also turns about the vertical to face the
// wearer while dragged, with InteractionKit's Billboard, about the point pinched so that
// point stays under the hand, and the content turns with it. The Frame's own
// billboarding is left off, since it would tilt the Frame too. On a wall
// neither turns.
@component
export class SurfaceMove extends BaseScriptComponent {
  //what stays on the surface while the frame moves
  @input
  surfaceContent!: SceneObject;

  private frameTrans: Transform = null;
  private contentTrans: Transform = null;
  private billboard: Billboard = null;
  private snapping = new CancelSet();
  // Taken as the first drag starts, when the two are sure to sit as laid out:
  // where the Frame sits from the content, in the content's own axes and scale,
  // and how the content is turned from the Frame. Until then nothing has moved,
  // so the content is left alone.
  private frameInContent: vec3 = null;
  private contentFromFrame: quat = null;
  //how the content is turned in its parent, kept to on a wall
  private contentLocalRot: quat = null;

  onAwake() {
    //the Frame makes its manipulation as it wakes, which may come after this does
    this.createEvent("OnStartEvent").bind(() => this.setUp());
  }

  private setUp() {
    var obj = this.getSceneObject();
    var frame = obj.getComponent(Frame.getTypeName()) as Frame;
    var manipulation = obj.getComponent(
      InteractableManipulation.getTypeName(),
    ) as InteractableManipulation;
    var interactable = obj.getComponent(
      Interactable.getTypeName(),
    ) as Interactable;
    if (frame == null || manipulation == null || interactable == null) {
      print("SurfaceMove on " + obj.name + ": needs a UIKit Frame on the same object");
      return;
    }
    if (this.surfaceContent == null) {
      print("SurfaceMove on " + obj.name + ": needs Surface Content");
      return;
    }
    manipulation.setCanRotate(false);
    manipulation.setCanScale(false);
    this.frameTrans = obj.getTransform();
    this.contentTrans = this.surfaceContent.getTransform();
    this.contentLocalRot = this.contentTrans.getLocalRotation();

    //idle until a drag, so it never turns the frame as placement poses it
    this.billboard = obj.createComponent(Billboard.getTypeName()) as Billboard;
    this.billboard.xAxisEnabled = false;
    this.billboard.yAxisEnabled = false;
    this.billboard.zAxisEnabled = false;
    this.billboard.axisEasing = new vec3(1, TURN_EASING, 1);

    interactable.onTriggerStart.add((e: InteractorEvent) => this.setPivot(e));
    frame.onTranslationStart.add(() => {
      if (this.frameInContent == null) {
        this.takeLayout();
      }
      //caught again while still settling: it settles from wherever this drag ends
      this.snapping.cancel();
      this.billboard.yAxisEnabled = this.isLevel();
    });
    frame.onTranslationEnd.add(() => {
      this.billboard.yAxisEnabled = false;
      this.billboard.resetPivotPoint();
      this.snapBack();
    });
    //after the manipulation and the billboard have moved the frame
    this.createEvent("LateUpdateEvent").bind(() => this.keepOnSurface());
  }

  private takeLayout() {
    var contentRot = this.contentTrans.getWorldRotation();
    var scale = this.contentTrans.getWorldScale();
    var fromContent = contentRot
      .invert()
      .multiplyVec3(
        this.frameTrans
          .getWorldPosition()
          .sub(this.contentTrans.getWorldPosition()),
      );
    this.frameInContent = new vec3(
      fromContent.x / scale.x,
      fromContent.y / scale.y,
      fromContent.z / scale.z,
    );
    this.contentFromFrame = this.frameTrans
      .getWorldRotation()
      .invert()
      .multiply(contentRot);
  }

  //the content's up, which is the surface's
  private surfaceNormal(): vec3 {
    return this.contentTrans.getWorldRotation().multiplyVec3(vec3.up());
  }

  private isLevel(): boolean {
    return this.surfaceNormal().y >= LEVEL_MIN_UP_Y;
  }

  //the Frame's offset from the content, as the content now sits
  private frameOffset(): vec3 {
    return this.contentTrans
      .getWorldRotation()
      .multiplyVec3(this.frameInContent.mult(this.contentTrans.getWorldScale()));
  }

  // The content is kept on the surface, so its own position and up give the
  // surface's plane: it goes where the Frame's offset points back to, dropped
  // onto that plane.
  private keepOnSurface() {
    if (this.frameInContent == null) {
      return;
    }
    if (this.isLevel()) {
      this.contentTrans.setWorldRotation(
        this.frameTrans.getWorldRotation().multiply(this.contentFromFrame),
      );
    } else {
      this.contentTrans.setLocalRotation(this.contentLocalRot);
    }
    var normal = this.surfaceNormal();
    var onSurface = this.contentTrans.getWorldPosition();
    var at = this.frameTrans.getWorldPosition().sub(this.frameOffset());
    var off = at.sub(onSurface).dot(normal);
    this.contentTrans.setWorldPosition(at.sub(normal.uniformScale(off)));
  }

  //back to its offset from the content, which stays put meanwhile
  private snapBack() {
    if (this.frameInContent == null) {
      return;
    }
    var from = this.frameTrans.getWorldPosition();
    var to = this.contentTrans.getWorldPosition().add(this.frameOffset());
    animate({
      duration: SNAP_SECONDS,
      easing: "ease-out-cubic",
      cancelSet: this.snapping,
      update: (t: number) => {
        this.frameTrans.setWorldPosition(vec3.lerp(from, to, t));
      },
    });
  }

  // Turns the frame about the point pinched on it, not on what it holds. Also
  // hands the billboard the drag, which it keeps in step with each turn.
  private setPivot(e: InteractorEvent) {
    var frameObj = this.getSceneObject();
    var hit = e.interactor.targetHitInfo;
    if (e.target.sceneObject !== frameObj || hit == null) {
      return;
    }
    var worldHit = frameObj
      .getTransform()
      .getWorldTransform()
      .multiplyPoint(hit.localHitPosition);
    this.billboard.setPivot(
      this.billboard.targetTransform
        .getInvertedWorldTransform()
        .multiplyPoint(worldHit),
      e.interactor,
    );
  }
}
