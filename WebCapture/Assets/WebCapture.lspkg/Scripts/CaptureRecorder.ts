/**
 * SPECS Inc. 2027
 * Samples the captured objects relative to the capture origin and records keyframe tracks.
 * A keyframe is only stored when an object moved more than the tolerance since its last keyframe,
 * so still objects cost almost nothing and a recording stays a light JSON file.
 */
import {
  CameraPose,
  CaptureObject,
  CaptureParams,
  isoNow,
  makeId,
  MAX_RECORDING_SECONDS,
  PACKAGE_VERSION,
  ParamKey,
  Pose,
  poseDelta,
  PoseTrack,
  Recording,
  RECORDING_FORMAT,
  round,
  sameParams
} from "./WebCaptureProtocol"

/** One captured object, resolved to a SceneObject. */
export interface CaptureEntry {
  object: SceneObject
  desc: CaptureObject
  readParams: () => CaptureParams
}

export interface Tolerance {
  position: number
  rotation: number
  scale: number
}

/** World pose of `obj` relative to `origin`, in cm (Lens Studio world units are cm). */
export function relativePose(obj: SceneObject, origin: SceneObject | null): Pose {
  const t = obj.getTransform()
  let p = t.getWorldPosition()
  let r = t.getWorldRotation()
  let s = t.getWorldScale()
  if (origin) {
    const o = origin.getTransform()
    p = o.getInvertedWorldTransform().multiplyPoint(p)
    r = o.getWorldRotation().invert().multiply(r)
    const os = o.getWorldScale()
    s = new vec3(s.x / (os.x || 1), s.y / (os.y || 1), s.z / (os.z || 1))
  }
  return [
    round(p.x, 2),
    round(p.y, 2),
    round(p.z, 2),
    round(r.x, 4),
    round(r.y, 4),
    round(r.z, 4),
    round(r.w, 4),
    round(s.x, 4),
    round(s.y, 4),
    round(s.z, 4)
  ]
}

export function cameraPose(camera: Camera | null, origin: SceneObject | null): CameraPose | null {
  if (!camera) return null
  let pose: Pose
  try {
    pose = relativePose(camera.getSceneObject(), origin)
  } catch (e) {
    return null // the camera or the capture origin was destroyed
  }
  let fov = 60
  try {
    fov = (camera.fov * 180) / Math.PI
  } catch (e) {
    // orthographic cameras have no fov
  }
  return [pose[0], pose[1], pose[2], pose[3], pose[4], pose[5], pose[6], round(fov, 2)]
}

export class CaptureRecorder {
  private tracks: {[id: string]: PoseTrack} = {}
  private last: {[id: string]: Pose} = {}
  private lastParams: {[id: string]: CaptureParams} = {}
  private params: ParamKey[] = []
  private markers: {t: number; label: string}[] = []
  private camera = {t: [] as number[], v: [] as number[]}
  private lastCamera: CameraPose | null = null
  private objects: CaptureObject[] = []
  private startTime = 0
  private lastSampleTime = -1
  private _active = false
  private _id = ""
  private _name = ""

  constructor(
    private lens: string,
    private rate: number,
    private tolerance: Tolerance,
    private maxSeconds: number
  ) {}

  /** Changes the length limit (the Start / Stop panel's length button), in seconds. */
  setMaxSeconds(seconds: number): void {
    this.maxSeconds = Math.max(5, Math.min(seconds, MAX_RECORDING_SECONDS))
  }

  get active(): boolean {
    return this._active
  }

  get id(): string {
    return this._id
  }

  elapsed(now: number): number {
    return this._active ? now - this.startTime : 0
  }

  start(now: number, name: string): string {
    this.tracks = {}
    this.last = {}
    this.lastParams = {}
    this.params = []
    this.markers = []
    this.camera = {t: [], v: []}
    this.lastCamera = null
    this.objects = []
    this.startTime = now
    this.lastSampleTime = -1
    this._id = makeId("rec")
    this._name =
      name && name.trim().length > 0 ? name.trim() : this.lens + " " + isoNow().substring(0, 19).replace("T", " ")
    this._active = true
    return this._id
  }

  mark(now: number, label: string): void {
    if (this._active) this.markers.push({t: round(now - this.startTime, 3), label: label})
  }

  /**
   * Samples every entry; returns false once the maximum duration is reached (the caller then stops).
   * `force` stores a keyframe for every object (used for the first and the last sample).
   */
  sample(
    now: number,
    entries: CaptureEntry[],
    origin: SceneObject | null,
    camera: Camera | null,
    force: boolean
  ): boolean {
    if (!this._active) return false
    const t = now - this.startTime
    if (!force && this.lastSampleTime >= 0 && t - this.lastSampleTime < 1 / Math.max(1, this.rate)) return true
    this.lastSampleTime = t
    const time = round(t, 3)
    for (const entry of entries) {
      const id = entry.desc.id
      // An object destroyed since the last refresh throws on access: skip it (it keeps its last pose)
      // instead of breaking the UpdateEvent loop. The next refresh drops it from the entries.
      let pose: Pose
      let params: CaptureParams
      try {
        pose = relativePose(entry.object, origin)
        params = entry.readParams()
      } catch (e) {
        continue
      }
      if (!this.tracks[id]) {
        this.tracks[id] = {t: [], v: []}
        this.objects.push(entry.desc)
      }
      const prev = this.last[id]
      let changed = force || !prev
      if (!changed) {
        const d = poseDelta(pose, prev)
        changed = d.p > this.tolerance.position || d.r > this.tolerance.rotation || d.s > this.tolerance.scale
      }
      if (changed) {
        this.tracks[id].t.push(time)
        for (const n of pose) this.tracks[id].v.push(n)
        this.last[id] = pose
      }
      if (!sameParams(params, this.lastParams[id])) {
        this.params.push({t: time, id: id, params: params})
        this.lastParams[id] = params
      }
    }
    const cam = cameraPose(camera, origin)
    if (cam) {
      let changed = force || !this.lastCamera
      if (!changed && this.lastCamera) {
        const d = poseDelta(cam.slice(0, 7).concat([1, 1, 1]), this.lastCamera.slice(0, 7).concat([1, 1, 1]))
        changed =
          d.p > this.tolerance.position || d.r > this.tolerance.rotation || Math.abs(cam[7] - this.lastCamera[7]) > 0.01
      }
      if (changed) {
        this.camera.t.push(time)
        for (const n of cam) this.camera.v.push(n)
        this.lastCamera = cam
      }
    }
    return t < Math.min(this.maxSeconds, MAX_RECORDING_SECONDS)
  }

  /** Ends the recording and returns it. */
  stop(now: number, extra: {lensStudio?: string; device?: string}): Recording {
    this._active = false
    return {
      format: RECORDING_FORMAT,
      meta: {
        id: this._id,
        name: this._name,
        lens: this.lens,
        createdAt: isoNow(),
        rate: this.rate,
        duration: round(Math.max(0, now - this.startTime), 3),
        packageVersion: PACKAGE_VERSION,
        lensStudio: extra.lensStudio,
        device: extra.device,
        tolerance: this.tolerance
      },
      objects: this.objects,
      tracks: this.tracks,
      camera: this.camera,
      params: this.params,
      markers: this.markers
    }
  }
}
