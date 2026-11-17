// SupabaseRequirements — bridge between the SnapCloud transports and the
// package's single SnapCloudRequirements component.
//
// Assign YOUR OWN SupabaseProject asset on the `SnapCloudRequirements` object
// (Window > Supabase > Import Credentials) instead of hardcoding one in
// scripts. All SnapCloud transports (Realtime, RtcMailbox, CloudPathLogger)
// fetch the project through `SupabaseRequirements.getProject()`, which reads it
// from the wired SnapCloudRequirements, and disable themselves gracefully while
// it is missing, so the lens still runs without a configured project.
// Optionally wire a Text component: it shows a setup warning until the project
// is assigned, then hides itself.
//
// The `supabaseProject` input on this component is deprecated: it is only
// used when `snapCloudRequirements` isn't wired (scenes made before
// SnapCloudRequirements existed keep working).

import { SnapCloudRequirements } from "../../SnapCloudRequirements"

@component
export class SupabaseRequirements extends BaseScriptComponent {
    @input
    @hint("SnapCloudRequirements component holding the SupabaseProject")
    @allowUndefined
    snapCloudRequirements: SnapCloudRequirements

    @input
    @hint("Deprecated: use snapCloudRequirements")
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
            print("[SupabaseRequirements] Configured: " + this.getSupabaseProject().url)
            if (this.text) {
                this.text.enabled = false
            }
        } else {
            this.showWarning()
        }
    }

    isConfigured(): boolean {
        if (this.snapCloudRequirements) {
            return this.snapCloudRequirements.isConfigured()
        }
        return this.supabaseProject !== null && this.supabaseProject !== undefined
    }

    getSupabaseProject(): SupabaseProject | null {
        if (!this.isConfigured()) {
            return null
        }
        return this.snapCloudRequirements ? this.snapCloudRequirements.getSupabaseProject() : this.supabaseProject
    }

    private showWarning(): void {
        const msg =
            "Supabase project not configured!\n" +
            "SnapCloud features (RTC signaling, streaming,\n" +
            "position history) are disabled.\n" +
            "→ Window > Supabase > Import Credentials,\n" +
            "then assign the SupabaseProject asset on the\n" +
            "SnapCloudRequirements script."
        if (this.text) {
            this.text.enabled = true
            this.text.text = msg
        }
        print("[SupabaseRequirements] " + msg.replace(/\n/g, " "))
    }

    /**
     * Static accessor used by the SnapCloud transports. Returns null (with a
     * one-time console hint) when the project — or this component itself — is
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
                (inst ? " on SnapCloudRequirements" : " — add the SupabaseRequirements script to the scene") +
                ". SnapCloud features are disabled until one is provided."
            )
        }
        return project
    }
}
