@component
export class MarkerCallbacks extends BaseScriptComponent {
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
