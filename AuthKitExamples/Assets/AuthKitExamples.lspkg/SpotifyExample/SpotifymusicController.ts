import { OAuth2 } from 'AuthKit.lspkg/Core/OAuth2';
import { RectangleButton } from 'UIKit.lspkg/Scripts/Components/Button/RectangleButton';


import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent } from "SnapDecorators.lspkg/decorators";




// Spotify API endpoints
const SPOTIFY_API = {
  LIKED_SONGS: 'https://api.spotify.com/v1/me/tracks',
  TRACK_DETAILS: 'https://api.spotify.com/v1/tracks', // For getting full track details including preview_url
  SEARCH: 'https://api.spotify.com/v1/search', // For searching tracks with preview URLs
  CURRENTLY_PLAYING: 'https://api.spotify.com/v1/me/player/currently-playing',
  PLAY: 'https://api.spotify.com/v1/me/player/play',
  PAUSE: 'https://api.spotify.com/v1/me/player/pause',
  NEXT: 'https://api.spotify.com/v1/me/player/next',
  PREVIOUS: 'https://api.spotify.com/v1/me/player/previous',
  DEVICES: 'https://api.spotify.com/v1/me/player/devices'
};

// Alternative music service APIs for preview URLs
const MUSIC_APIS = {
  DEEZER_SEARCH: 'https://api.deezer.com/search', // Public API, no auth required
  ITUNES_SEARCH: 'https://itunes.apple.com/search', // Public API, no auth required
};

// Spotify track interface
interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  uri: string;
  preview_url?: string;
  duration_ms: number;
  external_urls?: {
    spotify: string;
  };
  album: {
    name: string;
    images: Array<{
      url: string;
      height: number;
      width: number;
    }>;
  };
}

interface SpotifyLikedSongsResponse {
  items: Array<{
    track: SpotifyTrack;
  }>;
  total: number;
  next?: string;
}

@component
export class SpotifyMusicController extends BaseScriptComponent {
  // UI Components
  @input
  @allowUndefined
  @hint("Button to start Spotify authentication process")
  signInButton: RectangleButton;
  
  @input
  @allowUndefined
  @hint("Button to sign out and clear Spotify authentication")
  signOutButton: RectangleButton;
  
  @input
  @allowUndefined
  @hint("Button to start or resume music playback")
  playButton: RectangleButton;
  
  @input
  @allowUndefined
  @hint("Button to pause music playback (can be resumed)")
  pauseButton: RectangleButton;
  
  @input
  @allowUndefined
  @hint("Button to stop music playback completely")
  stopButton: RectangleButton;
  
  @input
  @allowUndefined
  @hint("Button to skip to the next liked song")
  nextButton: RectangleButton;
  
  @input
  @allowUndefined
  @hint("Button to go back to the previous liked song")
  previousButton: RectangleButton;
  
  @input
  @allowUndefined
  @hint("Text component to display connection and playback status")
  statusText: Text;
  
  @input
  @allowUndefined
  @hint("Text component to display current track information (name, artist, album)")
  trackInfoText: Text;
  
  @input
  @allowUndefined
  @hint("Text component to display audio debug and error messages")
  audioDebugText: Text;
  
  @input
  @allowUndefined
  @hint("Image component to display album artwork for the current track")
  albumArtworkImage: Image;
  
  @input
  @allowUndefined
  @hint("Audio component for local preview playback (30-second clips)")
  audioComponent: AudioComponent;

  // Configuration
  @ui.separator
  @input
  @hint("Display title for the music controller")
  title: string = 'Spotify Music Controller';

  @ui.separator
  @input
  @hint("Your Spotify app's Client ID from the Developer Dashboard")
  clientId: string = 'your-spotify-client-id'; // Replace with your Spotify Client ID

  @input
  @hint("Spotify OAuth2 authorization endpoint URL")
  authorizationUri: string = 'https://accounts.spotify.com/authorize';
  
  @input
  @hint("Spotify OAuth2 token exchange endpoint URL")
  tokenUri: string = 'https://accounts.spotify.com/api/token';
  
  @input
  @hint("OAuth2 authentication flow type (use 'code' for Auth Kit)")
  authenticationType: string = 'code';


scope: string = 'user-read-private user-library-read user-read-playback-state user-modify-playback-state user-read-currently-playing'
  
  @ui.separator
  @input
  @hint("Maximum number of liked songs to load from Spotify (1-50)")
  maxLikedSongs: number = 50;


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

  // Private properties
  private internetModule: InternetModule = require('LensStudio:InternetModule');
  private remoteMediaModule: RemoteMediaModule = require('LensStudio:RemoteMediaModule');
  private oauth: OAuth2;
  private likedSongs: SpotifyTrack[] = [];
  private currentTrackIndex: number = 0;
  private isPlaying: boolean = false;
  private currentTrack?: SpotifyTrack;
  private currentAlbumArt?: Texture;

  onAwake() {
    // Initialize logger
    this.logger = new Logger("SpotifyMusicController", this.enableLogging || this.enableLoggingLifecycle, true);

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

    // Update initial UI state
    this.updateUI();
    if (this.enableLogging) this.logger.info('SpotifyMusicController initialized');
  }

  @bindStartEvent
  onStart() {
    this.bindButtons();
    
    // If already authorized, load liked songs
    if (this.oauth.isAuthorized) {
      this.loadLikedSongs();
    }
  }


  private bindButtons() {
    // Authentication buttons
    if (this.signInButton) {
      this.signInButton.onTriggerUp.add(() => { this.onSignIn(); });
    }
    if (this.signOutButton) {
      this.signOutButton.onTriggerUp.add(() => { this.onSignOut(); });
    }

    // Playback control buttons
    if (this.playButton) {
      this.playButton.onTriggerUp.add(() => { this.onPlay(); });
    }
    if (this.pauseButton) {
      this.pauseButton.onTriggerUp.add(() => { this.onPause(); });
    }
    if (this.stopButton) {
      this.stopButton.onTriggerUp.add(() => { this.onStop(); });
    }
    if (this.nextButton) {
      this.nextButton.onTriggerUp.add(() => { this.onNext(); });
    }
    if (this.previousButton) {
      this.previousButton.onTriggerUp.add(() => { this.onPrevious(); });
    }

    // Set up audio component callback
    if (this.audioComponent) {
      // Ensure AudioComponent is enabled
      this.audioComponent.enabled = true;
      
      this.audioComponent.setOnFinish(() => {
        this.onTrackFinished();
      });
    }

    if (this.enableLogging) this.logger.info('Buttons bound successfully');
  }

  private onSignIn() {
    if (this.statusText) {
      this.statusText.text = 'Connecting to Spotify...';
    }
    if (this.enableLogging) this.logger.info('Starting Spotify authentication');
    

    this.oauth
      .authorize(this.scope)
      .then(() => {
        if (this.statusText) {
          this.statusText.text = '✅ Connected to Spotify!';
        }
        if (this.enableLogging) this.logger.info('Successfully authenticated with Spotify');
        this.loadLikedSongs();
      })
      .catch((error) => {
        if (this.statusText) {
          this.statusText.text = '❌ Connection failed: ' + error;
        }
        this.logger.error('Authentication failed: ' + error);
        
        if (error.toString().includes('Authorization not supported in editor mode')) {
          if (this.statusText) {
            this.statusText.text = "⚠️ Test on Glasses device\nOAuth2 doesn't work in Lens Studio";
          }
        }
      });
  }

  private onSignOut() {
    this.oauth.signOut();
    this.likedSongs = [];
    this.currentTrackIndex = 0;
    this.isPlaying = false;
    this.currentTrack = undefined;
    this.currentAlbumArt = undefined;
    
    if (this.audioComponent && this.audioComponent.isPlaying()) {
      this.audioComponent.stop(true);
    }
    
    this.updateUI();
    if (this.enableLogging) this.logger.info('Signed out from Spotify');
  }

  private onPlay() {
    if (!this.oauth.isAuthorized) {
      if (this.statusText) {
        this.statusText.text = '❌ Please sign in first';
      }
      return;
    }

    if (this.likedSongs.length === 0) {
      if (this.statusText) {
        this.statusText.text = '❌ No liked songs available';
      }
      return;
    }

    if (this.audioComponent && this.audioComponent.isPaused()) {
      // Resume paused track
      this.audioComponent.resume();
      this.isPlaying = true;
      if (this.statusText) {
        this.statusText.text = '▶️ Resumed';
      }
      if (this.enableLogging) this.logger.info('Resumed playback');
    } else {
      // Play current track
      this.playCurrentTrack();
    }
    
    this.updateUI();
  }

  private onPause() {
    if (!this.oauth.isAuthorized) {
      this.statusText.text = '❌ Please sign in first';
      return;
    }

    if (this.audioComponent && this.audioComponent.isPlaying()) {
      this.audioComponent.pause();
      this.isPlaying = false;
      this.statusText.text = '⏸️ Paused';
      if (this.enableLogging) this.logger.info('Playback paused');
    } else {
      this.statusText.text = '⏸️ Already paused';
    }
    
    // Also pause on Spotify if available
    this.pauseOnSpotify().catch((error) => {
      this.logger.warn('Failed to pause on Spotify: ' + error);
    });
    
    this.updateUI();
  }

  private onStop() {
    if (!this.oauth.isAuthorized) {
      this.statusText.text = '❌ Please sign in first';
      return;
    }

    if (this.audioComponent && this.audioComponent.isPlaying()) {
      this.audioComponent.stop(true);
      this.isPlaying = false;
      this.statusText.text = '⏹️ Stopped';
      if (this.enableLogging) this.logger.info('Playback stopped');
    } else {
      this.statusText.text = '⏹️ Already stopped';
    }
    
    // Also pause on Spotify (stop = pause in Spotify API)
    this.pauseOnSpotify().catch((error) => {
      this.logger.warn('Failed to stop on Spotify: ' + error);
    });
    
    this.updateUI();
  }

  private onNext() {
    if (this.likedSongs.length === 0) {
      this.statusText.text = '❌ No songs available';
      return;
    }

    this.currentTrackIndex = (this.currentTrackIndex + 1) % this.likedSongs.length;
    this.playCurrentTrack();
    if (this.enableLogging) this.logger.info(`Skipped to next track: ${this.currentTrackIndex}`);
  }

  private onPrevious() {
    if (this.likedSongs.length === 0) {
      this.statusText.text = '❌ No songs available';
      return;
    }

    this.currentTrackIndex = this.currentTrackIndex === 0 
      ? this.likedSongs.length - 1 
      : this.currentTrackIndex - 1;
    this.playCurrentTrack();
    if (this.enableLogging) this.logger.info(`Skipped to previous track: ${this.currentTrackIndex}`);
  }

  private async loadLikedSongs() {
    try {
      if (this.statusText) {
        this.statusText.text = '🎵 Loading your liked songs...';
      }
      if (this.enableLogging) this.logger.info('Loading liked songs from Spotify API');
      print('Loading liked songs from Spotify API');

      
      const token = await this.oauth.getAccessToken();
      
      const apiUrl = `${SPOTIFY_API.LIKED_SONGS}?limit=${this.maxLikedSongs}`;

      const request = new Request(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const response = await this.internetModule.fetch(request);
      
      
      if (!response.ok) {
        const errorText = await response.text();
        print('Error response body: ' + errorText);
        throw new Error(`Failed to load liked songs: ${response.status} - ${errorText}`);
      }

      const data = await response.text();
      
      const songsData: SpotifyLikedSongsResponse = JSON.parse(data);
      
      this.likedSongs = songsData.items.map(item => item.track);
      this.currentTrackIndex = 0;
      
      
      if (this.statusText) {
        this.statusText.text = `✅ Loaded ${this.likedSongs.length} liked songs`;
      }
      if (this.enableLogging) this.logger.info(`Successfully loaded ${this.likedSongs.length} liked songs`);
      
      this.updateUI();
      
    } catch (error) {
      print('❌ LOAD LIKED SONGS ERROR: ' + error);
      print('❌ Error type: ' + typeof error);
      print('❌ Error string: ' + error.toString());
      
      if (this.statusText) {
        this.statusText.text = '❌ Failed to load songs: ' + error;
      }
      this.logger.error('Failed to load liked songs: ' + error);
      print('Failed to load liked songs: ' + error);
    }
  }

  private async playCurrentTrack() {
    if (this.likedSongs.length === 0) return;

    this.currentTrack = this.likedSongs[this.currentTrackIndex];
    
    // Load album artwork
    await this.loadAlbumArtwork();
    
    // Get full track details to ensure we have preview_url
    await this.loadFullTrackDetails();
    
    // Show track info first
    if (this.audioDebugText) {
      this.audioDebugText.text = 'Attempting Spotify playback...';
    }
    
    try {
      // Try to play on Spotify first (requires active device)
      await this.playOnSpotify();
      
      if (this.audioDebugText) {
        this.audioDebugText.text = '✅ Playing on Spotify device!';
      }
    } catch (error) {
      this.logger.warn('Failed to play on Spotify, trying preview: ' + error);
      
      if (this.audioDebugText) {
        this.audioDebugText.text = 'Spotify failed, trying preview...';
      }
      
      // Fallback to preview if available
      this.playPreview();
    }
    
    this.isPlaying = true;
    this.updateUI();
  }

  private async playOnSpotify() {
    if (!this.currentTrack) return;

    const token = await this.oauth.getAccessToken();
    
    // First, check for available devices
    const devicesRequest = new Request(SPOTIFY_API.DEVICES, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const devicesResponse = await this.internetModule.fetch(devicesRequest);
    const devicesData = JSON.parse(await devicesResponse.text());
    
    if (!devicesData.devices || devicesData.devices.length === 0) {
      if (this.audioDebugText) {
        this.audioDebugText.text = '❌ No Spotify devices found. Open Spotify on your phone!';
      }
      throw new Error('No active Spotify devices found - please open Spotify on your phone and start playing any song');
    }
    
    if (this.audioDebugText) {
      this.audioDebugText.text = '✅ Found ' + devicesData.devices.length + ' Spotify device(s)';
    }

    // Play the track on Spotify
    const playRequest = new Request(SPOTIFY_API.PLAY, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uris: [this.currentTrack.uri],
      }),
    });

    const playResponse = await this.internetModule.fetch(playRequest);
    
    if (playResponse.ok) {
      if (this.statusText) {
        this.statusText.text = `🎵 Playing on Spotify: ${this.currentTrack.name}`;
      }
      if (this.audioDebugText) {
        this.audioDebugText.text = '🎵 Successfully playing on Spotify device!';
      }
      if (this.enableLogging) this.logger.info(`Playing on Spotify: ${this.currentTrack.name}`);
    } else {
      const errorText = await playResponse.text();
      if (this.audioDebugText) {
        this.audioDebugText.text = '❌ Spotify playback failed: ' + playResponse.status;
      }
      throw new Error(`Spotify playback failed: ${playResponse.status} - ${errorText}`);
    }
  }

  private playPreview() {
    // Set initial debug message
    if (this.audioDebugText) {
      this.audioDebugText.text = 'Starting audio preview...';
    }
    
    print('Audio component exists: ' + (this.audioComponent ? 'YES' : 'NO'));
    
    if (!this.currentTrack || !this.audioComponent) {
      const errorMsg = 'Missing track or audio component';
      print('Missing current track or audio component - aborting');
      if (this.audioDebugText) {
        this.audioDebugText.text = '❌ ' + errorMsg;
      }
      return;
    }

    
    if (this.currentTrack.preview_url) {
      if (this.audioDebugText) {
        this.audioDebugText.text = 'Loading audio from URL...';
      }
      
      
      // Check if required modules are available
      if (!this.internetModule || !this.remoteMediaModule) {
        const errorMsg = 'Remote modules not available';
        this.logger.warn('InternetModule or RemoteMediaModule is not available for audio');
        if (this.audioDebugText) {
          this.audioDebugText.text = '❌ ' + errorMsg;
        }
        if (this.statusText) {
          this.statusText.text = `🎵 No preview: ${this.currentTrack.name}`;
        }
        return;
      }

      try {
        if (this.audioDebugText) {
          this.audioDebugText.text = 'Creating resource...';
        }
        
        print('Creating resource from URL...');
        // Create a resource from the audio URL using InternetModule
        const resource: DynamicResource = this.internetModule.makeResourceFromUrl(this.currentTrack.preview_url);
        
        
        if (resource) {
          if (this.audioDebugText) {
            this.audioDebugText.text = 'Loading audio track...';
          }
          
          // Load the resource as an audio track using RemoteMediaModule
          this.remoteMediaModule.loadResourceAsAudioTrackAsset(
            resource,
            (audioTrack: AudioTrackAsset) => {
              
              if (this.audioDebugText) {
                this.audioDebugText.text = '✅ Audio loaded! Playing...';
              }
              
              // Successfully loaded the audio preview
              this.audioComponent.audioTrack = audioTrack;
              
              // Check AudioComponent state before playing
              
              this.audioComponent.play(1); // Play once
              
              // Check if it's actually playing
              const isPlaying = this.audioComponent.isPlaying();
              
              if (this.audioDebugText) {
                this.audioDebugText.text = isPlaying ? '🎵 Playing audio!' : '❌ Audio not playing';
              }
              
              if (this.statusText) {
                this.statusText.text = `🎵 Preview: ${this.currentTrack.name}`;
              }
              if (this.enableLogging) this.logger.info(`Playing preview: ${this.currentTrack.name}`);
            },
            (error: string) => {
              const errorMsg = 'Audio load failed: ' + error;
              this.logger.error(`Failed to load audio preview: ${error}`);
              
              if (this.audioDebugText) {
                this.audioDebugText.text = '❌ ' + errorMsg;
              }
              
              if (this.statusText) {
                this.statusText.text = `🎵 Preview failed: ${this.currentTrack.name}`;
              }
            }
          );
        } else {
          const errorMsg = 'Failed to create resource';
          this.logger.error('Failed to create resource from audio preview URL');
          if (this.audioDebugText) {
            this.audioDebugText.text = '❌ ' + errorMsg;
          }
        }
      } catch (error) {
        const errorMsg = 'Resource error: ' + error;
        this.logger.error(`Error creating resource for audio preview: ${error}`);
        print('❌ Error creating resource for audio preview: ' + error);
        if (this.audioDebugText) {
          this.audioDebugText.text = '❌ ' + errorMsg;
        }
      }
    } else {
      const errorMsg = 'No preview URL available';
      if (this.audioDebugText) {
        this.audioDebugText.text = '❌ ' + errorMsg;
      }
      
      if (this.statusText) {
        this.statusText.text = `🎵 No preview: ${this.currentTrack.name}`;
      }
      this.logger.warn(`No preview available for: ${this.currentTrack.name}`);
      print('❌ No preview URL available for: ' + this.currentTrack.name);
    }
    
  }

  private async loadFullTrackDetails() {
    if (!this.currentTrack) return;

    try {
      if (this.audioDebugText) {
        this.audioDebugText.text = 'Getting full track details...';
      }
      
      
      const token = await this.oauth.getAccessToken();
      const trackDetailsUrl = `${SPOTIFY_API.TRACK_DETAILS}/${this.currentTrack.id}?market=US`;
      
      
      const request = new Request(trackDetailsUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const response = await this.internetModule.fetch(request);
      
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to load track details: ${response.status} - ${errorText}`);
      }

      const trackData = await response.text();
      
      const fullTrack: SpotifyTrack = JSON.parse(trackData);
      
      print('Full track name: ' + fullTrack.name);
      print('Full track preview_url: ' + (fullTrack.preview_url || 'NULL'));
      print('Full track external_urls: ' + JSON.stringify(fullTrack.external_urls || {}));
      
      // Update current track with full details including preview_url
      this.currentTrack = fullTrack;
      
      if (fullTrack.preview_url) {
        print('✅ Found preview URL: ' + fullTrack.preview_url);
        if (this.audioDebugText) {
          this.audioDebugText.text = '✅ Got preview URL!';
        }
      } else {
        print('❌ No preview URL in full track details');
        if (this.audioDebugText) {
          this.audioDebugText.text = '❌ No preview URL available';
        }
      }
      
      
      // If no preview URL found, try searching for alternative versions
      if (!this.currentTrack.preview_url) {
        await this.searchForPreviewUrl();
      }
      
      // If still no preview URL, try other music services
      if (!this.currentTrack.preview_url) {
        await this.searchOtherMusicServices();
      }
      
    } catch (error) {
      if (this.audioDebugText) {
        this.audioDebugText.text = '❌ Track details failed: ' + error;
      }
      this.logger.error('Failed to load full track details: ' + error);
    }
  }

  private async searchForPreviewUrl() {
    if (!this.currentTrack) return;

    try {
      if (this.audioDebugText) {
        this.audioDebugText.text = 'Searching for preview URL...';
      }
      
      
      const artistName = this.currentTrack.artists[0]?.name || '';
      const trackName = this.currentTrack.name;
      
      // Create search query like the npm package does
      const searchQuery = `track:"${trackName}" artist:"${artistName}"`;
      
      const token = await this.oauth.getAccessToken();
      const searchUrl = `${SPOTIFY_API.SEARCH}?q=${encodeURIComponent(searchQuery)}&type=track&limit=10`;
      
      
      const request = new Request(searchUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const response = await this.internetModule.fetch(request);
      
      print('Search response status: ' + response.status);
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const searchData = await response.text();
      const searchResults = JSON.parse(searchData);
      
      
      // Look through search results for tracks with preview URLs
      if (searchResults.tracks && searchResults.tracks.items) {
        for (let i = 0; i < searchResults.tracks.items.length; i++) {
          const track = searchResults.tracks.items[i];
          
          if (track.preview_url) {
            print('✅ Found preview URL in search results: ' + track.preview_url);
            
            // Update current track with the version that has preview
            this.currentTrack.preview_url = track.preview_url;
            
            if (this.audioDebugText) {
              this.audioDebugText.text = '✅ Found preview via search!';
            }
            
            return; // Found one, stop searching
          }
        }
      }
      
      print('❌ No preview URLs found in search results');
      if (this.audioDebugText) {
        this.audioDebugText.text = '❌ No preview found anywhere';
      }
      
      
    } catch (error) {
      if (this.audioDebugText) {
        this.audioDebugText.text = '❌ Search failed: ' + error;
      }
      this.logger.error('Failed to search for preview URL: ' + error);
    }
  }

  private async searchOtherMusicServices() {
    if (!this.currentTrack) return;

    const artistName = this.currentTrack.artists[0]?.name || '';
    const trackName = this.currentTrack.name;
    

    // Try Deezer first (often has good preview coverage)
    await this.searchDeezer(trackName, artistName);
    
    // If still no preview, try iTunes
    if (!this.currentTrack.preview_url) {
      await this.searchItunes(trackName, artistName);
    }
    
  }

  private async searchDeezer(trackName: string, artistName: string) {
    try {
      if (this.audioDebugText) {
        this.audioDebugText.text = 'Searching Deezer...';
      }
      
      
      const query = `${trackName} ${artistName}`.trim();
      const deezerUrl = `${MUSIC_APIS.DEEZER_SEARCH}?q=${encodeURIComponent(query)}&limit=10`;
      
      
      const request = new Request(deezerUrl);
      const response = await this.internetModule.fetch(request);
      
      
      if (response.ok) {
        const data = await response.text();
        const deezerResults = JSON.parse(data);
        
        
        if (deezerResults.data && deezerResults.data.length > 0) {
          for (let i = 0; i < deezerResults.data.length; i++) {
            const track = deezerResults.data[i];
            
            if (track.preview) {
              
              // Use Deezer preview URL
              this.currentTrack.preview_url = track.preview;
              
              if (this.audioDebugText) {
                this.audioDebugText.text = '✅ Found preview on Deezer!';
              }
              
              return; // Found one, stop searching
            }
          }
        }
      }
      
      
    } catch (error) {
    }
  }

  private async searchItunes(trackName: string, artistName: string) {
    try {
      if (this.audioDebugText) {
        this.audioDebugText.text = 'Searching iTunes...';
      }
      
      
      const query = `${trackName} ${artistName}`.trim();
      const itunesUrl = `${MUSIC_APIS.ITUNES_SEARCH}?term=${encodeURIComponent(query)}&media=music&entity=song&limit=10`;
      
      
      const request = new Request(itunesUrl);
      const response = await this.internetModule.fetch(request);
      
      
      if (response.ok) {
        const data = await response.text();
        const itunesResults = JSON.parse(data);
        
        
        if (itunesResults.results && itunesResults.results.length > 0) {
          for (let i = 0; i < itunesResults.results.length; i++) {
            const track = itunesResults.results[i];
            
            if (track.previewUrl) {
              
              // Use iTunes preview URL
              this.currentTrack.preview_url = track.previewUrl;
              
              if (this.audioDebugText) {
                this.audioDebugText.text = '✅ Found preview on iTunes!';
              }
              
              return; // Found one, stop searching
            }
          }
        }
      }
      
      
    } catch (error) {
    }
  }

  private async pauseOnSpotify() {
    const token = await this.oauth.getAccessToken();
    
    const pauseRequest = new Request(SPOTIFY_API.PAUSE, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const pauseResponse = await this.internetModule.fetch(pauseRequest);
    
    if (pauseResponse.ok) {
      if (this.enableLogging) this.logger.info('Successfully paused on Spotify');
    } else {
      throw new Error(`Spotify pause failed: ${pauseResponse.status}`);
    }
  }

  private async loadAlbumArtwork() {
    if (!this.currentTrack || !this.albumArtworkImage) return;

    try {
      // Get the best quality image (usually the first one, or find medium size)
      const albumImages = this.currentTrack.album.images;
      if (albumImages.length === 0) {
        this.logger.warn('No album artwork available for this track');
        return;
      }

      // Find medium-sized image (around 300px) or use the first available
      let imageUrl = albumImages[0].url;
      for (const image of albumImages) {
        if (image.width >= 300 && image.width <= 640) {
          imageUrl = image.url;
          break;
        }
      }

      if (this.enableLogging) this.logger.info(`Loading album artwork from: ${imageUrl}`);

      // Check if required modules are available
      if (!this.internetModule || !this.remoteMediaModule) {
        this.logger.warn('InternetModule or RemoteMediaModule is not available');
        return;
      }

      try {
        // Create a resource from the image URL using InternetModule
        const resource: DynamicResource = this.internetModule.makeResourceFromUrl(imageUrl);
        
        if (resource) {
          // Load the resource as an image texture using RemoteMediaModule
          this.remoteMediaModule.loadResourceAsImageTexture(
            resource,
            (texture: Texture) => {
              // Successfully loaded the album artwork texture
              this.currentAlbumArt = texture;
              if (this.albumArtworkImage) {
                this.albumArtworkImage.mainPass.baseTex = texture;
              }
              if (this.enableLogging) this.logger.info(`Successfully loaded album artwork for: ${this.currentTrack?.name}`);
              
              // Update status to indicate artwork is loaded
              if (this.statusText && this.currentTrack) {
                this.statusText.text = `🎵 ${this.currentTrack.name} (with artwork)`;
              }
            },
            (error: string) => {
              this.logger.error(`Failed to load album artwork texture: ${error}`);
              
              // Update status to indicate artwork failed to load
              if (this.statusText && this.currentTrack) {
                this.statusText.text = `🎵 ${this.currentTrack.name} (no artwork)`;
              }
            }
          );
        } else {
          this.logger.error('Failed to create resource from album artwork URL');
        }
      } catch (error) {
        this.logger.error(`Error creating resource for album artwork: ${error}`);
      }

    } catch (error) {
      this.logger.error(`Failed to load album artwork: ${error}`);
    }
  }

  private onTrackFinished() {
    if (this.enableLogging) this.logger.info('Track finished, playing next');
    this.onNext();
  }

  private updateUI() {
    
    // Update status based on authentication state
    if (!this.oauth.isAuthorized) {
      if (this.statusText) {
        this.statusText.text = 'Tap Sign In to connect Spotify';
      }
      if (this.trackInfoText) {
        this.trackInfoText.text = 'Not connected';
      }
      return;
    }

    // Update track info
    if (this.trackInfoText) {
      if (this.currentTrack) {
        const artistNames = this.currentTrack.artists.map(artist => artist.name).join(', ');
        const trackInfo = `${this.currentTrack.name}\nby ${artistNames}\nAlbum: ${this.currentTrack.album.name}`;
        this.trackInfoText.text = trackInfo;
      } else if (this.likedSongs.length > 0) {
        const trackInfo = `${this.likedSongs.length} songs loaded\nReady to play`;
        this.trackInfoText.text = trackInfo;
      } else {
        this.trackInfoText.text = 'Loading songs...';
      }
    }

    // Update playback status
    if (this.statusText) {
      const playbackStatus = this.isPlaying ? '▶️' : '⏸️';
      const trackNumber = this.likedSongs.length > 0 ? `(${this.currentTrackIndex + 1}/${this.likedSongs.length})` : '';
      
      if (this.likedSongs.length > 0) {
        const statusText = `${playbackStatus} Ready ${trackNumber}`;
        this.statusText.text = statusText;
      }
    }
    
  }

  // Public methods for external control
  public getCurrentTrack(): SpotifyTrack | undefined {
    return this.currentTrack;
  }

  public getLikedSongs(): SpotifyTrack[] {
    return this.likedSongs;
  }

  public getPlaybackState(): { isPlaying: boolean; currentIndex: number; totalTracks: number } {
    return {
      isPlaying: this.isPlaying,
      currentIndex: this.currentTrackIndex,
      totalTracks: this.likedSongs.length
    };
  }
}