// CloudPathLogger — fire-and-forget GPS path storage on Snap Cloud (Supabase).
//
// Writes throttled rows into the `locations` table (project: FriendFinder /
// kjxmfkpcafpeuzrwcrjo, table created via supabase/migrations/*_create_locations_table.sql).
// STRICTLY non-blocking: guidance never waits on the cloud; every failure is
// logged and swallowed. If auth is unavailable (e.g. Anonymous provider not
// enabled for preview), logging silently disables itself.

import { createClient, SupabaseClient } from "SupabaseClient.lspkg/supabase-snapcloud"
import { LocationFix } from "../MobileKit/MobileKitLink"
import { SupabaseRequirements } from "./SupabaseRequirements"

// Minimum seconds between writes per role ('self' / 'friend').
const WRITE_INTERVAL_S = 3.0

export class CloudPathLogger {
    private client: SupabaseClient | null = null
    private uid: string | null = null
    private ready = false
    private readonly sessionId: string
    private lastWriteTime: { [role: string]: number } = {}
    // Dropped to false if the DB predates the altitude-columns migration, so
    // logging keeps working with the legacy schema.
    private altitudeColumns = true

    constructor(private readonly script: BaseScriptComponent) {
        this.sessionId =
            "sess-" + Date.now().toString(36) + "-" +
            Math.floor(Math.random() * 1e6).toString(36)
    }

    /** Fire-and-forget init — never blocks the caller. */
    start(): void {
        this.init().catch((e) => print("[Cloud] init failed (non-blocking): " + e))
    }

    private async init(): Promise<void> {
        const project = SupabaseRequirements.getProject("CloudPathLogger")
        if (!project) {
            print("[Cloud] SupabaseProject not configured — path logging disabled.")
            return
        }
        this.client = createClient(project.url, project.publicToken, {
            realtime: { heartbeatIntervalMs: 2500 }, // required alpha workaround
        })
        await this.signIn(3)
    }

    private async signIn(retriesLeft: number): Promise<void> {
        if (!this.client) {
            return
        }
        const { data, error } = await this.client.auth.signInWithIdToken({
            provider: "snapchat",
            token: "", // empty — Snapchat handles auth automatically on device
        })
        if (!error && data && data.user) {
            this.uid = data.user.id
            this.ready = true
            print("[Cloud] Signed in (snapchat). Logging session " + this.sessionId)
            return
        }
        const errName = error
            ? String((error as any).name || (error as any).message || error)
            : "unknown"
        if (retriesLeft > 0 && errName.indexOf("Retry") >= 0) {
            // OIDC token not ready at startup — wait ~1 s and retry.
            await this.delay(1.0)
            return this.signIn(retriesLeft - 1)
        }
        // Lens Studio preview fallback: signInWithIdToken always fails in preview.
        // Requires Anonymous provider enabled in the Snap Cloud dashboard
        // (Authentication → Providers → Anonymous).
        const anon = await this.client.auth.signInAnonymously()
        if (!anon.error && anon.data && anon.data.user) {
            this.uid = anon.data.user.id
            this.ready = true
            print("[Cloud] Signed in anonymously (preview). Logging session " + this.sessionId)
        } else {
            const anonMsg = anon.error ? String((anon.error as any).message || anon.error) : ""
            print("[Cloud] Auth unavailable — path logging disabled. (" + errName + " / " + anonMsg + ")")
        }
    }

    private delay(seconds: number): Promise<void> {
        return new Promise((resolve) => {
            const evt = this.script.createEvent("DelayedCallbackEvent")
            evt.bind(() => resolve())
            evt.reset(seconds)
        })
    }

    /** Throttled fire-and-forget insert. Never throws; never blocks. */
    logFix(role: "self" | "friend", fix: LocationFix): void {
        if (!this.ready || !this.client || !this.uid) {
            return
        }
        const now = getTime()
        const last = this.lastWriteTime[role]
        if (last !== undefined && now - last < WRITE_INTERVAL_S) {
            return
        }
        this.lastWriteTime[role] = now
        try {
            const row: { [key: string]: unknown } = {
                user_id: this.uid,
                session_id: this.sessionId,
                role: role,
                device_name: fix.name,
                lat: fix.lat,
                lon: fix.lon,
                accuracy: fix.accuracy,
                heading: fix.heading,
            }
            if (this.altitudeColumns) {
                row.alt = fix.alt
                row.v_acc = fix.vAcc
                row.pressure_kpa = fix.pressure
            }
            this.client
                .from("locations")
                .insert(row)
                .then(({ error }) => {
                    if (error) {
                        const msg = String((error as any).message || error)
                        if (this.altitudeColumns && msg.indexOf("column") >= 0) {
                            this.altitudeColumns = false
                            print("[Cloud] altitude columns missing — run `supabase db push`; logging legacy fields only.")
                        } else {
                            print("[Cloud] insert failed (ignored): " + msg)
                        }
                    }
                })
        } catch (e) {
            print("[Cloud] insert threw (ignored): " + e)
        }
    }

    // Shared Snap Cloud access for sibling services (e.g. CloudCheckpoints) —
    // reuse this one authenticated client/session instead of signing in twice.
    getClient(): SupabaseClient | null {
        return this.client
    }

    isReady(): boolean {
        return this.ready
    }

    getSessionId(): string {
        return this.sessionId
    }

    getUid(): string | null {
        return this.uid
    }
}
