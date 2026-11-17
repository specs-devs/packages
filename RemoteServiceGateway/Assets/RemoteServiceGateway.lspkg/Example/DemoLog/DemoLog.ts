/**
 * SPECS Inc. 2027
 * Demo scaffolding for the RemoteServiceGateway examples: runs the example(s) of the carousel step
 * the user lands on by themselves, one call after the other, stops them when the step is left, and
 * shows a live log panel ("OpenAI chat -> request sent", "<- ok in 1.8 s: ...", "x ... 404 ...")
 * above the example content.
 *
 * Example components call `DemoStep.join(...)` in `onAwake`. Every example enabled in the same frame
 * (one carousel step) forms one run, ordered by `order`. Disabling an example (leaving the step)
 * calls its `stop()` and invalidates the run, so late responses of the old step are ignored.
 */
import {RoundedRectangle, RoundedRectBlendMode} from "UIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import {AvaliableApiTypes, RemoteServiceGatewayCredentials} from "../../RemoteServiceGatewayCredentials"

const MAX_LINES = 8
const LINE_CHARS = 78
const PANEL_WIDTH = 44
const PANEL_PADDING = 1
const HEADER_HEIGHT = 1.8
const BODY_HEIGHT = 10.5
const PANEL_HEIGHT = PANEL_PADDING * 2 + HEADER_HEIGHT + BODY_HEIGHT
const HEADER_SIZE = 50
const BODY_SIZE = 46
// Text sits in front of the background: separate layers, no z-fighting.
const TEXT_Z = 0.3
const RENDER_ORDER = 40
const BACKGROUND = new vec4(0.03, 0.04, 0.06, 0.95)
const BORDER = new vec4(0.38, 0.65, 0.98, 1)
const BORDER_ERROR = new vec4(0.94, 0.27, 0.27, 1)
const TEXT = new vec4(0.92, 0.94, 0.97, 1)
const UNSET_TOKEN = /^\s*$|^\[INSERT/i

const TOKEN_INPUT: {[type: string]: string} = {
  [AvaliableApiTypes.Snap]: "snapToken",
  [AvaliableApiTypes.OpenAI]: "openAIToken",
  [AvaliableApiTypes.Google]: "googleToken",
}

/** Thrown inside a demo once its step was left. The runner swallows it. */
export class DemoCancelled extends Error {
  constructor() {
    super("demo step left")
  }
}

/** Whether the token for `type` is empty or still the `[INSERT ...]` placeholder. */
export function isTokenMissing(type: AvaliableApiTypes): boolean {
  return UNSET_TOKEN.test(RemoteServiceGatewayCredentials.getApiToken(type) || "")
}

/** Readable text for a rejection: Error message, JSON `{error:{code,message}}` bodies, or the raw value. */
export function errorText(error: unknown): string {
  let text: string
  if (error instanceof Error) {
    text = error.message
  } else if (typeof error === "string") {
    text = error
  } else {
    try {
      text = JSON.stringify(error)
    } catch (e) {
      text = "" + error
    }
  }
  try {
    const parsed = JSON.parse(text)
    const details = parsed && (parsed.error || parsed)
    if (details && typeof details === "object" && (details.message || details.code || details.status)) {
      const code = details.code || details.status
      return (code ? code + " " : "") + (details.message || "")
    }
  } catch (e) {
    // Not JSON: keep the text as is.
  }
  if (!text || !text.trim() || text === "{}") {
    const kind = error === null ? "null" : error === undefined ? "undefined" : (error as any)?.constructor?.name || typeof error
    return "no error details (" + kind + "); usually the gateway or network was not ready yet"
  }
  return text
}

function clip(text: string, length: number = LINE_CHARS): string {
  const flat = ("" + text).replace(/\s+/g, " ").trim()
  return flat.length > length ? flat.substring(0, length - 1) + "…" : flat
}

/** The log panel: a rounded background with a header line and the last few log lines. */
export class DemoLogPanel {
  private root: SceneObject
  private header: Text
  private body: Text
  private background: RoundedRectangle

  constructor(parent: SceneObject, offset: vec3) {
    this.root = DemoLogPanel.createChild(parent, "DemoLogPanel", offset)
    const backgroundObject = DemoLogPanel.createChild(this.root, "Background", vec3.zero())
    this.background = backgroundObject.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
    this.background.size = new vec2(PANEL_WIDTH, PANEL_HEIGHT)
    this.background.cornerRadius = 1
    this.background.blendMode = RoundedRectBlendMode.Normal
    this.background.backgroundColor = BACKGROUND
    this.background.border = true
    this.background.borderSize = 0.25
    this.background.borderColor = BORDER
    this.background.renderOrder = RENDER_ORDER

    const innerWidth = PANEL_WIDTH - PANEL_PADDING * 2
    const top = PANEL_HEIGHT / 2 - PANEL_PADDING
    this.header = this.createText("Header", new vec3(0, top - HEADER_HEIGHT / 2, TEXT_Z), HEADER_SIZE, innerWidth, HEADER_HEIGHT)
    this.body = this.createText("Lines", new vec3(0, top - HEADER_HEIGHT - BODY_HEIGHT / 2, TEXT_Z), BODY_SIZE, innerWidth, BODY_HEIGHT)
  }

  show(title: string, lines: string[], error: boolean): void {
    this.header.text = title
    this.body.text = lines.join("\n")
    this.background.borderColor = error ? BORDER_ERROR : BORDER
  }

  private createText(name: string, position: vec3, size: number, width: number, height: number): Text {
    const text = DemoLogPanel.createChild(this.root, name, position).createComponent("Component.Text")
    text.size = size
    text.textFill.color = TEXT
    text.horizontalAlignment = HorizontalAlignment.Left
    text.verticalAlignment = VerticalAlignment.Top
    text.horizontalOverflow = HorizontalOverflow.Truncate
    text.verticalOverflow = VerticalOverflow.Shrink
    text.layoutRect = Rect.create(-width / 2, width / 2, -height / 2, height / 2)
    text.depthTest = true
    text.renderOrder = RENDER_ORDER + 1
    return text
  }

  private static createChild(parent: SceneObject, name: string, position: vec3): SceneObject {
    const child = global.scene.createSceneObject(name)
    child.setParent(parent)
    child.getTransform().setLocalPosition(position)
    return child
  }
}

/** One example taking part in a carousel step. */
export interface DemoParticipant {
  /** The example component: its enable / disable starts and stops the demo. */
  owner: BaseScriptComponent
  /** Short label used in the log, e.g. "OpenAI". */
  name: string
  /** Position in the step's sequence when several examples share a step (lower runs first). */
  order: number
  /** Tokens the example needs. A missing one is logged and the example does nothing else. */
  tokens: AvaliableApiTypes[]
  /** The panel to log into. The first participant of a step that has one hosts the step's log. */
  panel?: DemoLogPanel
  /** Runs the demo's calls one after the other. */
  run(run: DemoRun): Promise<void>
  /** Stops everything the demo started (sockets, microphone, audio). Must be safe to call anytime. */
  stop(): void
}

/** Handle a demo uses while it runs: logging, sequential calls and cancellation checks. */
export class DemoRun {
  constructor(
    private readonly owner: BaseScriptComponent | null,
    private readonly generation: number,
    private readonly name: string
  ) {}

  /** A run outside the carousel (e.g. a method called from your own code): logs to print only, never cancelled. */
  static detached(name: string): DemoRun {
    return new DemoRun(null, -1, name)
  }

  /** False once the step was left (or restarted). */
  get alive(): boolean {
    return this.generation < 0 || this.generation === DemoStep.generation
  }

  /** Throws DemoCancelled when the step was left. Call it after every await. */
  check(): void {
    if (!this.alive) {
      throw new DemoCancelled()
    }
  }

  log(text: string): void {
    this.write(text, false)
  }

  error(text: string): void {
    this.write(text, true)
  }

  /** Seconds since the step started. */
  elapsed(): number {
    return DemoStep.elapsed()
  }

  /**
   * Logs "label -> request sent", awaits the request, then logs "label <- ok in N s: <summary>" or
   * "label x after N s: <error>". Resolves with the result, or null on failure, so the next call of
   * the sequence still runs. Throws DemoCancelled when the step was left meanwhile.
   */
  async call<T>(label: string, request: () => Promise<T>, summary?: (result: T) => string): Promise<T | null> {
    this.check()
    const start = getTime()
    this.log(label + " → request sent")
    for (let attempt = 0; ; attempt++) {
      const attemptStart = getTime()
      try {
        const result = await request()
        this.check()
        const details = summary ? summary(result) : ""
        this.log(label + " ← ok in " + (getTime() - start).toFixed(1) + " s" + (details ? ": " + details : ""))
        return result
      } catch (error) {
        if (error instanceof DemoCancelled) {
          throw error
        }
        this.check()
        const elapsed = getTime() - attemptStart
        // A failure within a second (typically the very first request right after the Lens starts)
        // is retried once after a short pause; slower failures are real answers and are reported.
        if (attempt === 0 && elapsed < 1) {
          this.log(label + " ✗ after " + elapsed.toFixed(1) + " s (" + clip(errorText(error), 40) + "), retrying in 1.5 s")
          await this.wait(1.5)
          continue
        }
        this.error(label + " ✗ after " + (getTime() - start).toFixed(1) + " s: " + errorText(error))
        return null
      }
    }
  }

  /** Awaits a promise and checks the step is still shown afterwards. */
  async guard<T>(promise: Promise<T>): Promise<T> {
    const result = await promise
    this.check()
    return result
  }

  /** Waits `seconds`, then checks the step is still shown. */
  async wait(seconds: number): Promise<void> {
    const owner = this.owner
    if (!owner) {
      return
    }
    await new Promise<void>((resolve) => {
      const delay = owner.createEvent("DelayedCallbackEvent")
      delay.bind(() => {
        owner.removeEvent(delay)
        resolve()
      })
      delay.reset(seconds)
    })
    this.check()
  }

  private write(text: string, error: boolean): void {
    if (!this.alive) {
      return
    }
    if (this.generation < 0) {
      print("[" + this.name + "] " + (error ? "ERROR " : "") + text)
      return
    }
    DemoStep.write(this.name, text, error)
  }
}

type LogLine = {time: number; text: string; error: boolean}

/** Coordinates the carousel step currently shown: one run at a time, never overlapping. */
export class DemoStep {
  /** Incremented every time a step starts or is left. Runs from older generations are stale. */
  static generation = 0

  private static pending: DemoParticipant[] = []
  private static active: DemoParticipant[] = []
  private static scheduledBy: DemoParticipant | null = null
  private static startTime = 0
  private static lines: LogLine[] = []
  private static panel: DemoLogPanel | null = null
  private static title = ""

  /** Registers an example: it runs when its step is shown and stops when the step is left. */
  static join(participant: DemoParticipant): void {
    participant.owner.createEvent("OnEnableEvent").bind(() => DemoStep.enlist(participant))
    participant.owner.createEvent("OnDisableEvent").bind(() => DemoStep.leave(participant))
    // OnEnableEvent doesn't fire for a component that is already enabled when it awakes.
    if (participant.owner.getSceneObject().isEnabledInHierarchy) {
      DemoStep.enlist(participant)
    }
  }

  static elapsed(): number {
    return getTime() - DemoStep.startTime
  }

  static write(name: string, text: string, error: boolean): void {
    const time = DemoStep.elapsed()
    print("[RSG demo +" + time.toFixed(1) + "s] " + (error ? "ERROR " : "") + name + ": " + text)
    DemoStep.lines.push({time, text: clip(text), error})
    if (DemoStep.lines.length > MAX_LINES) {
      DemoStep.lines.splice(0, DemoStep.lines.length - MAX_LINES)
    }
    DemoStep.render()
  }

  private static enlist(participant: DemoParticipant): void {
    if (DemoStep.pending.indexOf(participant) >= 0 || DemoStep.active.indexOf(participant) >= 0) {
      return
    }
    DemoStep.pending.push(participant)
    DemoStep.schedule()
  }

  /**
   * Starts the pending examples on the next frame, once every example of the step has been enabled.
   * The delay runs on a pending example's own component: if that one is disabled first, another one
   * takes over (a disabled component's delayed events never fire).
   */
  private static schedule(): void {
    if (DemoStep.scheduledBy || DemoStep.pending.length === 0) {
      return
    }
    const scheduler = DemoStep.pending[0]
    DemoStep.scheduledBy = scheduler
    const owner = scheduler.owner
    const delay = owner.createEvent("DelayedCallbackEvent")
    delay.bind(() => {
      owner.removeEvent(delay)
      if (DemoStep.scheduledBy !== scheduler) {
        return
      }
      DemoStep.scheduledBy = null
      DemoStep.start()
    })
    delay.reset(0)
  }

  private static leave(participant: DemoParticipant): void {
    const pendingIndex = DemoStep.pending.indexOf(participant)
    if (pendingIndex >= 0) {
      DemoStep.pending.splice(pendingIndex, 1)
    }
    if (DemoStep.scheduledBy === participant) {
      DemoStep.scheduledBy = null
      DemoStep.schedule()
    }
    const activeIndex = DemoStep.active.indexOf(participant)
    if (activeIndex >= 0) {
      DemoStep.active.splice(activeIndex, 1)
      DemoStep.generation++
      print("[RSG demo +" + DemoStep.elapsed().toFixed(1) + "s] " + participant.name + ": step left, stopped")
    }
    DemoStep.safeStop(participant)
  }

  private static start(): void {
    // Safety net: only examples still shown take part.
    DemoStep.pending = DemoStep.pending.filter((participant) => participant.owner.getSceneObject().isEnabledInHierarchy)
    if (DemoStep.pending.length === 0) {
      return
    }
    // A new step replaces the previous one, even if it wasn't disabled first.
    DemoStep.active.forEach((participant) => DemoStep.safeStop(participant))
    DemoStep.generation++
    const generation = DemoStep.generation
    DemoStep.active = DemoStep.pending.sort((a, b) => a.order - b.order)
    DemoStep.pending = []
    DemoStep.startTime = getTime()
    DemoStep.lines = []
    const host = DemoStep.active.filter((participant) => !!participant.panel)[0]
    DemoStep.panel = host ? host.panel! : null
    DemoStep.title = DemoStep.active.map((participant) => participant.name).join(" + ") + " · live log"
    DemoStep.render()
    DemoStep.runAll(DemoStep.active.slice(), generation)
  }

  private static async runAll(participants: DemoParticipant[], generation: number): Promise<void> {
    for (const participant of participants) {
      if (generation !== DemoStep.generation) {
        return
      }
      const missing = participant.tokens.filter((type) => isTokenMissing(type))
      if (missing.length > 0) {
        missing.forEach((type) =>
          DemoStep.write(participant.name, "✗ " + type + " token missing: set " + TOKEN_INPUT[type] + " on RemoteServiceGatewayCredentials", true)
        )
        continue
      }
      const run = new DemoRun(participant.owner, generation, participant.name)
      try {
        await participant.run(run)
      } catch (error) {
        if (!(error instanceof DemoCancelled) && generation === DemoStep.generation) {
          DemoStep.write(participant.name, "✗ stopped: " + errorText(error), true)
        }
      }
    }
    if (generation === DemoStep.generation) {
      DemoStep.write(participants.map((participant) => participant.name).join(" + "), "■ step finished", false)
    }
  }

  private static safeStop(participant: DemoParticipant): void {
    try {
      participant.stop()
    } catch (error) {
      print("[RSG demo] " + participant.name + ": stop failed: " + errorText(error))
    }
  }

  private static render(): void {
    if (!DemoStep.panel) {
      return
    }
    const lines = DemoStep.lines.map((line) => {
      const stamp = "+" + line.time.toFixed(1) + "s"
      return (stamp + "      ").substring(0, 7) + " " + line.text
    })
    const lastIsError = DemoStep.lines.length > 0 && DemoStep.lines.some((line) => line.error)
    DemoStep.panel.show(DemoStep.title, lines, lastIsError)
  }
}
