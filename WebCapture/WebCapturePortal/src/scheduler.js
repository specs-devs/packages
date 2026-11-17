// SPECS Inc. 2027
// Scheduler data model: no DOM, no network, no credentials, so it runs (and is tested) in Node too.
//
// A plain social scheduling model: platforms, caption limits, per-platform formats, post/target statuses and
// validation, so a queue made here can be handed to a publishing engine later.
//
// What is different: nothing here publishes. The queue lives in the browser (see createStore) and a pluggable *engine*
// decides what "schedule" means. The built-in `manualEngine` only queues (you post by hand and record the link); to
// publish for real, write an engine with the same four methods (see the Engine contract below) and pass it to the UI.
//
// Engine contract:
//   { name: string,
//     schedule(post) -> Promise<{jobId: string}>      accept a reviewed post for its runAt
//     cancel(post)   -> Promise<void>
//     poll(posts)    -> Promise<{[jobId]: EngineJob}> optional; EngineJob as `applyEngineJob` reads it }

export const SCHEDULER_PLATFORMS = ["tiktok", "x", "youtube", "instagram", "snapchat", "linkedin", "reddit"];

export const PLATFORM_LABELS = {
  tiktok: "TikTok",
  x: "X",
  youtube: "YouTube Shorts",
  instagram: "Instagram Reels",
  snapchat: "Snapchat Spotlight",
  linkedin: "LinkedIn",
  reddit: "Reddit"
};

/** Caption limits in characters (the engine prompts with the same numbers). A Reddit video post shows only its title. */
export const CAPTION_LIMITS = {tiktok: 2200, x: 280, youtube: 5000, instagram: 2200, snapchat: 160, linkedin: 3000, reddit: 300};

/**
 * What each feed shows best: the shape, the portal's output preset that makes it, a length that keeps viewers and the hard
 * limit of the platform. "Open in editor" jumps to the preset.
 */
export const PLATFORM_FORMATS = {
  tiktok: {aspect: "9:16", preset: "social916", bestSec: 60, limitSec: 600, why: "Full-screen vertical; under a minute keeps the watch-through."},
  youtube: {aspect: "9:16", preset: "social916", bestSec: 60, limitSec: 180, why: "A Short must be vertical and at most 3 minutes."},
  instagram: {aspect: "9:16", preset: "social916", bestSec: 90, limitSec: 900, why: "Reels are full-screen vertical; up to 90 s is the sweet spot."},
  snapchat: {aspect: "9:16", preset: "social916", bestSec: 60, limitSec: 60, why: "Spotlight is vertical and caps at 60 s."},
  x: {aspect: "1:1", preset: "square1080", bestSec: 60, limitSec: 140, why: "Square fills the timeline on phone and desktop; X caps at 140 s."},
  linkedin: {aspect: "4:5", preset: "social45", bestSec: 90, limitSec: 1800, why: "The feed shows 4:5 without cropping; short clips do best."},
  reddit: {aspect: "4:5", preset: "social45", bestSec: 60, limitSec: 900, why: "The feed crops tall video; 4:5 shows it whole. Only the title shows, so the caption is the title."}
};

export const POST_STATUSES = ["review", "scheduled", "posting", "posted", "partial", "failed", "cancelled"];
export const POST_STATUS_LABELS = {
  review: "Needs review",
  scheduled: "Scheduled",
  posting: "Posting",
  posted: "Posted",
  partial: "Partly posted",
  failed: "Failed",
  cancelled: "Cancelled"
};

export const MAX_POSTS = 200;
export const SLOT_LEAD_MINUTES = 15;

const isRecord = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v) => (typeof v === "string" ? v.trim() : "");
const oneOf = (options, v, fallback) => (options.includes(str(v)) ? str(v) : fallback);

export function emptyTarget(caption = "", enabled = false) {
  return {enabled, caption, status: "pending", url: "", error: "", postedAt: ""};
}

/** A new post for a recording, every platform off until the author ticks it. */
export function newPost(init) {
  const targets = {};
  for (const p of SCHEDULER_PLATFORMS) targets[p] = emptyTarget();
  return {
    id: init.id || "post-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    recordingKey: str(init.recordingKey),
    recordingSource: str(init.recordingSource),
    videoName: str(init.videoName),
    durationSec: typeof init.durationSec === "number" ? init.durationSec : null,
    title: "",
    runAt: init.runAt || suggestedSlot(),
    status: "review",
    approvedBy: "",
    approvedAt: "",
    jobId: "",
    targets,
    error: "",
    createdAt: new Date().toISOString(),
    exportedPresets: []
  };
}

function parseTarget(v) {
  const t = isRecord(v) ? v : {};
  return {
    enabled: t.enabled === true,
    caption: typeof t.caption === "string" ? t.caption.trim() : "",
    status: oneOf(["pending", "posted", "failed"], t.status, "pending"),
    url: str(t.url),
    error: str(t.error),
    postedAt: str(t.postedAt)
  };
}

function parsePost(value, index) {
  const v = isRecord(value) ? value : {};
  const id = str(v.id);
  if (!id) throw new Error("Scheduled post " + (index + 1) + " needs an id.");
  const runAt = str(v.runAt);
  if (!Number.isFinite(Date.parse(runAt))) throw new Error("Scheduled post " + id + " needs a valid time.");
  const raw = isRecord(v.targets) ? v.targets : {};
  const targets = {};
  for (const p of SCHEDULER_PLATFORMS) targets[p] = parseTarget(raw[p]);
  return {
    id,
    recordingKey: str(v.recordingKey),
    recordingSource: str(v.recordingSource),
    videoName: str(v.videoName),
    durationSec: typeof v.durationSec === "number" && Number.isFinite(v.durationSec) ? v.durationSec : null,
    title: str(v.title),
    runAt,
    status: oneOf(POST_STATUSES, v.status, "review"),
    approvedBy: str(v.approvedBy),
    approvedAt: str(v.approvedAt),
    jobId: str(v.jobId),
    targets,
    error: str(v.error),
    createdAt: str(v.createdAt),
    exportedPresets: Array.isArray(v.exportedPresets) ? v.exportedPresets.filter((x) => typeof x === "string") : []
  };
}

/** Strict about what would lose a post (ids, times, duplicates), lenient about the rest. */
export function parseQueue(value) {
  if (!isRecord(value)) throw new Error("Scheduler data is invalid.");
  const posts = (Array.isArray(value.posts) ? value.posts : []).map(parsePost);
  const ids = new Set();
  for (const post of posts) {
    if (ids.has(post.id)) throw new Error('Duplicate scheduled post id "' + post.id + '".');
    ids.add(post.id);
  }
  if (posts.length > MAX_POSTS) throw new Error("At most " + MAX_POSTS + " scheduled posts are kept.");
  return {updatedAt: str(value.updatedAt), posts};
}

/** A readable name for a queued post: its title, else the recording's name. */
export const postDisplay = (post) => post.title || post.videoName || "Untitled post";

export const enabledPlatforms = (post) => SCHEDULER_PLATFORMS.filter((p) => post.targets[p].enabled);
export const platformsToPost = (post) => enabledPlatforms(post).filter((p) => post.targets[p].status !== "posted");

/** Characters as a reader counts them (an emoji is one). */
export const captionLength = (caption) => [...caption].length;

/** What stops a post from being scheduled; empty = ready. */
export function scheduleProblems(post, now = Date.now()) {
  const problems = [];
  const platforms = enabledPlatforms(post);
  if (!post.recordingKey && !post.videoName) problems.push("Pick a recording.");
  if (platforms.length === 0) problems.push("Pick at least one platform.");
  for (const p of platforms) {
    const caption = post.targets[p].caption;
    if (!caption.trim()) problems.push(PLATFORM_LABELS[p] + " needs a caption.");
    else if (captionLength(caption) > CAPTION_LIMITS[p]) problems.push(PLATFORM_LABELS[p] + " caption is over " + CAPTION_LIMITS[p] + " characters.");
    const f = PLATFORM_FORMATS[p];
    if (post.durationSec && post.durationSec > f.limitSec) problems.push(PLATFORM_LABELS[p] + " takes at most " + f.limitSec + " s; the clip is " + Math.round(post.durationSec) + " s.");
  }
  if (platforms.includes("youtube") && !post.title.trim()) problems.push("YouTube Shorts needs a title.");
  const at = Date.parse(post.runAt);
  if (!Number.isFinite(at)) problems.push("Pick a time.");
  else if (at <= now) problems.push("The time is in the past.");
  return problems;
}

/** Notes that do not block scheduling (a clip longer than the sweet spot). */
export function scheduleNotes(post) {
  const notes = [];
  for (const p of enabledPlatforms(post)) {
    const f = PLATFORM_FORMATS[p];
    if (post.durationSec && post.durationSec > f.bestSec && post.durationSec <= f.limitSec) notes.push(PLATFORM_LABELS[p] + " does best under " + f.bestSec + " s.");
  }
  return notes;
}

/** The distinct output presets the ticked platforms want, e.g. ["social916", "square1080"]. */
export function presetsFor(post) {
  return [...new Set(enabledPlatforms(post).map((p) => PLATFORM_FORMATS[p].preset))];
}

export function toLocalInput(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + "T" + pad(date.getHours()) + ":" + pad(date.getMinutes());
}

/** 15 minutes from now, to the next whole minute, as a `datetime-local` value. */
export function suggestedSlot(now = new Date()) {
  const slot = new Date(now.getTime() + SLOT_LEAD_MINUTES * 60000);
  if (slot.getSeconds() || slot.getMilliseconds()) slot.setMinutes(slot.getMinutes() + 1, 0, 0);
  return toLocalInput(slot);
}

/** Newest run time first, capped. What a save writes back. */
export function upsertPost(queue, post) {
  const posts = [post, ...queue.posts.filter((p) => p.id !== post.id)]
    .sort((a, b) => Date.parse(b.runAt) - Date.parse(a.runAt))
    .slice(0, MAX_POSTS);
  return {...queue, posts};
}

export function removePost(queue, id) {
  return {...queue, posts: queue.posts.filter((p) => p.id !== id)};
}

/** Which queue section a post sits in. */
export function queueSection(status) {
  return status === "review" ? "review" : status === "posted" || status === "partial" ? "posted" : "scheduled";
}

/** A scheduled post whose time has come: with the manual engine this is the cue to post it by hand. */
export const isDue = (post, now = Date.now()) => post.status === "scheduled" && Date.parse(post.runAt) <= now;

/** A row's status from its targets once results are in. */
export function statusFromTargets(post) {
  const platforms = enabledPlatforms(post);
  const posted = platforms.filter((p) => post.targets[p].status === "posted").length;
  const failed = platforms.filter((p) => post.targets[p].status === "failed").length;
  if (posted + failed < platforms.length) return "posting";
  if (failed === 0) return "posted";
  return posted === 0 ? "failed" : "partial";
}

/** Records the outcome of one platform (what a manual "I posted it" or an engine result does). */
export function setTargetResult(post, platform, result) {
  const targets = {...post.targets};
  const ok = !!result.ok;
  targets[platform] = {
    ...targets[platform],
    status: ok ? "posted" : "failed",
    url: ok ? str(result.url) : "",
    error: ok ? "" : str(result.error) || "Failed.",
    postedAt: result.at || new Date().toISOString()
  };
  const next = {...post, targets};
  next.status = statusFromTargets(next);
  next.error = next.status === "posted" ? "" : next.error;
  return next;
}

/** A finished post with a platform that failed can go back to review and try again. */
export const canRetry = (post) =>
  (post.status === "partial" || post.status === "failed") && enabledPlatforms(post).some((p) => post.targets[p].status === "failed");

/** Back to review with only the failed platforms left to post; what went up keeps its link. */
export function retryFailed(post) {
  const targets = {...post.targets};
  for (const p of enabledPlatforms(post)) {
    if (targets[p].status === "failed") targets[p] = {...targets[p], status: "pending", error: "", url: "", postedAt: ""};
  }
  return {...post, targets, status: "review", jobId: "", error: "", approvedAt: ""};
}

/** Folds an engine job (see the Engine contract above) into a row. Same object back when nothing changed. */
export function applyEngineJob(post, job) {
  let next = post;
  const set = (patch) => {
    next = {...next, ...patch};
  };
  if (job.runAt && job.runAt !== post.runAt && job.status === "pending") set({runAt: job.runAt});
  if (job.status === "cancelled" && post.status !== "cancelled") set({status: "cancelled"});
  if (job.status === "running" && post.status === "scheduled") set({status: "posting"});
  if (job.status === "failed" && (job.results || []).length === 0 && post.status !== "failed") {
    set({status: "failed", error: job.error || "The engine could not publish this post."});
  }
  const results = job.results || [];
  if (results.length) {
    const targets = {...next.targets};
    let changed = false;
    for (const r of results) {
      if (!SCHEDULER_PLATFORMS.includes(r.platform)) continue;
      const cur = targets[r.platform];
      const status = r.ok ? "posted" : "failed";
      const url = r.url || "";
      const error = r.ok ? "" : r.error || "Failed.";
      if (cur.status !== status || cur.url !== url || cur.error !== error) {
        targets[r.platform] = {...cur, status, url, error, postedAt: job.finishedAt || cur.postedAt};
        changed = true;
      }
    }
    if (changed) set({targets});
    const status = statusFromTargets(next);
    if (status !== next.status) set({status, error: status === "posted" ? "" : next.error});
  }
  if (job.status === "pending" && next.status !== "scheduled") set({status: "scheduled"});
  return next;
}

/**
 * The brand is SPECS and captions carry no hashtags. Applied on request, never silently.
 */
export function brandCaption(text) {
  return text
    .split("\n")
    .map((line) =>
      line
        .replace(/(^|\s)#shorts\b/giu, "$1")
        .replace(/(^|\s+)#[\p{L}\p{N}_]+(\s+#[\p{L}\p{N}_]+)+\s*$/u, "")
        .replace(/^\s*#[\p{L}\p{N}_]+\s*$/u, "")
        .replace(/(^|[^\p{L}\p{N}_&/])#([\p{L}\p{N}_]+)/gu, "$1$2")
        .trimEnd()
    )
    .join("\n")
    .replace(/\bSnap\s+Spectacles\b/gi, "SPECS")
    .replace(/(^|[^/\p{L}])Spectacles\b/gu, "$1SPECS")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---- engines ---------------------------------------------------------------

/** Queues only: no network, no accounts. At the post's time it shows as due; you post by hand and record the link. */
export const manualEngine = {
  name: "Manual (no accounts)",
  async schedule(post) {
    return {jobId: "manual-" + post.id};
  },
  async cancel() {},
  async poll() {
    return {};
  }
};

/** Approve and hand to the engine. Resolves with the updated post; engine errors leave it in review with the message. */
export async function approvePost(post, engine, who = "", now = Date.now()) {
  const problems = scheduleProblems(post, now);
  if (problems.length) throw new Error(problems[0]);
  try {
    const {jobId} = await engine.schedule(post);
    return {...post, status: "scheduled", jobId, approvedBy: who, approvedAt: new Date(now).toISOString(), error: ""};
  } catch (e) {
    return {...post, status: "review", error: e && e.message ? e.message : String(e)};
  }
}

export async function cancelPost(post, engine) {
  if (post.jobId) await engine.cancel(post);
  return {...post, status: "cancelled"};
}

// ---- storage ---------------------------------------------------------------

export const QUEUE_KEY = "webcapture.scheduler.v1";

/** The queue in a Storage-like object (localStorage in the browser, a Map wrapper in tests). Never throws. */
export function createStore(storage) {
  return {
    load() {
      try {
        const raw = storage.getItem(QUEUE_KEY);
        return raw ? parseQueue(JSON.parse(raw)) : {updatedAt: "", posts: []};
      } catch (e) {
        return {updatedAt: "", posts: []};
      }
    },
    save(queue) {
      const next = {...queue, updatedAt: new Date().toISOString()};
      try {
        storage.setItem(QUEUE_KEY, JSON.stringify(next));
      } catch (e) {
        /* private window or full storage: the queue lives for this page only */
      }
      return next;
    }
  };
}

/** Whole queue as a file (hand it to a teammate or to a real engine) and back. */
export const exportQueue = (queue) => JSON.stringify({format: "webcapture-schedule/1", ...queue}, null, 2);
export const importQueue = (text) => parseQueue(JSON.parse(text));
