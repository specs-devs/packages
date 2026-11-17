import { OAuth2 } from 'AuthKit.lspkg/Core/OAuth2';
import { RectangleButton } from 'SpectaclesUIKit.lspkg/Scripts/Components/Button/RectangleButton';
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";

@component
export class SpotifyUIController extends BaseScriptComponent {
  @input signInButton: RectangleButton;
  @input signOutButton: RectangleButton;
  @input apiButton: RectangleButton;
  @input statusText: Text;
  @input titleText: Text;

  @ui.separator
  @input
  title: string = 'Spotify Music Lens';

  @ui.separator
  @input
  clientId: string = 'your-spotify-client-id'; // Replace with your Spotify Client ID
  @input authorizationUri: string = 'https://accounts.spotify.com/authorize';
  @input tokenUri: string = 'https://accounts.spotify.com/api/token';
  @input authenticationType: string = 'code';

  @ui.separator
  @input
  scope: string =
    'user-read-private user-read-currently-playing user-read-playback-state';

  @ui.separator
  @input
  apiUri: string = 'https://api.spotify.com/v1/me';
  @input apiResponseKey: string = 'display_name';


  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Logging Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Control logging output for this script instance</span>')

  @input
  @hint("Enable general logging (API calls, playback events, etc.)")
  enableLogging: boolean = false;

  @input
  @hint("Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.)")
  enableLoggingLifecycle: boolean = false;

  // Logger instance
  private logger: Logger;

  private internetModule: InternetModule = require('LensStudio:InternetModule');
  private oauth: OAuth2;

  onAwake() {
    // Initialize logger
    this.logger = new Logger("SpotifyControllerMinimum", this.enableLogging || this.enableLoggingLifecycle, true);

    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }
    
    // Initialize OAuth2 with Spotify configuration
    this.oauth = new OAuth2({
      clientId: this.clientId,
      authorizationUri: this.authorizationUri,
      tokenUri: this.tokenUri,
      authenticationType: this.authenticationType,
    });

    this.createEvent('OnStartEvent').bind(() => {
      this.bindButtons();
    });

    // Update initial UI state
    this.statusText.text = this.oauth.isAuthorized
      ? 'Signed In'
      : 'Tap Sign In to connect Spotify';
    this.titleText.text = this.title;
  }

  private bindButtons() {
    // Bind Sign In button
    this.signInButton.onTriggerUp.add(() => { this.onSignIn(); });

    // Bind Sign Out button
    this.signOutButton.onTriggerUp.add(() => { this.onSignOut(); });

    // Bind API Test button
    this.apiButton.onTriggerUp.add(() => { this.onAPI(); });
  }

  private onSignIn() {
    this.statusText.text = 'Connecting to Spotify...';

    this.oauth
      .authorize(this.scope)
      .then(() => {
        this.statusText.text = '✅ Successfully connected to Spotify!';
      })
      .catch((error) => {
        this.statusText.text = '❌ Connection failed:\n' + error;

        // Handle common errors
        if (
          error
            .toString()
            .includes('Authorization not supported in editor mode')
        ) {
          this.statusText.text =
            "⚠️ Test on Glasses device\nOAuth2 doesn't work in Lens Studio";
        }
      });
  }

  private onSignOut() {
    this.oauth.signOut();
    this.statusText.text = 'Signed out from Spotify';
  }

  private onAPI() {
    this.statusText.text = 'Getting your Spotify profile...';

    this.getUserData()
      .then((displayName) => {
        this.statusText.text = `Hello, ${displayName}! 🎵`;
      })
      .catch((error) => {
        this.statusText.text = 'API error:\n' + error;
      });
  }

  private async getUserData(): Promise<string> {
    const token = await this.oauth.getAccessToken();

    const request = new Request(this.apiUri, {
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
    });

    const response = await this.internetModule.fetch(request);
    const data = await response.text();

    print('Spotify API response: ' + data);

    const userData = JSON.parse(data);
    return userData[this.apiResponseKey] || 'Spotify User';
  }
}