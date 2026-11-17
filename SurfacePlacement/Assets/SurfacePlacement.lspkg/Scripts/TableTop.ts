/**
 * SPECS Inc. 2027
 * Tabletop placement: fits a ring round a palm laid flat on a table, measures the table from depth
 * hits around the hand, and places once the hand has held flat and still. In the editor a click
 * stands in for the hand.
 */
import { IK } from "InteractionKit.lspkg/IK";
import {
  dwellCompleteText,
  dwellFillingText,
  RefinePose,
  SurfaceDetector,
} from "../Scripts/SurfaceDetector";
import TrackedHand from "InteractionKit.lspkg/Providers/HandInputData/TrackedHand";

const HAND_OFFSET = 1; //-1 offset in cm from hand to surface

const MOVEMENT_THRESHOLD = 1.5; //movement allowed in cm for calibration to occur
// A hand is taken to be lying flat on a surface when its fingertips and finger
// knuckles (FLAT_JOINTS) lie close to one plane, and that plane is near level.
// Judged on the fingers alone rather than the palm's facing from the wrist: a
// hand laid on the floor is tracked with its wrist lifted, which tipped the
// palm 15-27 degrees while the fingers lay flat. Curled fingers leave the tips
// off the knuckles' plane or tip it steeply, and a hand flat against a wall
// stands it up.
const FLAT_MAX_OFF_PLANE = 2; // cm any of those joints may sit off the plane, along gravity
const FLAT_MAX_SLOPE = 25 * MathUtils.DegToRad; // how far the plane may tip from level
// A hand gone from view this long while calibrating ends it, as moving it
// does, and the visual goes back to the wearer's view; any shorter is taken
// for tracking dropping a frame or two, and the visual holds where it was.
const HAND_LOST_GRACE = 0.25; // seconds
// Turning the hand on the surface this far from how it lay when calibration
// started restarts it, as moving it does. The ring holds the facing calibration
// started with until then, rather than turning with the hand.
const TURN_THRESHOLD = 15 * MathUtils.DegToRad;
const DEFAULT_SCREEN_DISTANCE = 70; // distance in cm from camera to visual when no surface is hit
// Once the hand has settled, calibration fills the loader over this long, then
// holds it full a moment, long enough for the last tick to finish, before
// completing. On device the high-accuracy pass lands its
// first hit 0.2-0.8s after it fires, and refines every 0.2s after that; one not
// in by the end never holds placement up, the hand's estimate is placed on.
const CALIBRATION_FILL_SECONDS = 0.85;
const CALIBRATION_HOLD_SECONDS = 0.15;
const STILL_HISTORY_FRAMES = 22; // thumb-tip positions a hand is judged still over

// The ring surrounds one hand resting on the surface, fitted tightly round its
// fingers. Without a hand it stands square to the wearer as a full circle; once
// one is tracked it opens into a half circle and turns with the hand, its
// opening toward the wrist, the dot field turning with it. Around a hand the
// instruction text sits past the arc's middle, its middle tick, and turns with
// the ring; without one it stands square to the wearer.
const RING_TIP_CLEARANCE = 2; // cm between the hand's outermost joints and the ring
// The smallest circle round the fingers sits up among them, so its lower arc
// cuts in across the base of the thumb. Its centre is moved back toward the
// wrist by this much and the ring re-sized round the same joints from there, so
// it wraps further round the base of the hand.
const RING_WRIST_SHIFT = 1.5; // cm
// The ring's opening is turned off the straight line to the wrist by this much,
// to sit where the forearm meets the hand: positive turns it counterclockwise
// seen from above for the right hand, mirrored for the left, so negative is
// clockwise.
const RING_OPENING_TURN = -15 * MathUtils.DegToRad;
// A hand lying on the surface has the ring moved to where it appears on the
// surface from the eye, see fitRingToHand, by a few cm at most. Never further
// than this: the line of sight down from near eye level is so shallow that it
// ran the ring out across the room.
const SEEN_SHIFT_MAX = 5; // cm
// How quickly the ring opens from a full circle into a half circle when a hand
// is tracked, and closes again, twice as fast, when it is lost.
const RING_OPEN_SPEED = 6;
const RING_CLOSE_SPEED = 12;
// The tick marks round the ring only show on it open: as it closes they shrink
// away, gone by this openness.
const TICK_GROW_FROM = 0.6;
// Each tick shrinks away as the calibration sweep reaches it, taking this long
// and swelling a little first, and pops back as quickly, overshooting a little,
// if the sweep starts over: ease-out-back, run backward and forward.
const TICK_POP_TIME = 0.15; // seconds
const TICK_POP_OVERSHOOT = 1.70158; // ease-out-back's usual, about 10% past full size
// Ticks grow and shrink about where they cross the band's centreline, this far
// from the ring's centre in its own units (HandRing's 0.186 of the 200-unit
// mesh), so they come out of the band and go back into it. A tick shrinking
// about its own middle, outside the band, ends as a blob off the arc's end.
const TICK_ANCHOR_RADIUS = 37.2;
const TICK_MAX_CHANNEL = 0.99; // see updateTicks
// How HandRing lights the arc as calibration fills, so a tick matches the band
// under it: solid, with both ends of the filled span fading over this much of a
// whole turn, or half the span while it is shorter.
const ARC_FADE = 0.03;
// How quickly the visual follows a tracked hand, and the wearer's view without
// one. The ring is sized to the hand rather than padded for lag, so it keeps up
// closely enough that a moving hand does not slide out from inside it.
const HAND_FOLLOW_SPEED = 16;
const VIEW_FOLLOW_SPEED = 8;
// The ring's outer edge per unit of reticle scale: HandRing draws it 0.19 of the
// way across the 200-unit Placement mesh.
const RING_RADIUS_PER_SCALE = 38; // cm
// How far past the edge of the ring the instruction text sits, round from the
// arc's middle, so the text stays outside the ring however large the hand
// makes it.
const TEXT_PAST_RING = 7.3; // cm
// How high the instruction text, and the icon under it, float above the surface
// around a hand.
const TEXT_ABOVE_SURFACE = 10; // cm

// When calibration starts the hand has settled on the surface, and the same
// high-accuracy depth pass the horizontal mode uses measures it, along rays from
// the camera to points round the hand on the surface. The depth is taken to
// leave hands out, so a ray may cross the hand on its way. The points all lie
// beyond the line from the thumb tip to the pinky tip, away from the wrist, so
// none lands on the forearm: past each tip across the hand, past the fingertips,
// and the corners between, each clear of the furthest joint that way. A query is
// fired at the next point as soon as the last answers, taking turns, for as long
// as calibration runs; until it starts no hit tests run at all, and the hand
// drives the visuals.
// Only the surface's height is taken from the hits, since they land round the
// hand and the ring stays centred on it. A hit is only taken if it plausibly is
// that surface, since a ray that misses the table edge lands somewhere else.
// Height is judged along gravity rather than as a distance: a hit lies on the
// viewing ray, so a straight-line limit would tighten or loosen with how
// steeply you look down. Of the hits taken, the surface is the lowest band of
// them that points in two different places agree on: anything sitting on the
// table is higher, and repeat hits at one point always agree with each other.
// Until two points agree it goes by every hit taken, and with none the hand's
// estimate stands.
const REFINE_MAX_HEIGHT_DIFFERENCE = 10; // cm the surface may sit above or below the hand's estimate
const REFINE_MIN_NORMAL_Y = 0.9; // the hit must face up, as a table does (~25 deg)
const REFINE_CLEARANCE = 10; // cm beyond the hand's furthest joint toward each point
const REFINE_AGREE_DISTANCE = 1.5; // cm deep, the band hits have to fall in to agree
// The hits also tell whether the hand is resting on the surface at all, which
// the hand alone cannot: lying flat on a table and held flat in the air look
// the same. Calibration is abandoned, and cannot start again for a moment, if
// the surface the hits agree on lies further below the hand than this, or if
// answers come back and none lands within REFINE_MAX_HEIGHT_DIFFERENCE of it.
// With nothing measured at all, too close for depth or in the editor, the hand
// alone decides.
// The gap allows for hand tracking reading a hand at arm's length, 65-70cm from
// the eye, a steady 5-6cm above the table it rests on.
const RESTING_MAX_GAP = 7; // cm the hand's estimate may sit above the surface the hits agree on
const RESTING_MIN_ANSWERS = 5; // answers, none taken, that show there is no surface near the hand
const RESTING_RETRY_SECONDS = 1.5; // before calibration may start again once abandoned
// The points, in the order they take turns, by how far each turns from straight
// past the fingertips toward the pinky side, negative toward the thumb's.
const REFINE_AIMS = [
  { name: "top", turn: 0 },
  { name: "thumb side", turn: -90 },
  { name: "pinky side", turn: 90 },
  { name: "thumb corner", turn: -45 },
  { name: "pinky corner", turn: 45 },
];

const handText = "Place palm \n flat down \n on a <b>surface</b>";
// Hands are tracked well outside the view, so a hand can be laid on a surface
// below it with nothing there to show it. Once a hand has been tracked out of
// view this long, the instruction asks the wearer to look at it.
const LOOK_HINT_SECONDS = 2;
const lookText = "Look at your \n hand on the \n <b>surface</b>";

//0 at or below from, 1 at or above to, eased between, as in GLSL
function smoothstep(from: number, to: number, x: number): number {
  var t = MathUtils.clamp((x - from) / (to - from), 0, 1);
  return t * t * (3 - 2 * t);
}

// The preview has no tracked hands, so in the editor a click stands in for one
// laid down and held still: placement completes on it straight away. The
// stand-in lies flat this far in front of the camera, along its heading, and
// this far below its height, as a table would be, however the camera is
// pitched, with the ring sized as round a typical hand.
const EDITOR_HAND_DISTANCE = 50; // cm
const EDITOR_HAND_DROP = 20; // cm
const EDITOR_HAND_RADIUS = 9.5; // cm

// The joints the ring has to clear. The palm and wrist leave through the
// opening, so the joints near the wrist are left out.
const RING_JOINTS = [
  "thumbMidJoint",
  "thumbTip",
  "indexKnuckle",
  "indexMidJoint",
  "indexUpperJoint",
  "indexTip",
  "middleKnuckle",
  "middleMidJoint",
  "middleUpperJoint",
  "middleTip",
  "ringKnuckle",
  "ringMidJoint",
  "ringUpperJoint",
  "ringTip",
  "pinkyKnuckle",
  "pinkyMidJoint",
  "pinkyUpperJoint",
  "pinkyTip",
] as const;
const FINGERTIPS = [
  "thumbTip",
  "indexTip",
  "middleTip",
  "ringTip",
  "pinkyTip",
] as const;
//the joints a flat hand has close to one plane, see FLAT_MAX_OFF_PLANE
const FLAT_JOINTS = [
  ...FINGERTIPS,
  "indexKnuckle",
  "middleKnuckle",
  "ringKnuckle",
  "pinkyKnuckle",
] as const;
const WAIT_LOG_INTERVAL = 0.5; // seconds between waiting logs, see showDebug

//debug marker colours, see showDebug
const AIM_MARKER_COLOR = new vec4(1, 0.85, 0, 1); // where the depth pass aims
const HIT_TAKEN_COLOR = new vec4(0, 1, 0.3, 1); // a hit in the band that sets the surface
const HIT_UNUSED_COLOR = new vec4(0.2, 0.6, 1, 1); // a hit taken, but outside that band
const HIT_VETOED_COLOR = new vec4(1, 0.2, 0.2, 1); // a hit rejected as not the surface

//a debug "+", see showDebug, and the world point it marks
type DebugMarker = { obj: SceneObject; text: Text; position: vec3 };

@component
export class TableTop extends SurfaceDetector {
  @input
  instructTextObj!: SceneObject;

  //the dot field round the ring, on a mesh of its own so it can turn with the hand
  @input
  dotsObj!: SceneObject;

  // The tick marks on the ring, one per child, each posed as it should sit on
  // the open half circle: flat in this object's XY plane, the arc's middle up
  // +Y, its ends out along +X and -X, its outer edge 38 from the centre. They
  // grow in as the ring opens and keep their places along the arc as it does,
  // lit as the band under them and tinted by their own colour, and each shrinks
  // away as calibration's sweep reaches it.
  @input
  ticksObj!: SceneObject;

  private rightHand = IK.HandInputData.getHand("right");
  private leftHand = IK.HandInputData.getHand("left");
  private desiredPosition = vec3.zero();
  private desiredRotation = quat.quatIdentity();
  //the hand's surface point when calibration started, what accurate hits are judged against
  private handSurfacePoint = vec3.zero();

  private textTrans = null;
  private instructionText = null;
  private camComp = null;
  //seconds since calibration started, -1 while it is not running
  private calibrationTime = -1;
  //when calibration may start again, after one abandoned as not on a surface, see RESTING_MAX_GAP
  private calibrationBlockedUntil = -1;
  //when the hand went from view while calibrating, -1 while it is in view, see HAND_LOST_GRACE
  private handLostTime = -1;
  //since when a hand has been tracked but out of view, -1 while none is, see LOOK_HINT_SECONDS
  private outOfViewSince = -1;
  private showingLookHint = false;
  private canCalibrate = false;
  private leftPosHistory = [];
  private rightPosHistory = [];
  //only created in the editor, see startSurfaceCalibration
  private tapEvent = null;
  private ringTrans: Transform = null;
  //as authored: the ring standing up facing the wearer, opening down, at its resting size
  private ringBaseScale = vec3.one();
  private ringBaseRotation = quat.quatIdentity();
  private ringPass: Pass = null;
  //0 a full circle, 1 a half circle; eased toward the tracked state each frame
  private ringOpenness = 0;
  private dotsTrans: Transform = null;
  private dotsPass: Pass = null;
  //as authored, with each one's angle round from the arc's middle, positive toward +X
  private ticks: {
    trans: Transform;
    visual: MaterialMeshVisual;
    position: vec3;
    rotation: quat;
    scale: vec3;
    color: vec4;
    angle: number;
    shown: number; //0 gone to 1 shown, at an even pace; eased into its scale
  }[] = [];
  //the hand the ring surrounds, kept until the other hand takes over
  private ringHand: TrackedHand = null;
  //the ring's fit to that hand, from fitRingToHand; world space, flat across the surface
  private ringCentre = vec3.zero();
  private ringOpening = vec3.forward(); //toward the wrist
  //ringOpening as calibration started, which the ring holds while it runs
  private lockedOpening = vec3.forward();
  private ringRadius = 0;
  //where the depth pass measures, one point per REFINE_AIMS, and the one it last fired at
  private refineAims: vec3[] = REFINE_AIMS.map(() => vec3.zero());
  private refineAimIndex = -1;
  // This calibration's hits at each of those points: heights taken, the latest
  // one's if it was taken, and answers rejected or empty.
  private aimHits: {
    taken: number[];
    latest: number;
    rejected: number;
    missed: number;
  }[] = [];
  private lastWaitLogTime = -1;
  // With showDebug on, a "+" at each point the depth pass aims at and one where
  // the latest hit there landed, coloured by whether it was rejected, taken, or
  // in the band that sets the surface; each stays until the next replaces it.
  // One of each per REFINE_AIMS, hung off this object so they go when it does,
  // which moves, so their world positions are re-applied each frame.
  private aimMarkers: DebugMarker[] = [];
  private hitMarkers: DebugMarker[] = [];

  onAwake() {
    super.onAwake();
    this.textTrans = this.instructTextObj.getTransform();
    this.instructionText = this.instructTextObj.getComponent("Text");
    this.camComp = this.cameraTransform.getSceneObject().getComponent("Camera");
    //pools every hit rather than following the newest
    this.refineContinuously = true;
    this.ringTrans = this.circleAnim.getTransform();
    this.ringBaseScale = this.ringTrans.getLocalScale();
    this.ringBaseRotation = this.ringTrans.getLocalRotation();
    this.ringPass = this.circleAnim
      .getSceneObject()
      .getComponent("Component.RenderMeshVisual").mainPass;
    this.dotsTrans = this.dotsObj.getTransform();
    this.dotsPass = this.dotsObj.getComponent(
      "Component.RenderMeshVisual",
    ).mainPass;
    for (var i = 0; i < this.ticksObj.getChildrenCount(); i++) {
      var tick = this.ticksObj.getChild(i);
      var visual: MaterialMeshVisual =
        tick.getComponent("Component.Image") ||
        tick.getComponent("Component.RenderMeshVisual");
      if (visual == null) {
        continue;
      }
      //each lights on its own as the sweep passes, so each needs its own copy
      visual.mainMaterial = visual.mainMaterial.clone();
      var trans = tick.getTransform();
      var position = trans.getLocalPosition();
      this.ticks.push({
        trans: trans,
        visual: visual,
        position: position,
        rotation: trans.getLocalRotation(),
        scale: trans.getLocalScale(),
        color: visual.mainPass.baseColor,
        angle: Math.atan2(position.x, position.y),
        shown: 1,
      });
    }
    //hidden until the ring opens
    this.updateTicks();
  }

  startSurfaceCalibration(callback: (pos: vec3, rot: quat) => void): void {
    this.calibrationTime = -1;
    this.canCalibrate = true;
    this.outOfViewSince = -1;
    this.showingLookHint = false;
    this.ringHand = null;
    this.ringTrans.setLocalScale(this.ringBaseScale);
    this.ringTrans.setLocalRotation(this.ringBaseRotation);
    this.dotsTrans.setLocalScale(this.ringBaseScale);
    this.dotsTrans.setLocalRotation(this.ringBaseRotation);
    this.setRingOpenness(0);
    //showDebug is set after this awakes, so the markers are made here
    if (this.showDebug && this.aimMarkers.length == 0) {
      for (var a = 0; a < REFINE_AIMS.length; a++) {
        this.aimMarkers.push(this.createDebugMarker("RefineAimMarker" + a));
        this.hitMarkers.push(this.createDebugMarker("RefineHitMarker" + a));
      }
    }
    this.aimMarkers
      .concat(this.hitMarkers)
      .forEach((marker) => this.showDebugMarker(marker, null, null));
    super.startSurfaceCalibration(callback);
    // The preview has no tracked hands to rest on a surface, so clicks stand in
    // for one, see onEditorTap. Created only in the editor, and not twice if
    // calibration restarts before it completes.
    if (global.deviceInfoSystem.isEditor() && this.tapEvent == null) {
      this.tapEvent = this.createEvent("TapEvent");
      this.tapEvent.bind(this.onEditorTap.bind(this));
    }
    this.setInstruction(handText);
    this.circleAnim.setLoadingAmount(0);
    this.setCircleColor(false);
  }

  // The next of the points round the hand as it is now, which holds still
  // through calibration. One query is out at a time, and an answer is taken
  // before the next fires, so an answer is always for the point last returned.
  protected getRefineTarget(): vec3 {
    this.refineAimIndex = (this.refineAimIndex + 1) % this.refineAims.length;
    var aim = this.refineAims[this.refineAimIndex];
    this.showDebugMarker(
      this.aimMarkers[this.refineAimIndex],
      aim,
      AIM_MARKER_COLOR,
    );
    return aim;
  }

  protected acceptRefinedPose(pose: RefinePose): boolean {
    var taken =
      pose.ny >= REFINE_MIN_NORMAL_Y &&
      Math.abs(pose.y - this.handSurfacePoint.y) <= REFINE_MAX_HEIGHT_DIFFERENCE;
    var hits = this.aimHits[this.refineAimIndex];
    if (taken) {
      hits.taken.push(pose.y);
    } else {
      hits.rejected++;
    }
    hits.latest = taken ? pose.y : null;
    //coloured once the surface is worked out, if taken
    this.showDebugMarker(
      this.hitMarkers[this.refineAimIndex],
      new vec3(pose.x, pose.y, pose.z),
      taken ? HIT_UNUSED_COLOR : HIT_VETOED_COLOR,
    );
    return taken;
  }

  protected onRefineMiss() {
    this.aimHits[this.refineAimIndex].missed++;
  }

  // Only the height is measured: the hits land round the hand, and the ring
  // stays centred on it. Worked out afresh from every hit taken so far.
  protected applyRefinedPose(pose: RefinePose) {
    var surface = this.findSurface();
    this.desiredPosition = new vec3(
      this.desiredPosition.x,
      surface.height,
      this.desiredPosition.z,
    );
    //only the latest hit at each point is marked
    for (var a = 0; a < this.hitMarkers.length; a++) {
      var latest = this.aimHits[a].latest;
      if (latest != null) {
        this.hitMarkers[a].text.textFill.color =
          latest >= surface.low && latest <= surface.high
            ? HIT_TAKEN_COLOR
            : HIT_UNUSED_COLOR;
      }
    }
  }

  // The surface's height from this calibration's hits: the lowest band
  // REFINE_AGREE_DISTANCE deep holding hits from at least two of the points, at
  // the median of the hits in it. Until two agree, the median of every hit
  // taken, the band spanning them all. Only called once there is a hit taken.
  private findSurface(): {
    height: number;
    low: number;
    high: number;
    hits: number;
    aims: number;
    agreed: boolean;
  } {
    var all: { y: number; aim: number }[] = [];
    for (var a = 0; a < this.aimHits.length; a++) {
      this.aimHits[a].taken.forEach((y) => all.push({ y: y, aim: a }));
    }
    all.sort((p, q) => p.y - q.y);
    const median = (band: { y: number }[]) =>
      band.length % 2 == 1
        ? band[(band.length - 1) / 2].y
        : (band[band.length / 2 - 1].y + band[band.length / 2].y) / 2;
    for (var i = 0; i < all.length; i++) {
      var band = all.filter(
        (p) => p.y >= all[i].y && p.y <= all[i].y + REFINE_AGREE_DISTANCE,
      );
      var aims = new Set(band.map((p) => p.aim)).size;
      if (aims >= 2) {
        return {
          height: median(band),
          low: band[0].y,
          high: band[band.length - 1].y,
          hits: band.length,
          aims: aims,
          agreed: true,
        };
      }
    }
    return {
      height: median(all),
      low: all[0].y,
      high: all[all.length - 1].y,
      hits: all.length,
      aims: new Set(all.map((p) => p.aim)).size,
      agreed: false,
    };
  }

  // With showDebug on, what the depth pass found this calibration, as it
  // completes or is abandoned: what set the surface, against the hand's
  // estimate, and then each point's hits, with the span of the heights taken
  // there. Heights are from the hand's estimate.
  private logSurfaceHits() {
    if (!this.showDebug) {
      return;
    }
    var taken = 0;
    var rejected = 0;
    var missed = 0;
    this.aimHits.forEach((hits) => {
      taken += hits.taken.length;
      rejected += hits.rejected;
      missed += hits.missed;
    });
    const fromHand = (y: number) => {
      var d = y - this.handSurfacePoint.y;
      return (d >= 0 ? "+" : "") + d.toFixed(1) + "cm";
    };
    var outcome = "none taken";
    if (taken > 0) {
      var surface = this.findSurface();
      outcome =
        "surface " +
        fromHand(surface.height) +
        (surface.agreed
          ? ", agreed by " + surface.hits + " hits from " + surface.aims + " points"
          : ", no two points agreed, median of all " + surface.hits);
    }
    var perAim = REFINE_AIMS.map((aim, a) => {
      var hits = this.aimHits[a];
      var line = aim.name + " " + hits.taken.length;
      if (hits.taken.length > 0) {
        line +=
          " at " +
          fromHand(Math.min(...hits.taken)) +
          ".." +
          fromHand(Math.max(...hits.taken));
      }
      if (hits.rejected > 0) line += ", " + hits.rejected + " rejected";
      if (hits.missed > 0) line += ", " + hits.missed + " missed";
      return line;
    });
    this.log(
      "Surface hits: " +
        taken +
        " taken, " +
        rejected +
        " rejected, " +
        missed +
        " missed; " +
        outcome +
        " | " +
        perAim.join(" | "),
    );
  }

  private setInstruction(text: string) {
    this.instructionText.text = text;
  }

  private setCircleColor(isTracking: boolean) {
    var dotColor = isTracking ? vec4.one() : vec4.one().uniformScale(0.25);
    this.dotsPass.dotsColor = dotColor;
  }

  // Opens the ring and the dots together: the ring from a full circle to a half
  // circle, the dots from a full field to one gapped for the wrist and drawn in
  // closer. Kept just inside 0..1 rather than on either end: a parameter sitting
  // exactly on 1.0 or its default has rendered nothing on device.
  private setRingOpenness(openness: number) {
    this.ringOpenness = openness;
    var clamped = MathUtils.clamp(openness, 0.001, 0.999);
    this.ringPass.Opening = clamped;
    this.dotsPass.Opening = clamped;
    this.updateTicks();
  }

  // Poses the tick marks for the ring as it is now, see ticksObj. Each shrinks
  // away once the sweep has reached it. Open, the arc spans a half turn out from its
  // middle, and closed, a whole one, so a tick keeps its place along it by
  // turning its authored angle out by up to as much again; the ones at the ends
  // ride them in. Each is lit as HandRing lights the band under it.
  private updateTicks() {
    var openness = this.ringOpenness;
    var grow = smoothstep(TICK_GROW_FROM, 1, openness);
    var progress: number = this.ringPass.InnerCircleMask;
    var unlit: vec4 = this.ringPass.circleColor;
    var lit: vec4 = this.ringPass.loadedColor;
    var popStep = getDeltaTime() / TICK_POP_TIME;
    for (var i = 0; i < this.ticks.length; i++) {
      var tick = this.ticks[i];
      //how far along the arc it sits: the sweep runs from the -X end over the middle to the +X end
      var along = MathUtils.clamp(0.5 + tick.angle / Math.PI, 0, 1);
      var reached = progress > 0.0001 && progress >= along - 0.0001;
      tick.shown = MathUtils.clamp(
        tick.shown + (reached ? -popStep : popStep),
        0,
        1,
      );
      //ease-out-back: 0 to 1, past 1 on the way
      var t = tick.shown - 1;
      var pop =
        1 + (TICK_POP_OVERSHOOT + 1) * t * t * t + TICK_POP_OVERSHOOT * t * t;
      tick.visual.enabled = grow > 0 && tick.shown > 0;
      if (!tick.visual.enabled) {
        continue;
      }
      //a positive turn about +Z goes from +Y toward -X, against the angle
      var spin = quat.angleAxis(-tick.angle * (1 - openness), vec3.forward());
      var position = spin.multiplyVec3(tick.position);
      var size = grow * pop;
      var anchor = position.normalize().uniformScale(TICK_ANCHOR_RADIUS);
      tick.trans.setLocalPosition(
        anchor.add(position.sub(anchor).uniformScale(size)),
      );
      tick.trans.setLocalRotation(spin.multiply(tick.rotation));
      tick.trans.setLocalScale(tick.scale.uniformScale(size));

      //the sweep spans a whole turn closed and half of one open
      var sweep = 1 - 0.5 * MathUtils.clamp(openness, 0.001, 0.999);
      var fade = Math.max(Math.min(ARC_FADE / sweep, progress * 0.5), 0.0001);
      var filled =
        progress < 0.0001
          ? 0
          : smoothstep(0, fade, along) *
            (1 - smoothstep(progress - fade, progress, along));
      filled = Math.max(filled, smoothstep(0.97, 1, progress));
      var shade = vec4.lerp(unlit, lit, filled);
      // Fading as it shrinks, so it thins out rather than ending as a dot. Kept
      // just under 1: a colour of exactly 1.0 has rendered nothing on device,
      // and the lit tick would otherwise land on it.
      tick.visual.mainPass.baseColor = new vec4(
        Math.min(TICK_MAX_CHANNEL, shade.x * tick.color.x),
        Math.min(TICK_MAX_CHANNEL, shade.y * tick.color.y),
        Math.min(TICK_MAX_CHANNEL, shade.z * tick.color.z),
        Math.min(TICK_MAX_CHANNEL, tick.color.w * Math.min(1, size)),
      );
    }
  }

  // The event only exists in the editor, so reaching here means we are in it.
  // A click lays the stand-in hand down where the camera looks and completes
  // placement on it, the object facing as the ring would have; the outro plays
  // where the visual is.
  private onEditorTap() {
    if (!this.isCalibrationRunning || !this.canCalibrate) {
      return;
    }
    this.placeEditorHand();
    this.desiredPosition = this.ringCentre;
    this.lockedOpening = this.ringOpening;
    this.canCalibrate = false;
    this.startCalibrationComplete();
  }

  // Lays the editor's stand-in hand flat in front of the camera and below it,
  // a hand pointing straight away, its wrist toward the wearer. The opening
  // faces the wearer square on, without the turn a real hand's gets, so the
  // object placed on it faces the camera.
  private placeEditorHand() {
    var eye = this.cameraTransform.getWorldPosition();
    //the camera looks along its -Z
    var look = this.cameraTransform.forward.uniformScale(-1);
    var heading = this.flatten(look);
    if (heading.length < 0.001) {
      //looking straight down the camera's up points ahead, straight up behind
      heading = this.flatten(this.cameraTransform.up).uniformScale(look.y < 0 ? 1 : -1);
    }
    this.ringCentre = eye
      .add(heading.normalize().uniformScale(EDITOR_HAND_DISTANCE))
      .sub(vec3.up().uniformScale(EDITOR_HAND_DROP));
    this.ringRadius = EDITOR_HAND_RADIUS;
    var toWearer = this.flatten(eye.sub(this.ringCentre));
    if (toWearer.length > 0.0001) {
      this.ringOpening = toWearer.normalize();
    }
  }

  //the loader's fill for how long calibration has run, empty while it is not
  private calibrationFill(): number {
    return MathUtils.clamp(this.calibrationTime / CALIBRATION_FILL_SECONDS, 0, 1);
  }

  private startCalibrationComplete() {
    if (this.tapEvent != null) {
      this.removeEvent(this.tapEvent);
      this.tapEvent = null;
    }
    //shown through the outro, as the other modes do
    this.setInstruction(dwellCompleteText);
    this.circleAnim.animateCircleOut(() => {
      super.onCalibrationComplete(() => this.invokeCalibrationComplete());
    });
  }

  // The placed object stands upright facing the way the ring's opening did as
  // calibration ran, back along the hand toward the wrist with RING_OPENING_TURN,
  // so it lines up with the ring rather than with the wearer's head.
  private invokeCalibrationComplete() {
    this.desiredRotation = quat.lookAt(this.lockedOpening, vec3.up());
    if (global.deviceInfoSystem.isEditor()) {
      this.trans.setWorldRotation(this.desiredRotation);
    }
    this.onCompleteCallback(this.desiredPosition, this.desiredRotation);
  }

  private updateHandPosition(hand: TrackedHand) {
    if (hand.isTracked()) {
      if (hand.handType != "right") {
        this.leftPosHistory.push(hand.thumbTip.position);
        if (this.leftPosHistory.length > STILL_HISTORY_FRAMES) {
          this.leftPosHistory.shift();
        }
      } else {
        this.rightPosHistory.push(hand.thumbTip.position);
        if (this.rightPosHistory.length > STILL_HISTORY_FRAMES) {
          this.rightPosHistory.shift();
        }
      }
    }
  }

  private isHandMoving(list: any[]) {
    if (list.length < 2) {
      return true;
    }
    var maxMovement = list[0].distance(list[list.length - 1]);
    return maxMovement > MOVEMENT_THRESHOLD;
  }

  //the same test calibration starts on: lying flat and level enough to rest on a surface
  private isHandFlat(hand: TrackedHand): boolean {
    var flatness = this.measureFlatness(hand);
    return (
      flatness != null &&
      flatness.slope < FLAT_MAX_SLOPE &&
      flatness.offPlane < FLAT_MAX_OFF_PLANE
    );
  }

  // How near the hand is to lying flat, see FLAT_JOINTS: the plane best fitting
  // those joints, as a height over the surface, how far it tips from level, and
  // how far the joint furthest off it sits, along gravity. Null if the joints
  // lie along one line across the surface, which gives no plane.
  private measureFlatness(
    hand: TrackedHand,
  ): { slope: number; offPlane: number; furthest: string } {
    var points = FLAT_JOINTS.map((name) => hand[name].position);
    var mean = vec3.zero();
    points.forEach((p) => (mean = mean.add(p)));
    mean = mean.uniformScale(1 / points.length);
    //least squares for height = a x + b z, about the mean
    var sxx = 0;
    var sxz = 0;
    var szz = 0;
    var sxy = 0;
    var szy = 0;
    points.forEach((p) => {
      var d = p.sub(mean);
      sxx += d.x * d.x;
      sxz += d.x * d.z;
      szz += d.z * d.z;
      sxy += d.x * d.y;
      szy += d.z * d.y;
    });
    var det = sxx * szz - sxz * sxz;
    if (Math.abs(det) < 0.0001) {
      return null;
    }
    var a = (sxy * szz - sxz * szy) / det;
    var b = (sxx * szy - sxz * sxy) / det;
    var offPlane = 0;
    var furthest: string = FLAT_JOINTS[0];
    points.forEach((p, i) => {
      var d = p.sub(mean);
      var off = Math.abs(d.y - (a * d.x + b * d.z));
      if (off > offPlane) {
        offPlane = off;
        furthest = FLAT_JOINTS[i];
      }
    });
    return {
      slope: Math.atan(Math.sqrt(a * a + b * b)),
      offPlane: offPlane,
      furthest: furthest,
    };
  }

  //on the hand the ring surrounds: flat, still, and not turned since it started
  private updateCalibration(hand: TrackedHand) {
    var history =
      hand == this.leftHand ? this.leftPosHistory : this.rightPosHistory;
    var isStill = !this.isHandMoving(history);

    //turned on the surface since calibration started, see TURN_THRESHOLD
    var isTurned =
      this.calibrationTime >= 0 &&
      this.ringOpening.angleTo(this.lockedOpening) > TURN_THRESHOLD;

    //once abandoned as not on a surface, it holds off a moment before starting again
    var mayRun =
      this.calibrationTime >= 0 || getTime() >= this.calibrationBlockedUntil;

    //check for calibration:
    if (this.isHandFlat(hand) && isStill && !isTurned && mayRun) {
      if (this.calibrationTime < 0) {
        //calibration starts: measure the surface where the hand pose has it
        const p = this.desiredPosition;
        this.handSurfacePoint = new vec3(p.x, p.y, p.z);
        this.lockedOpening = this.ringOpening;
        this.aimHits = REFINE_AIMS.map(() => ({
          taken: [],
          latest: null,
          rejected: 0,
          missed: 0,
        }));
        //the first query goes to the first point
        this.refineAimIndex = -1;
        this.logCalibrationWait(hand, true);
        this.startRefine();
        this.setInstruction(dwellFillingText);
        this.calibrationTime = 0;
      }
      this.calibrationTime += getDeltaTime();
      //take any accurate hit that has landed; it never extends the wait
      this.tickRefine();
      var finished =
        this.calibrationTime >=
        CALIBRATION_FILL_SECONDS + CALIBRATION_HOLD_SECONDS;
      var offSurface = this.whyNotOnSurface(finished);
      if (offSurface != null) {
        this.abandonCalibration(offSurface);
      } else if (finished) {
        this.logRefineOutcome();
        if (this.isRefining()) {
          this.logSurfaceHits();
        }
        this.canCalibrate = false;
        this.startCalibrationComplete();
      }
    } else {
      if (this.calibrationTime >= 0) {
        //the hand moved off the point being measured, so that result is void
        this.cancelRefine();
        this.setInstruction(handText);
      }
      this.calibrationTime = -1;
    }
    this.circleAnim.setLoadingAmount(this.calibrationFill());
  }

  // Why the hits so far show the hand is not resting on a surface, see
  // RESTING_MAX_GAP, or null if they do not. Until the points agree the gap is
  // left until calibration has finished, when it goes by every hit taken.
  // Nothing to go by without the high-accuracy pass running.
  private whyNotOnSurface(finished: boolean): string {
    if (!this.isRefining()) {
      return null;
    }
    var taken = 0;
    var answered = 0;
    this.aimHits.forEach((hits) => {
      taken += hits.taken.length;
      answered += hits.taken.length + hits.rejected + hits.missed;
    });
    if (taken == 0) {
      return answered >= RESTING_MIN_ANSWERS || (finished && answered > 0)
        ? "no surface within " +
            REFINE_MAX_HEIGHT_DIFFERENCE +
            "cm of the hand, " +
            answered +
            " answers"
        : null;
    }
    var surface = this.findSurface();
    if (!surface.agreed && !finished) {
      return null;
    }
    var gap = this.handSurfacePoint.y - surface.height;
    return gap > RESTING_MAX_GAP
      ? "hand " + gap.toFixed(1) + "cm above the surface the depth found"
      : null;
  }

  //back to waiting for a hand on a surface, which is what the instruction asks for
  private abandonCalibration(reason: string) {
    this.log(
      "Calibration abandoned: " +
        reason +
        ", hand " +
        this.eyeDistance(this.handSurfacePoint).toFixed(0) +
        "cm from the eye",
    );
    this.logSurfaceHits();
    this.cancelRefine();
    this.calibrationTime = -1;
    this.calibrationBlockedUntil = getTime() + RESTING_RETRY_SECONDS;
    this.setInstruction(handText);
  }

  protected update() {
    super.update();
    if (!this.canCalibrate) {
      return;
    }

    var camPos = this.cameraTransform.getWorldPosition();

    var textPos = new vec3(0, 4.5, 1);
    var textRot = quat.quatIdentity();

    var rightHandValid =
      this.rightHand.isTracked() &&
      this.camComp.isSphereVisible(this.rightHand.thumbTip.position, 2);

    var leftHandValid =
      this.leftHand.isTracked() &&
      this.camComp.isSphereVisible(this.leftHand.thumbTip.position, 2);

    var showsHand = rightHandValid || leftHandValid;
    this.updateLookHint(showsHand);

    //set UI instructions base on hand tracking state
    textRot = showsHand
      ? quat.fromEulerVec(new vec3(Math.PI / 4, 0, 0))
      : quat.quatIdentity();

    this.setCircleColor(showsHand);

    //keep track of hand positions
    if (leftHandValid) this.updateHandPosition(this.leftHand);
    if (rightHandValid) this.updateHandPosition(this.rightHand);

    //the ring surrounds one hand, and calibrates on that hand alone
    var hand = this.pickRingHand(leftHandValid, rightHandValid);
    if (hand != null && hand != this.ringHand) {
      if (this.calibrationTime >= 0) {
        //the ring is leaving the point being measured, so that result is void
        this.cancelRefine();
        this.calibrationTime = -1;
        this.setInstruction(handText);
      }
      this.ringHand = hand;
    }
    //before the pose is set, so the visual heads back to the view this frame
    if (hand == null && this.calibrationTime >= 0) {
      if (this.handLostTime < 0) {
        this.handLostTime = getTime();
      } else if (getTime() - this.handLostTime >= HAND_LOST_GRACE) {
        this.log("Calibration abandoned: hand left the view");
        this.cancelRefine();
        this.calibrationTime = -1;
            this.setInstruction(handText);
        this.circleAnim.setLoadingAmount(0);
      }
    } else {
      this.handLostTime = -1;
    }

    if (showsHand) {
      this.fitRingToHand(hand);

      // The hand drives the pose until calibration starts. From then the pose
      // belongs to the high-accuracy pass: the hand is still by then, and its
      // estimate would fight the measured surface. Without a measurement (in
      // the editor, too close for depth, or no high-accuracy runtime) nothing
      // is refining and the hand keeps driving to the end.
      if (!this.isRefining()) {
        this.desiredPosition = this.ringCentre;
        //gravity aligned and facing the way the head does
        var handForward = this.cameraTransform.right
          .cross(vec3.up())
          .normalize();
        this.desiredRotation = quat
          .lookAt(handForward, vec3.up())
          .multiply(quat.fromEulerVec(new vec3(-Math.PI / 2, 0, 0)));
      }

      //move text up, past the far edge of the ring as it is now
      var drawnRadius = this.ringTrans.getLocalScale().x * RING_RADIUS_PER_SCALE;
      textPos = new vec3(0, drawnRadius + TEXT_PAST_RING, TEXT_ABOVE_SURFACE);
      // Round to the arc's middle, where its middle tick is, and turned with the
      // ring as it is now: the ring faces its opening along its +Z, and the
      // middle lies the other way. The visual lies flat here, its +Z up.
      var opening = this.ringTrans
        .getLocalRotation()
        .multiplyVec3(vec3.forward());
      var spin = quat.angleAxis(
        Math.atan2(opening.x, -opening.y),
        vec3.forward(),
      );
      textPos = spin.multiplyVec3(textPos);
      textRot = spin.multiply(textRot);
    } else if (!this.isRefining()) {
      //position UI in front of camera; a refining pose holds through a tracking dropout
      this.desiredPosition = camPos.add(
        this.cameraTransform.forward.uniformScale(-DEFAULT_SCREEN_DISTANCE),
      );
      this.desiredRotation = quat.lookAt(
        this.cameraTransform.forward,
        vec3.up(),
      );
    }

    //check calibration status
    if (hand != null) {
      this.updateCalibration(hand);
    }

    // Interpolate UI. Each step is capped at the whole way: on a long frame it
    // would overshoot, and past twice the way each frame overshoots further than
    // the last, so the visual runs away (the preview drops to a few fps).
    var textEase = Math.min(1, getDeltaTime() * VIEW_FOLLOW_SPEED);
    this.textTrans.setLocalPosition(
      vec3.lerp(this.textTrans.getLocalPosition(), textPos, textEase),
    );
    this.textTrans.setLocalRotation(
      quat.slerp(this.textTrans.getLocalRotation(), textRot, textEase),
    );
    //set parent transform
    var follow = Math.min(
      1,
      getDeltaTime() * (showsHand ? HAND_FOLLOW_SPEED : VIEW_FOLLOW_SPEED),
    );
    this.trans.setWorldPosition(
      vec3.lerp(this.trans.getWorldPosition(), this.desiredPosition, follow),
    );
    this.trans.setWorldRotation(
      quat.slerp(this.trans.getWorldRotation(), this.desiredRotation, follow),
    );
    this.updateRing(showsHand);
    if (
      hand != null &&
      this.calibrationTime < 0 &&
      getTime() - this.lastWaitLogTime >= WAIT_LOG_INTERVAL
    ) {
      this.lastWaitLogTime = getTime();
      this.logCalibrationWait(hand);
    }
    this.aimMarkers
      .concat(this.hitMarkers)
      .forEach((marker) => this.placeDebugMarker(marker));
  }

  // A "+" in the instruction text's font at twice its size, hidden until there is
  // something to mark. Centred on its own position: the instruction text sits at
  // the bottom of its layout box, which drew the "+" well below the point.
  private createDebugMarker(name: string): DebugMarker {
    var obj = global.scene.createSceneObject(name);
    obj.setParent(this.getSceneObject());
    var text = obj.copyComponent(this.instructionText);
    text.text = "+";
    text.layoutRect = Rect.create(-10, 10, -10, 10);
    text.verticalAlignment = VerticalAlignment.Center;
    text.horizontalAlignment = HorizontalAlignment.Center;
    text.debugRenderLayoutRect = false;
    obj
      .getTransform()
      .setLocalScale(this.textTrans.getLocalScale().uniformScale(2));
    obj.enabled = false;
    return { obj: obj, text: text, position: vec3.zero() };
  }

  //position null hides the marker; there are none at all with showDebug off
  private showDebugMarker(marker: DebugMarker, position: vec3, color: vec4) {
    if (marker == null) {
      return;
    }
    marker.obj.enabled = position != null;
    if (position == null) {
      return;
    }
    marker.position = new vec3(position.x, position.y, position.z);
    marker.text.textFill.color = color;
  }

  //at its world position, turned to face the eye: Text faces along its +Z
  private placeDebugMarker(marker: DebugMarker) {
    if (!marker.obj.enabled) {
      return;
    }
    var trans = marker.obj.getTransform();
    trans.setWorldPosition(marker.position);
    var toEye = this.cameraTransform.getWorldPosition().sub(marker.position);
    trans.setWorldRotation(quat.lookAt(toEye.normalize(), vec3.up()));
  }

  // Asks the wearer to look at their hand once one has been tracked out of view
  // for LOOK_HINT_SECONDS, and back to the usual instruction once one is in view.
  // Only while calibration is not running, so it never replaces its progress.
  private updateLookHint(showsHand: boolean) {
    var trackedOutOfView =
      !showsHand && (this.leftHand.isTracked() || this.rightHand.isTracked());
    if (!trackedOutOfView) {
      this.outOfViewSince = -1;
    } else if (this.outOfViewSince < 0) {
      this.outOfViewSince = getTime();
    }
    var hint =
      this.outOfViewSince >= 0 &&
      getTime() - this.outOfViewSince >= LOOK_HINT_SECONDS;
    if (hint != this.showingLookHint && this.calibrationTime < 0) {
      this.showingLookHint = hint;
      this.setInstruction(hint ? lookText : handText);
    }
  }

  //the hand already surrounded while it stays in view, otherwise whichever is, the right if both
  private pickRingHand(leftValid: boolean, rightValid: boolean): TrackedHand {
    if (this.ringHand == this.leftHand && leftValid) return this.leftHand;
    if (this.ringHand == this.rightHand && rightValid) return this.rightHand;
    if (rightValid) return this.rightHand;
    return leftValid ? this.leftHand : null;
  }

  // Fits the ring to the hand in the hand's own frame, so its size is the
  // hand's and stays put however the hand is turned: only spreading the fingers
  // changes it. The smallest circle holding the fingers and thumb, laid out flat
  // in the palm's plane from the wrist, is moved back toward the wrist by
  // RING_WRIST_SHIFT and sized round the same joints from there, clear of them
  // by RING_TIP_CLEARANCE, with the opening turned toward the wrist.
  // Where the ring goes allows for the angle it is seen from. The ring lies on
  // the surface but the hand stands up off it, so the centre is taken where it
  // appears on the surface along the line of sight, at the joints' average
  // height. Only the centre: sizing round each joint where it appears made the
  // size swing with the hand's turn relative to the eye. Only a hand lying flat,
  // too: one held up has no surface under it to be seen on, so the ring stays
  // right under it. Also places the depth pass's points round the hand.
  private fitRingToHand(hand: TrackedHand) {
    // Once the hand lies flat, the surface is where the lowest fingertip rests;
    // until then there is no surface to go by, so the ring sits under the
    // lowest point of the whole hand. Either way set slightly lower for hand
    // thickness. Not the thumb and index alone: they lift as the hand tips,
    // which floated the ring above the other fingers.
    var flat = this.isHandFlat(hand);
    var lowest = flat
      ? FINGERTIPS.map((name) => hand[name].position)
      : hand.points.map((point) => point.position);
    var height = Math.min(...lowest.map((p) => p.y)) - HAND_OFFSET;
    var eye = this.cameraTransform.getWorldPosition();
    const seen = (point: vec3) =>
      flat
        ? this.seenOnSurface(point, eye, height)
        : new vec2(point.x, point.z);

    // The hand's frame: from the wrist, forward toward the middle knuckle and
    // across the palm, both in the palm's plane.
    var wrist = hand.wrist.position;
    var palmNormal = hand.indexKnuckle.position
      .sub(wrist)
      .cross(hand.pinkyKnuckle.position.sub(wrist))
      .normalize();
    var toKnuckle = hand.middleKnuckle.position.sub(wrist);
    var forward = toKnuckle
      .sub(palmNormal.uniformScale(toKnuckle.dot(palmNormal)))
      .normalize();
    var across = palmNormal.cross(forward);
    var joints: vec2[] = [];
    var jointHeight = 0;
    for (var i = 0; i < RING_JOINTS.length; i++) {
      var position = hand[RING_JOINTS[i]].position;
      var offset = position.sub(wrist);
      joints.push(new vec2(offset.dot(forward), offset.dot(across)));
      jointHeight += position.y / RING_JOINTS.length;
    }

    //the wrist is the frame's origin, so back toward it is back toward zero
    var centre = this.enclosingCircle(joints).centre;
    if (centre.length > RING_WRIST_SHIFT) {
      centre = centre.sub(centre.normalize().uniformScale(RING_WRIST_SHIFT));
    }
    //sized from the moved centre, so whichever joint is now furthest sets it
    var furthest = 0;
    for (var j = 0; j < joints.length; j++) {
      furthest = Math.max(furthest, joints[j].distance(centre));
    }
    this.ringRadius = furthest + RING_TIP_CLEARANCE;

    var inWorld = wrist
      .add(forward.uniformScale(centre.x))
      .add(across.uniformScale(centre.y));
    var seenCentre = seen(new vec3(inWorld.x, jointHeight, inWorld.z));
    this.ringCentre = new vec3(seenCentre.x, height, seenCentre.y);
    var toWrist = this.flatten(
      forward.uniformScale(-centre.x).add(across.uniformScale(-centre.y)),
    );
    if (toWrist.length > 0.0001) {
      //a positive turn about up is counterclockwise seen from above
      var turn =
        hand.handType == "right" ? RING_OPENING_TURN : -RING_OPENING_TURN;
      this.ringOpening = quat
        .angleAxis(turn, vec3.up())
        .multiplyVec3(toWrist.normalize());
    }

    // The depth pass's points, see REFINE_AIMS, judged on the joints where they
    // appear, as the ring is. Turned from straight past the fingertips, square
    // to the line from the thumb tip to the pinky tip and away from the wrist,
    // and each out from the middle of that line past the furthest joint that way.
    var seenJoints = RING_JOINTS.map((name) => seen(hand[name].position));
    var thumbTip = seenJoints[RING_JOINTS.indexOf("thumbTip")];
    var pinkyTip = seenJoints[RING_JOINTS.indexOf("pinkyTip")];
    var thumbToPinky = pinkyTip.sub(thumbTip);
    //tips on top of each other give no line; the last points stand
    if (thumbToPinky.length < 0.0001) {
      return;
    }
    thumbToPinky = thumbToPinky.normalize();
    var tipsMiddle = thumbTip.add(pinkyTip).uniformScale(0.5);
    var pastTips = new vec2(-thumbToPinky.y, thumbToPinky.x);
    if (pastTips.dot(tipsMiddle.sub(seen(wrist))) < 0) {
      pastTips = pastTips.uniformScale(-1);
    }
    this.refineAims = REFINE_AIMS.map((aim) => {
      var turn = aim.turn * MathUtils.DegToRad;
      var way = pastTips
        .uniformScale(Math.cos(turn))
        .add(thumbToPinky.uniformScale(Math.sin(turn)));
      var reach = 0;
      for (var k = 0; k < seenJoints.length; k++) {
        reach = Math.max(reach, seenJoints[k].sub(tipsMiddle).dot(way));
      }
      var point = tipsMiddle.add(way.uniformScale(reach + REFINE_CLEARANCE));
      return new vec3(point.x, height, point.y);
    });
  }

  // Where a point appears on the surface at height, along the line of sight from
  // the eye, as x and z, moved no further than SEEN_SHIFT_MAX from where it is.
  // Anything at or above eye level has no line down to it, so it is taken where
  // it is.
  private seenOnSurface(point: vec3, eye: vec3, height: number): vec2 {
    var at = new vec2(point.x, point.z);
    var drop = eye.y - point.y;
    if (drop < 1) {
      return at;
    }
    var t = (eye.y - height) / drop;
    var shift = new vec2(point.x - eye.x, point.z - eye.z).uniformScale(t - 1);
    if (shift.length > SEEN_SHIFT_MAX) {
      shift = shift.normalize().uniformScale(SEEN_SHIFT_MAX);
    }
    return at.add(shift);
  }

  // The smallest circle holding every point, built up a point at a time: each
  // point found outside the circle so far must lie on the edge of the new one,
  // so the circle is rebuilt through it (Welzl's algorithm, unrolled).
  private enclosingCircle(points: vec2[]): { centre: vec2; radius: number } {
    var centre = points[0];
    var radius = 0;
    //a hair of slack, so the points defining the circle count as inside it
    const inside = (p: vec2) => p.distance(centre) <= radius + 0.001;
    for (var i = 1; i < points.length; i++) {
      if (inside(points[i])) continue;
      centre = points[i];
      radius = 0;
      for (var j = 0; j < i; j++) {
        if (inside(points[j])) continue;
        centre = points[i].add(points[j]).uniformScale(0.5);
        radius = points[i].distance(points[j]) * 0.5;
        for (var k = 0; k < j; k++) {
          if (inside(points[k])) continue;
          var circle = this.circleThrough(points[i], points[j], points[k]);
          centre = circle.centre;
          radius = circle.radius;
        }
      }
    }
    return { centre: centre, radius: radius };
  }

  // The circle through three points. Three in a line have none, and the smallest
  // circle holding them spans the two furthest apart.
  private circleThrough(
    a: vec2,
    b: vec2,
    c: vec2,
  ): { centre: vec2; radius: number } {
    var d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
    if (Math.abs(d) < 0.0001) {
      var pairs = [
        [a, b],
        [b, c],
        [a, c],
      ];
      var widest = pairs[0];
      for (var i = 1; i < pairs.length; i++) {
        if (pairs[i][0].distance(pairs[i][1]) > widest[0].distance(widest[1])) {
          widest = pairs[i];
        }
      }
      return {
        centre: widest[0].add(widest[1]).uniformScale(0.5),
        radius: widest[0].distance(widest[1]) * 0.5,
      };
    }
    var a2 = a.x * a.x + a.y * a.y;
    var b2 = b.x * b.x + b.y * b.y;
    var c2 = c.x * c.x + c.y * c.y;
    var centre = new vec2(
      (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d,
      (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d,
    );
    return { centre: centre, radius: centre.distance(a) };
  }

  // Eases the ring and the dots onto their fit to the hand, like the rest of the
  // visual: both sized to the fit, opened across the bottom, the ring into a
  // half circle and the dots a little past it, and turned together with their
  // openings toward the wrist, held where they were while calibration runs (see
  // TURN_THRESHOLD). Without a hand they settle back to their authored
  // pose, standing square to the wearer and closed into full circles, unless a
  // refining pose is holding through a tracking dropout. Runs after the parent
  // has moved, since the turn is worked out against the parent's current facing.
  private updateRing(hasHand: boolean) {
    var rotation = this.ringTrans.getLocalRotation();
    var scale = this.ringTrans.getLocalScale();
    var openness = this.ringOpenness;
    if (hasHand) {
      //the opening faces along the mesh's +Z, and lookAt with up keeps the ring flat
      var parentRotation = this.ringTrans
        .getSceneObject()
        .getParent()
        .getTransform()
        .getWorldRotation();
      rotation = parentRotation
        .invert()
        .multiply(
          quat.lookAt(
            this.calibrationTime >= 0 ? this.lockedOpening : this.ringOpening,
            vec3.up(),
          ),
        );
      scale = vec3.one().uniformScale(this.ringRadius / RING_RADIUS_PER_SCALE);
      openness = 1;
    } else if (!this.isRefining()) {
      rotation = this.ringBaseRotation;
      scale = this.ringBaseScale;
      openness = 0;
    }
    //capped at the whole way, like the parent's follow
    var t = Math.min(
      1,
      getDeltaTime() * (hasHand ? HAND_FOLLOW_SPEED : VIEW_FOLLOW_SPEED),
    );
    var eased = vec3.lerp(this.ringTrans.getLocalScale(), scale, t);
    var turned = quat.slerp(this.ringTrans.getLocalRotation(), rotation, t);
    this.ringTrans.setLocalScale(eased);
    this.ringTrans.setLocalRotation(turned);
    this.dotsTrans.setLocalScale(eased);
    this.dotsTrans.setLocalRotation(turned);
    var openSpeed =
      openness > this.ringOpenness ? RING_OPEN_SPEED : RING_CLOSE_SPEED;
    this.setRingOpenness(
      MathUtils.lerp(
        this.ringOpenness,
        openness,
        Math.min(1, getDeltaTime() * openSpeed),
      ),
    );
  }

  // With showDebug on, while a hand is in view but calibration has not
  // started, how it measures against each check updateCalibration holds it to,
  // with the limit after each. A hand the tracker has picked up wrongly,
  // floating above the table and tilted, shows here as a tipped plane. Printed
  // once, too, as calibration starts, to show what was taken as flat.
  private logCalibrationWait(hand: TrackedHand, starting: boolean = false) {
    if (!this.showDebug) {
      return;
    }
    var flatness = this.measureFlatness(hand);
    var history =
      hand == this.leftHand ? this.leftPosHistory : this.rightPosHistory;
    var moved =
      history.length < 2 ? 0 : history[0].distance(history[history.length - 1]);
    this.log(
      (starting ? "Calibration started (" : "Calibration waiting (") +
        hand.handType +
        ", " +
        this.eyeDistance(this.ringCentre).toFixed(0) +
        "cm from the eye): " +
        (flatness == null
          ? "fingers give no plane"
          : "fingers' plane tilted " +
            (flatness.slope * MathUtils.RadToDeg).toFixed(0) +
            "deg (under " +
            (FLAT_MAX_SLOPE * MathUtils.RadToDeg).toFixed(0) +
            "), " +
            flatness.furthest +
            " furthest off it at " +
            flatness.offPlane.toFixed(1) +
            "cm (under " +
            FLAT_MAX_OFF_PLANE +
            ")") +
        ", thumb moved " +
        moved.toFixed(1) +
        "cm (under " +
        MOVEMENT_THRESHOLD +
        ")",
    );
  }

  //straight-line distance from the camera, for the debug logs
  private eyeDistance(point: vec3): number {
    return this.cameraTransform.getWorldPosition().distance(point);
  }

  //across the surface only, so heights in the hand don't count toward the ring
  private flatten(v: vec3): vec3 {
    return new vec3(v.x, 0, v.z);
  }
}
