// MobileKitModule — the PhoneLink building block as a drop-in scene component.
//
// Owns the app's single MobileKitLink transport (Glasses Mobile Kit: friend
// location + call-signaling relay) and the one permitted SpectaclesMobileKitModule
// require. Core (FriendFinderManager) resolves the link via an @input reference
// to this component instead of constructing MobileKitLink itself — so the
// PhoneLink block is a self-contained object a developer can drop into any scene.
//
// PhoneLink is the app's transport, so it is a REQUIRED module: with its object
// absent, Core has no phone link and cannot run. (It is therefore NOT meant to
// be disabled to "turn a feature off" — unlike the optional SnapCloudModule.)

import { MobileKitLink } from "./MobileKitLink"

// Acquire Mobile Kit exactly like the official sample does: the built-in module
// via require(), NOT a project-asset instance. Only one SpectaclesMobileKitModule
// may exist per Lens — a leftover module asset in the scene alongside this
// require() leaves the phone's session rendezvous bound to the wrong instance,
// and both sides hang on "waiting". This require lives here, in the single module
// that owns the transport; never re-add a SpectaclesMobileKitModule asset/@input.
const MOBILE_KIT_MODULE = require("LensStudio:SpectaclesMobileKitModule") as SpectaclesMobileKitModule

@component
export class MobileKitModule extends BaseScriptComponent {
    private _link: MobileKitLink | null = null

    /** The shared MobileKitLink, constructed once and owned by this component.
     *  Lazy so it resolves correctly regardless of script init order (Core may
     *  ask for it in onAwake, before this module's own onAwake has run). */
    getLink(): MobileKitLink {
        if (!this._link) {
            this._link = new MobileKitLink(this, MOBILE_KIT_MODULE)
        }
        return this._link
    }
}
