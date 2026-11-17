/**
 * SPECS Inc. 2027
 * UI controller for OAuth2 authentication demo. Connects UI buttons to OAuth2 authentication flow,
 * manages sign-in/sign-out, and demonstrates making authenticated API requests.
 */
import { OAuth2 } from "AuthKit.lspkg/Core/OAuth2";
import { RectangleButton } from "UIKit.lspkg/Scripts/Components/Button/RectangleButton";

@component
export class UIController extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">UI References</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Connect the UI elements for authentication controls and status display</span>')

  @input signInButton: RectangleButton;
  @input signOutButton: RectangleButton;
  @input apiButton: RectangleButton;
  @input statusText: Text;
  @input titleText: Text;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Display Settings</span>')

  @input
  title: string;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">OAuth2 Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure your OAuth2 provider settings including client ID, endpoints, and authentication type</span>')

  @input
  clientId: string;
  @input clientSecret: string;
  @input authorizationUri: string;
  @input tokenUri: string;
  @input refreshUri: string;
  @input authenticationType: string;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Scope Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Space-separated OAuth2 scopes to request during authorization</span>')

  @input
  scope: string;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">API Testing</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure API endpoint for testing authenticated requests after sign-in</span>')

  @input
  apiUri: string;
  @input apiResponseKey: string;

  private internetModule: InternetModule = require("LensStudio:InternetModule");

  private oauth: OAuth2;

  onAwake() {
    this.oauth = new OAuth2({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      authorizationUri: this.authorizationUri,
      tokenUri: this.tokenUri,
      refreshUri: this.refreshUri,
      authenticationType: this.authenticationType,
    });

    this.createEvent("OnStartEvent").bind(() => {
      this.bindButtons();
    });

    this.statusText.text = this.oauth.isAuthorized ? "Signed In" : "Signed Out";
    this.titleText.text = this.title;
  }

  private bindButtons() {
    this.signInButton.onTriggerUp.add(() => { this.onSignIn(); });

    this.signOutButton.onTriggerUp.add(() => { this.onSignOut(); });

    this.apiButton.onTriggerUp.add(() => { this.onAPI(); });
  }

  private onSignIn() {
    this.statusText.text = "Authorizing...";
    this.oauth
      .authorize(this.scope)
      .then(() => {
        this.statusText.text = "Signed In";
      })
      .catch((error) => {
        this.statusText.text = "Authorization error: \n" + error;
      });
  }

  private onSignOut() {
    this.oauth.signOut();
    this.statusText.text = "Signed Out";
  }

  private onAPI() {
    this.statusText.text = "Requesting...";
    this.getUserData()
      .then((user) => {
        this.statusText.text = user;
      })
      .catch((error) => {
        this.statusText.text = "API error: \n" + error;
      });
  }

  private async getUserData(): Promise<string> {
    const token = await this.oauth.getAccessToken();
    const request = new Request(this.apiUri, {
      headers: {
        Authorization: "Bearer " + token,
      },
    });
    const response = await this.internetModule.fetch(request);
    const data = await response.text();
    print("response data: " + data);
    return JSON.parse(data)[this.apiResponseKey];
  }
}
