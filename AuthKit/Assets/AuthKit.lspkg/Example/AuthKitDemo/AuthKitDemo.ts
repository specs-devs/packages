import {OAuth2} from "AuthKit.lspkg/Core/OAuth2"
import {Token} from "AuthKit.lspkg/Core/Token"
import {TokenManager} from "AuthKit.lspkg/Core/TokenManager"
import {RectangleButton} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/RectangleButton"
import {Frame} from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame"

const FRAME_WIDTH = 38
const FRAME_HEIGHT = 20
const BUTTON_WIDTH = 8.5
const BUTTON_HEIGHT = 4
const BUTTON_SPACING = 9.25
const CONTENT_Z = 0.5
const LABEL_Z = 0.3
// The placeholder provider below is not a real OAuth2 server: Sign in refuses to open it.
const PLACEHOLDER_HOST = "provider.example"

/**
 * Demo panel for AuthKit: one OAuth2 session with Sign in / Get token / Store test token / Sign out
 * buttons and a status readout (authorized or not, masked access token, last result).
 *
 * Sign in needs a real provider and a device (AuthKit refuses to authorize in the Lens Studio
 * editor). "Store test token" saves a local, fake token through TokenManager and creates a new
 * OAuth2 for the same client, which restores it from persistent storage, so the session, token and
 * sign-out paths can be tried in the Preview without a provider.
 */
@component
export class AuthKitDemo extends BaseScriptComponent {
  @input
  @hint("OAuth2 client ID registered with your provider (tokens are stored per client ID)")
  clientId: string = "authkit-demo-client"

  @input
  @hint("Provider authorization endpoint")
  authorizationUri: string = "https://provider.example/oauth/authorize"

  @input
  @hint("Provider token endpoint")
  tokenUri: string = "https://provider.example/oauth/token"

  @input
  @hint("Space-separated scopes requested by Sign in")
  scope: string = "openid profile"

  @input
  @hint("\"code\" (Authorization Code Flow with PKCE) or \"implicit\"")
  authenticationType: string = "code"

  private auth: OAuth2 | null = null
  private status: Text | null = null
  private result: Text | null = null

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.build())
  }

  private build(): void {
    this.auth = this.createAuth()
    const frameObject = this.createChild(this.sceneObject, "AuthKitFrame", vec3.zero())
    const frame = frameObject.createComponent(Frame.getTypeName()) as Frame
    frame.autoShowHide = false
    frame.innerSize = new vec2(FRAME_WIDTH, FRAME_HEIGHT)
    // frame.content only exists once the Frame has initialized.
    frame.onInitialized.add(() => this.populate(frame))
  }

  private populate(frame: Frame): void {
    const top = FRAME_HEIGHT / 2
    const title = this.createText(frame.content, "Title", new vec3(0, top - 2, CONTENT_Z), 60, FRAME_WIDTH - 2, 4)
    title.text = "AuthKit · OAuth2 session"
    this.status = this.createText(frame.content, "Status", new vec3(0, top - 7, CONTENT_Z), 46, FRAME_WIDTH - 2, 5)
    this.status.horizontalAlignment = HorizontalAlignment.Left
    this.result = this.createText(frame.content, "Result", new vec3(0, top - 12, CONTENT_Z), 42, FRAME_WIDTH - 2, 4)
    this.result.horizontalAlignment = HorizontalAlignment.Left
    this.result.horizontalOverflow = HorizontalOverflow.Wrap
    this.result.verticalOverflow = VerticalOverflow.Shrink

    const y = -top + BUTTON_HEIGHT / 2 + 0.5
    const x = BUTTON_SPACING * 1.5
    this.createButton(frame.content, "SignInButton", new vec3(-x, y, CONTENT_Z), "Sign in", () => this.signIn())
    this.createButton(frame.content, "GetTokenButton", new vec3(-x + BUTTON_SPACING, y, CONTENT_Z), "Get token", () => this.getToken())
    this.createButton(frame.content, "TestTokenButton", new vec3(x - BUTTON_SPACING, y, CONTENT_Z), "Test token", () => this.storeTestToken())
    this.createButton(frame.content, "SignOutButton", new vec3(x, y, CONTENT_Z), "Sign out", () => this.signOut())

    this.refreshStatus()
    this.showResult("Pinch a button. Sign in needs a real provider on a device.")
  }

  private createAuth(): OAuth2 {
    return new OAuth2({
      clientId: this.clientId,
      authorizationUri: this.authorizationUri,
      tokenUri: this.tokenUri,
      authenticationType: this.authenticationType,
    })
  }

  private async signIn(): Promise<void> {
    // In the editor authorize() rejects before opening anything, so its own error is shown there.
    if (!global.deviceInfoSystem.isEditor() && this.authorizationUri.indexOf(PLACEHOLDER_HOST) >= 0) {
      this.showResult("Set clientId, authorizationUri and tokenUri on AuthKitDemo to your provider's values first.")
      return
    }
    try {
      this.showResult("Opening the provider's sign-in page...")
      await this.auth.authorize(this.scope)
      this.showResult("Signed in.")
    } catch (error) {
      this.showResult("authorize(): " + this.message(error))
    }
    this.refreshStatus()
  }

  private async getToken(): Promise<void> {
    try {
      const accessToken = await this.auth.getAccessToken()
      this.showResult("getAccessToken(): " + this.mask(accessToken))
    } catch (error) {
      this.showResult("getAccessToken(): " + this.message(error))
    }
    this.refreshStatus()
  }

  private storeTestToken(): void {
    // A fake, local-only token: the same record OAuth2 saves after a real sign-in.
    new TokenManager().save(this.clientId, new Token("demo-access-" + Date.now(), null, 3600))
    // A new OAuth2 restores the stored token for its client ID in its constructor.
    this.auth = this.createAuth()
    this.showResult("Test token stored and restored by a new OAuth2 (expires in 1 h).")
    this.refreshStatus()
  }

  private signOut(): void {
    this.auth.signOut()
    this.showResult("signOut(): stored token cleared.")
    this.refreshStatus()
  }

  private refreshStatus(): void {
    if (!this.status) {
      return
    }
    const authorized = this.auth.isAuthorized
    this.status.text = "Client: " + this.clientId + "\nAuthorized: " + (authorized ? "yes" : "no")
  }

  private showResult(text: string): void {
    if (this.result) {
      this.result.text = text
    }
    print("AuthKitDemo: " + text)
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message : "" + error
  }

  private mask(value: string): string {
    return value.length <= 8 ? "<redacted>" : value.slice(0, 4) + "..." + value.slice(-4)
  }

  private createButton(parent: SceneObject, name: string, position: vec3, label: string, onPress: () => void): void {
    const buttonObject = this.createChild(parent, name, position)
    const button = buttonObject.createComponent(RectangleButton.getTypeName()) as RectangleButton
    button.size = new vec3(BUTTON_WIDTH, BUTTON_HEIGHT, 1)
    button.initialize()
    const text = this.createText(buttonObject, "Label", new vec3(0, 0, LABEL_Z), 46, BUTTON_WIDTH, BUTTON_HEIGHT)
    text.horizontalAlignment = HorizontalAlignment.Center
    text.text = label
    button.onTriggerUp.add(onPress)
  }

  private createText(parent: SceneObject, name: string, position: vec3, size: number, width: number, height: number): Text {
    const textObject = this.createChild(parent, name, position)
    const text = textObject.createComponent("Component.Text")
    text.size = size
    text.textFill.color = new vec4(1, 1, 1, 1)
    text.horizontalAlignment = HorizontalAlignment.Center
    text.verticalAlignment = VerticalAlignment.Center
    text.horizontalOverflow = HorizontalOverflow.Shrink
    text.layoutRect = Rect.create(-width / 2, width / 2, -height / 2, height / 2)
    text.depthTest = true
    return text
  }

  private createChild(parent: SceneObject, name: string, position: vec3): SceneObject {
    const child = global.scene.createSceneObject(name)
    child.setParent(parent)
    child.getTransform().setLocalPosition(position)
    return child
  }
}
