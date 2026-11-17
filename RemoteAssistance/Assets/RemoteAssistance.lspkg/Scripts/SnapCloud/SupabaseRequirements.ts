// SupabaseRequirements — central Snap Cloud (Supabase) configuration gate.
//
// Assign YOUR OWN SupabaseProject asset here (Window > Supabase > Import
// Credentials) instead of hardcoding one in scripts. All SnapCloud transports
// (RtcMailbox) fetch the project through this
// component and disable themselves gracefully while it is missing, so the
// lens still runs without a configured project. Optionally wire a Text
// component: it shows a setup warning until the asset is assigned, then
// hides itself. Mirrors SnapCloudExamples' SnapCloudRequirements pattern.
//
// Deprecated: use SnapCloudRequirements (RemoteAssistance.lspkg/SnapCloudRequirements)
// wired into SnapCloudModule.snapCloudRequirements. Kept so existing scenes
// that still carry this component keep working (RtcMailbox falls back to it
// when SnapCloudModule has no SnapCloudRequirements).

/** @deprecated Use SnapCloudRequirements. */
@component
export class SupabaseRequirements extends BaseScriptComponent {
    @input
    @hint("SupabaseProject asset from the Asset Browser (Window > Supabase > Import Credentials)")
    @allowUndefined
    supabaseProject: SupabaseProject

    @input
    @hint("Optional Text that shows a setup warning until the asset is assigned")
    @allowUndefined
    text: Text

    private static instance: SupabaseRequirements | null = null
    private static warned = false

    onAwake(): void {
        SupabaseRequirements.instance = this
        this.createEvent("OnStartEvent").bind(() => this.onStart())
    }

    private onStart(): void {
        if (this.isConfigured()) {
            print("[SupabaseRequirements] Configured: " + this.supabaseProject.url)
            if (this.text) {
                this.text.enabled = false
            }
        } else {
            this.showWarning()
        }
    }

    isConfigured(): boolean {
        return this.supabaseProject !== null && this.supabaseProject !== undefined
    }

    getSupabaseProject(): SupabaseProject | null {
        return this.isConfigured() ? this.supabaseProject : null
    }

    private showWarning(): void {
        const msg =
            "Supabase project not configured!\n" +
            "SnapCloud features (RTC signaling, streaming,\n" +
            "position history) are disabled.\n" +
            "→ Window > Supabase > Import Credentials,\n" +
            "then assign the SupabaseProject asset on the\n" +
            "SupabaseRequirements script."
        if (this.text) {
            this.text.enabled = true
            this.text.text = msg
        }
        print("[SupabaseRequirements] " + msg.replace(/\n/g, " "))
    }

    /**
     * @deprecated Use SnapCloudRequirements.getSupabaseProject().
     * Static accessor used by the SnapCloud transports. Returns null (with a
     * one-time console hint) when the asset — or this component itself — is
     * missing from the scene, so callers disable their feature instead of
     * crashing the lens.
     */
    static getProject(caller: string): SupabaseProject | null {
        const inst = SupabaseRequirements.instance
        const project = inst ? inst.getSupabaseProject() : null
        if (!project && !SupabaseRequirements.warned) {
            SupabaseRequirements.warned = true
            print(
                "[SupabaseRequirements] (" + caller + ") No SupabaseProject asset assigned" +
                (inst ? "" : " — add the SupabaseRequirements script to the scene") +
                ". SnapCloud features are disabled until one is provided."
            )
        }
        return project
    }
}
