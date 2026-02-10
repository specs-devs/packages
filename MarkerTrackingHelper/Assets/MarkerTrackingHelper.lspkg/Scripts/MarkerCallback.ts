/**
 * Specs Inc. 2026
 * Marker tracking callback handler that responds to marker found/lost events. Demonstrates
 * animation control based on marker tracking state for augmented reality experiences.
 */
@component
export class MarkerCallbacks extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Animation Image</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Image component with animated texture to play when marker is found</span>')

  @input
  animationImage: Image;

  private loop = 1;
  private offset = 0.0;

  onAwake() {}

  onMarkerFound() {
    print("Marker found");

    /* Play the animation when the marker is found */
    const textureProvider = this.animationImage.getMaterial(0).getPass(0)
      .baseTex.control as AnimatedTextureFileProvider;
    textureProvider.play(this.loop, this.offset);
  }

  onMarkerLost() {
    print("Marker Lost");

    /* Add custom logic here for when the marker is lost */
  }
}
