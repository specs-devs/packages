/**
 * SPECS Inc. 2027
 * Starts CommerceKit when the Lens starts. Products are no longer listed in the Lens: they are defined
 * on the Specs developer portal (https://developers.specs.com/lenses), and scripts refer to them by
 * product ID.
 */
import { CommerceKit } from "./CommerceKit";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";

@component
export class ProductCatalog extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">Products</span>')
  @ui.label(
    '<div style="color: #e2e2e2ff;">Configure your product catalog (IDs, names, prices, types and subscription plans) on the Specs developer portal at <a href="https://developers.specs.com/lenses" target="_blank" style="color: #00D4FF; text-decoration: underline;">developers.specs.com/lenses</a>, not in the Lens, then use its product IDs in your scripts. To get started, visit our <a href="https://developers.snap.com/spectacles/spectacles-frameworks/commerce-kit/get-started" target="_blank" style="color: #00D4FF; text-decoration: underline;">docs</a>.</div>'
  )
  @ui.label(
    '<span style="color: #94A3B8; font-size: 11px;">Lens Studio Preview cannot reach the commerce service, so purchases are simulated there: every product costs $0.99 and every checkout succeeds.</span>'
  )

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Connection</span>')
  @input
  @hint(
    "Connect and restore purchases when the Lens starts. When off, CommerceKit connects the first time it is used."
  )
  initializeOnAwake: boolean = true;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Logging Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Control logging output for this script instance</span>')
  @input
  @hint("Enable general logging (animation cycles, events, etc.)")
  enableLogging: boolean = false;

  @input
  @hint("Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.)")
  enableLoggingLifecycle: boolean = false;

  private logger: Logger;

  onAwake(): void {
    this.logger = new Logger("ProductCatalog", this.enableLogging || this.enableLoggingLifecycle, true);

    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }

    if (this.initializeOnAwake) {
      CommerceKit.getInstance()
        .initialize()
        .then(
          () => this.logger.info("CommerceKit is ready"),
          (error: Error) => print(`[ProductCatalog] CommerceKit could not connect: ${error.message}`)
        );
    }
  }
}
