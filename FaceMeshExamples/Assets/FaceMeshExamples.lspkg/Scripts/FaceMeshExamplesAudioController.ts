/**
 * FaceMeshExamplesAudioController — plain helper (not a @component) wrapping the two
 * SFX AudioComponents that live on FaceMeshExamplesRoot.
 *
 * Contract:
 *   constructor(click: AudioComponent | null, swap: AudioComponent | null, clickVolume: number, swapVolume: number)
 *   setVolumes(clickVolume: number, swapVolume: number): void
 *   playClick(): void
 *   playSwap(): void
 *
 * Bootstrap creates both AudioComponents and assigns audioTrack; if either is
 * missing, the bundled GeneratedSFX tracks are used as fallback. One-shot only
 * (play(1)); never loops. All calls are null-safe.
 */
const CLICK_TRACK = requireAsset("../Audio/ButtonClick.wav") as AudioTrackAsset;
const SWAP_TRACK = requireAsset("../Audio/HeadSwap.wav") as AudioTrackAsset;

export class FaceMeshExamplesAudioController {
  private click: AudioComponent | null;
  private swap: AudioComponent | null;

  constructor(click: AudioComponent | null, swap: AudioComponent | null, clickVolume: number, swapVolume: number) {
    this.click = click;
    this.swap = swap;
    FaceMeshExamplesAudioController.prepare(this.click, CLICK_TRACK);
    FaceMeshExamplesAudioController.prepare(this.swap, SWAP_TRACK);
    this.setVolumes(clickVolume, swapVolume);
  }

  setVolumes(clickVolume: number, swapVolume: number): void {
    if (this.click) {
      this.click.volume = clickVolume;
    }
    if (this.swap) {
      this.swap.volume = swapVolume;
    }
  }

  playClick(): void {
    FaceMeshExamplesAudioController.playOnce(this.click, "click");
  }

  playSwap(): void {
    FaceMeshExamplesAudioController.playOnce(this.swap, "swap");
  }

  private static prepare(comp: AudioComponent | null, fallback: AudioTrackAsset): void {
    if (!comp) {
      return;
    }
    if (!comp.audioTrack && fallback) {
      comp.audioTrack = fallback;
    }
    try {
      comp.playbackMode = Audio.PlaybackMode.LowLatency;
    } catch (e) {
      print("[FaceMeshExamplesAudioController] LowLatency playbackMode unavailable: " + e);
    }
  }

  private static playOnce(comp: AudioComponent | null, label: string): void {
    if (!comp || !comp.audioTrack) {
      return;
    }
    try {
      if (comp.isPlaying()) {
        comp.stop(false);
      }
      comp.play(1);
    } catch (e) {
      print("[FaceMeshExamplesAudioController] failed to play " + label + ": " + e);
    }
  }
}
