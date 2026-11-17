// VideoCallS2S Snap Cloud Setup — Lens Studio CoreService plugin.
//
// The Video Call S2S Lens exchanges its call handshake + WebRTC signaling as rows in
// the Snap Cloud table `rtc_signals` (supabase/migrations/20260721000000_create_rtc_signals.sql).
// A Lens cannot create that table itself: the anon/authenticated roles have no DDL
// rights and PostgREST runs no free-form SQL. So the FIRST time this project is open
// with a SupabaseProject asset whose database lacks the table, this background
// service applies the migration through the Snap Cloud management API, signed in as
// the developer's own Lens Studio Snap account — exactly the way the Supabase panel
// talks to Snap Cloud. On the Glasses the Lens only detects the gap and shows
// SCHEMA_MISSING_HINT (RtcMailbox.ts) instead of ringing into the void.
//
// Triggers: project load, Snap sign-in, project meta changes, and a 30 s re-check
// while no SupabaseProject asset exists yet (so "Import Credentials" is picked up).
// Each project id is verified once per session; the probe is a 0-row REST select,
// so an already-configured project costs one HTTPS round trip per project open.
import CoreService from "LensStudio:CoreService";
import * as Network from "LensStudio:Network";

const TABLE = "rtc_signals";
const AUTH_URL = "https://auth.supabase.io/auth/v1/token?grant_type=id_token";
const MANAGEMENT_API_URL = "https://cloudapi.snapcloud.co/";
const LOG = "[VideoCallS2S SnapCloud]";

// Keep in sync with supabase/migrations/20260721000000_create_rtc_signals.sql
// (that file stays the source of truth for `supabase db push`).
const MIGRATION_SQL = `
create table if not exists public.rtc_signals (
    id         bigint generated always as identity primary key,
    session    text not null,               -- call session ("s2s-<callee code>")
    kind       text not null,               -- 'pov' | 'ring' | 'accept' | 'decline' | 'busy' | 'bye' | 'diag'
    sender     text not null,               -- the sender's pairing code
    t          text not null,               -- 'offer' | 'answer' | 'cand' | <kind> for lifecycle rows
    sdp        text,
    cand       text,
    mid        text,
    created_at timestamptz not null default now()
);

create index if not exists rtc_signals_session_id_idx
    on public.rtc_signals (session, id);

alter table public.rtc_signals enable row level security;

-- PROTOTYPE POLICY (see the migration file): both peers must write their own rows
-- and read the other's; tighten before any non-prototype use.
create policy "rtc_open_insert" on public.rtc_signals
    for insert to anon, authenticated with check (true);
create policy "rtc_open_select" on public.rtc_signals
    for select to anon, authenticated using (true);
create policy "rtc_open_delete" on public.rtc_signals
    for delete to anon, authenticated using (true);
`;

export class VideoCallS2SSnapCloudSetup extends CoreService {
  static descriptor() {
    return {
      id: "Com.Snap.VideoCallS2S.SnapCloudSetup",
      name: "VideoCallS2S Snap Cloud Setup",
      description: "Creates the rtc_signals table in the assigned Snap Cloud project when it is missing",
      dependencies: [Editor.Model.IModel],
    };
  }

  constructor(pluginSystem, descriptor) {
    super(pluginSystem, descriptor);
    this.connections = [];
    this.timer = null;
    this.busy = false;
    this.verified = new Set(); // Snap Cloud project ids confirmed to have the table this session
  }

  start() {
    this.model = this.pluginSystem.findInterface(Editor.Model.IModel);
    this.auth = this.pluginSystem.findInterface(Editor.IAuthorization);
    const recheck = () => this.schedule(1500);
    if (this.model && this.model.onProjectChanged) {
      this.connections.push(this.model.onProjectChanged.connect(recheck));
    }
    if (this.model && this.model.onMetaInfoChanged) {
      this.connections.push(this.model.onMetaInfoChanged.connect(recheck));
    }
    if (this.auth && !Editor.isNull(this.auth) && this.auth.onAuthorizationChange) {
      this.connections.push(this.auth.onAuthorizationChange.connect(recheck));
    }
    this.schedule(3000);
  }

  stop() {
    for (const c of this.connections) {
      try { c.disconnect(); } catch (e) { /* already gone */ }
    }
    this.connections = [];
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }

  schedule(ms) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.run().catch((e) => console.error(LOG, "check failed:", e));
    }, ms);
  }

  /** SupabaseProject assets of the open SPECS project that carry usable credentials. */
  supabaseProjects() {
    const project = this.model ? this.model.project : null;
    if (!project || Editor.isNull(project)) return [];
    if (project.targetPlatform !== Editor.TargetPlatform.Spectacles) return [];
    return project.assetManager.assets.filter((a) =>
      a.isOfType("SupabaseProject") && a.projectId && a.projectUrl && a.publicToken);
  }

  async run() {
    if (this.busy) return;
    const all = this.supabaseProjects();
    const pending = all.filter((a) => !this.verified.has(a.projectId));
    if (!pending.length) {
      // Nothing to check yet — look again so a later "Import Credentials" is caught.
      if (!all.length) this.schedule(30000);
      return;
    }
    this.busy = true;
    try {
      for (const asset of pending) await this.ensureTable(asset);
    } finally {
      this.busy = false;
    }
  }

  async ensureTable(asset) {
    const probeUrl = `${asset.projectUrl}/rest/v1/${TABLE}?select=id&limit=0`;
    const restHeaders = { apikey: asset.publicToken, Authorization: `Bearer ${asset.publicToken}` };
    const probe = await http("GET", probeUrl, restHeaders);
    if (probe.status === 200) {
      this.verified.add(asset.projectId);
      console.log(LOG, `"${TABLE}" present in Snap Cloud project ${asset.projectId} — signaling ready.`);
      return;
    }
    if (probe.status !== 404 || !/PGRST205|could not find the table/i.test(probe.body)) {
      // Offline, expired key, paused project… — transient, retried on the next trigger.
      console.warn(LOG, `could not check ${asset.projectId}: HTTP ${probe.status} ${probe.body.slice(0, 160)}`);
      return;
    }
    if (!this.auth || Editor.isNull(this.auth) || !this.auth.isAuthorized || !this.auth.idToken) {
      console.warn(LOG, `Snap Cloud project ${asset.projectId} has no "${TABLE}" table and Lens Studio is not ` +
        `signed in — sign in (or run "supabase db push") so the Video Call S2S Lens can signal calls.`);
      return;
    }
    console.log(LOG, `Snap Cloud project ${asset.projectId} has no "${TABLE}" table — applying ` +
      "supabase/migrations/20260721000000_create_rtc_signals.sql…");
    const token = await http("POST", AUTH_URL, { "Content-Type": "application/json" },
      JSON.stringify({ id_token: this.auth.idToken, provider: "custom:specs" }));
    if (token.status !== 200 && token.status !== 201) {
      console.error(LOG, `Snap Cloud sign-in failed: HTTP ${token.status} ${token.body.slice(0, 160)}`);
      return;
    }
    let accessToken = "";
    try { accessToken = JSON.parse(token.body).access_token || ""; } catch (e) { /* handled below */ }
    if (!accessToken) {
      console.error(LOG, "Snap Cloud sign-in returned no access token");
      return;
    }
    const apply = await http("POST", `${MANAGEMENT_API_URL}v1/projects/${asset.projectId}/database/query`,
      { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      JSON.stringify({ query: MIGRATION_SQL }));
    if (apply.status !== 200 && apply.status !== 201) {
      console.error(LOG, `migration failed: HTTP ${apply.status} ${apply.body.slice(0, 300)} — ` +
        'run "supabase db push" against this project instead.');
      return;
    }
    // PostgREST reloads its schema cache asynchronously — confirm with a few probes
    // (each is one HTTPS round trip; no timers, so this also works in one-shot runs).
    for (let attempt = 0; attempt < 6; attempt++) {
      const again = await http("GET", probeUrl, restHeaders);
      if (again.status === 200) {
        this.verified.add(asset.projectId);
        console.log(LOG, `"${TABLE}" created in ${asset.projectId} — the Lens can signal calls now ` +
          "(re-send it to the Glasses if it was already running).");
        return;
      }
    }
    console.warn(LOG, `"${TABLE}" was created in ${asset.projectId} but PostgREST has not reloaded its ` +
      "schema cache yet — it will within a minute.");
  }
}

function http(method, url, headers, body) {
  return new Promise((resolve) => {
    try {
      const request = new Network.HttpRequest();
      request.url = url;
      request.method = method === "POST" ? Network.HttpRequest.Method.Post : Network.HttpRequest.Method.Get;
      request.headers = headers;
      if (body !== undefined) {
        request.contentType = "application/json";
        request.body = body;
      }
      const reply = Network.performHttpRequestWithReply(request);
      let text = "";
      reply.onData.connect((data) => { text += data.toString(); });
      reply.onEnd.connect((result) => resolve({ status: result.statusCode, body: text }));
    } catch (e) {
      resolve({ status: -1, body: String(e) });
    }
  });
}
