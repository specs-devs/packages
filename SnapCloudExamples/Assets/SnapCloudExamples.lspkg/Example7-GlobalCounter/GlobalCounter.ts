/**
 * SPECS Inc. 2027
 * Example 7 – Global Counter: one action per user, one shared total for everyone.
 *
 * A generic version of the pattern behind campaign Lenses such as a pledge or a vote: each signed-in
 * user can add themselves once, and everybody sees the same live total. All counting happens in the
 * database (three RPC functions), so the Lens holds no counting logic and can't double count.
 * SQL setup: Docs/global-counter.md.
 */
import {createClient} from "SupabaseClient.lspkg/supabase-snapcloud"
import {RectangleButton} from "UIKit.lspkg/Scripts/Components/Button/RectangleButton"
import {Frame} from "UIKit.lspkg/Scripts/Components/Frame/Frame"
import {SnapCloudRequirements} from "../SnapCloudRequirements"

const FRAME_SIZE = new vec2(30, 20)
const CONTENT_Z = 0.5
const LABEL_Z = 0.65
const RENDER_ORDER = 100

@component
export class GlobalCounter extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">GlobalCounter – one action per user, one shared total</span><br/><span style="color: #94A3B8; font-size: 11px;">Calls counter_has_joined / counter_join_once / counter_total (see Docs/global-counter.md). Builds its own small panel.</span>')
  @ui.separator

  @input
  @hint("Holds the Snap Cloud (Supabase) project used by the package")
  snapCloudRequirements: SnapCloudRequirements

  @input
  @hint("What the counter is about, shown as the panel title")
  title: string = "Global counter"

  @input
  @hint("Label of the button that adds you to the total")
  actionLabel: string = "Count me in"

  @input
  @hint("Seconds between refreshes of the shared total (0 = only on start and after you join)")
  refreshInterval: number = 10

  private client: any = null
  private joined = false
  private busy = false
  private totalText: Text | null = null
  private statusText: Text | null = null
  private button: RectangleButton | null = null
  private buttonLabel: Text | null = null

  onAwake(): void {
    // The panel's texts exist once its Frame has initialized; start talking to Snap Cloud after that.
    this.createEvent("OnStartEvent").bind(() => this.buildPanel(() => this.start()))
  }

  onDestroy(): void {
    try {
      this.client?.removeAllChannels?.()
    } catch (_) {
      // nothing to clean up
    }
  }

  // ── Snap Cloud ─────────────────────────────────────────────────────────────
  private async start(): Promise<void> {
    if (!this.snapCloudRequirements || !this.snapCloudRequirements.isConfigured()) {
      this.setStatus("Assign your Supabase project on SnapCloudRequirements")
      return
    }
    const project = this.snapCloudRequirements.getSupabaseProject()
    this.client = createClient(project.url, project.publicToken)
    const {error: authError} = await this.client.auth.signInWithIdToken({provider: "snapchat", token: ""})
    if (authError) {
      this.setStatus("Sign-in failed: " + authError.message)
      return
    }
    const {data: hasJoined, error} = await this.client.rpc("counter_has_joined")
    if (error) {
      this.setStatus("counter_has_joined failed: " + error.message + " (run the SQL in Docs/global-counter.md)")
      return
    }
    this.joined = Boolean(hasJoined)
    await this.refreshTotal()
    this.updateButton()
    if (this.refreshInterval > 0) {
      const refresh = this.createEvent("DelayedCallbackEvent")
      refresh.bind(() => {
        this.refreshTotal()
        refresh.reset(this.refreshInterval)
      })
      refresh.reset(this.refreshInterval)
    }
  }

  /** Adds the signed-in user to the total, once. Also callable from other scripts. */
  public async join(): Promise<void> {
    if (!this.client || this.joined || this.busy) return
    this.busy = true
    this.setStatus("Adding you…")
    const {data, error} = await this.client.rpc("counter_join_once")
    this.busy = false
    if (error) {
      this.setStatus("counter_join_once failed: " + error.message)
      return
    }
    this.joined = true
    this.setTotal(Number(data))
    this.updateButton()
  }

  private async refreshTotal(): Promise<void> {
    if (!this.client) return
    const {data, error} = await this.client.rpc("counter_total")
    if (error) {
      this.setStatus("counter_total failed: " + error.message)
      return
    }
    this.setTotal(Number(data))
  }

  // ── UI ─────────────────────────────────────────────────────────────────────
  private setTotal(total: number): void {
    if (this.totalText) this.totalText.text = isNaN(total) ? "–" : "" + total
    this.setStatus(this.joined ? "You're counted. Thanks!" : "people so far")
  }

  private setStatus(message: string): void {
    if (this.statusText) this.statusText.text = message
    print("GlobalCounter: " + message)
  }

  private updateButton(): void {
    if (this.buttonLabel) this.buttonLabel.text = this.joined ? "Counted" : this.actionLabel
    if (this.button) this.button.sceneObject.enabled = true
  }

  private buildPanel(onBuilt: () => void): void {
    const frameObject = this.child(this.sceneObject, "GlobalCounterFrame", vec3.zero())
    const frame = frameObject.createComponent(Frame.getTypeName()) as Frame
    frame.autoShowHide = false
    frame.allowTranslation = true
    frame.innerSize = FRAME_SIZE
    frame.onInitialized.add(() => {
      const content = frame.content
      const half = FRAME_SIZE.y / 2
      this.text(content, "Title", this.title, new vec3(0, half - 2.5, CONTENT_Z), 48, 3)
      this.totalText = this.text(content, "Total", "–", new vec3(0, 2, CONTENT_Z), 160, 6)
      this.statusText = this.text(content, "Status", "Connecting…", new vec3(0, -2.5, CONTENT_Z), 36, 2.5)
      const buttonObject = this.child(content, "JoinButton", new vec3(0, -half + 3.5, CONTENT_Z))
      this.button = buttonObject.createComponent(RectangleButton.getTypeName()) as RectangleButton
      this.button.size = new vec3(14, 3.5, 1)
      this.button.renderOrder = RENDER_ORDER
      this.button.initialize()
      this.button.onTriggerUp.add(() => this.join())
      this.buttonLabel = this.text(buttonObject, "Label", this.actionLabel, new vec3(0, 0, LABEL_Z), 40, 3.5)
      this.button.sceneObject.enabled = false
      onBuilt()
    })
  }

  private text(parent: SceneObject, name: string, value: string, position: vec3, size: number, height: number): Text {
    const t = this.child(parent, name, position).createComponent("Component.Text") as Text
    t.text = value
    t.size = size
    t.textFill.color = new vec4(1, 1, 1, 1)
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Shrink
    const width = FRAME_SIZE.x - 2
    t.layoutRect = Rect.create(-width / 2, width / 2, -height / 2, height / 2)
    t.depthTest = true
    t.renderOrder = RENDER_ORDER + 2
    return t
  }

  private child(parent: SceneObject, name: string, position: vec3): SceneObject {
    const o = global.scene.createSceneObject(name)
    o.setParent(parent)
    o.getTransform().setLocalPosition(position)
    return o
  }
}
