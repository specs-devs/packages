// SPECS Inc. 2027
// Schedule tab: compose a post for a recording (platforms, captions, time), review it, queue it. No accounts: the default
// engine only queues. Everything is injected, so another engine or another host page can reuse this view:
//   mountScheduler(root, {recordings(): [{key, source, name, duration}], openInEditor(rec, preset), toast(msg, bad), engine, store})
import * as S from "./scheduler.js";

const el = (tag, attrs, ...kids) => {
  const n = document.createElement(tag);
  for (const k in attrs || {}) {
    if (k === "class") n.className = attrs[k];
    else if (k.startsWith("on")) n[k] = attrs[k];
    else if (attrs[k] !== false && attrs[k] != null) n.setAttribute(k, attrs[k] === true ? "" : attrs[k]);
  }
  for (const kid of kids.flat()) if (kid != null) n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return n;
};

export function mountScheduler(root, host) {
  const engine = host.engine || S.manualEngine;
  const store = host.store || S.createStore(window.localStorage);
  let queue = store.load();
  let draft = null; // the post being composed (not yet in the queue)
  let editingId = null;

  const save = (next) => {
    queue = store.save(next);
    render();
  };
  const toast = host.toast || (() => {});
  let previewPlatform = "tiktok";
  function renderPreview(root2, d, fields, host2, onChange) {
    const on = S.enabledPlatforms(d);
    if (!on.includes(previewPlatform)) previewPlatform = on[0] || previewPlatform;
    root2.replaceChildren(el("h4", null, "Preview"));
    if (!on.length) {
      root2.append(el("p", {class: "muted"}, "Tick a platform to see how the post looks on a phone."));
      return;
    }
    const tabs = el("div", {class: "sch-ptabs"});
    for (const p of on) tabs.append(el("button", {class: "ghost" + (p === previewPlatform ? " active" : ""), type: "button", onclick: () => {
      previewPlatform = p;
      renderPreview(root2, d, fields, host2, onChange);
    }}, S.PLATFORM_LABELS[p]));
    root2.append(tabs);
    const p = previewPlatform;
    const f = S.PLATFORM_FORMATS[p];
    const t = d.targets[p];
    const set = (v) => {
      t.caption = v.trim();
      if (fields[p]) {
        fields[p].caption.value = t.caption;
        fields[p].upd();
      }
      onChange();
    };
    const media = el("div", {class: "pv-media a" + f.aspect.replace(":", "x")});
    const img = el("img", {alt: "", hidden: true});
    media.append(img, el("div", {class: "pv-loading muted"}, "Rendering frame…"));
    host2.poster({key: d.recordingKey, source: d.recordingSource}, f.preset, 360).then((url) => {
      if (!media.isConnected) return;
      if (url) {
        img.src = url;
        img.hidden = false;
        media.querySelector(".pv-loading").remove();
      } else media.querySelector(".pv-loading").textContent = "No preview frame for this recording";
    });
    const caption = el("textarea", {class: "pv-caption", rows: 3, placeholder: "Write a caption…", oninput: (e) => set(e.target.value)}, t.caption);
    const count = el("div", {class: "pv-count"}, S.captionLength(t.caption) + " / " + S.CAPTION_LIMITS[p]);
    caption.addEventListener("input", () => {
      const n = S.captionLength(caption.value);
      count.textContent = n + " / " + S.CAPTION_LIMITS[p];
      count.classList.toggle("bad", n > S.CAPTION_LIMITS[p]);
    });
    const icons = (names) => el("div", {class: "pv-rail"}, names.map((n) => el("div", {class: "pv-icon"}, el("span", {class: "pv-glyph"}, n[0]), el("small", null, n[1]))));
    let screen;
    if (f.aspect === "9:16") {
      // full-screen vertical feeds: media fills the phone, caption over the bottom, actions on the right
      const handle = "@yourhandle";
      const extra = p === "youtube" ? el("input", {class: "pv-title", type: "text", placeholder: "Title", value: d.title, oninput: (e) => {
        d.title = e.target.value.trim();
        const tf = document.getElementById("schTitle");
        if (tf) tf.value = d.title;
        onChange();
      }}) : null;
      screen = el("div", {class: "pv-screen vertical"}, media,
        el("div", {class: "pv-shade"}),
        icons(p === "snapchat" ? [["♥", "12"], ["✉", ""], ["➤", "Share"]] : [["♥", "1.2K"], ["✎", "48"], ["➤", "Share"]]),
        el("div", {class: "pv-bottom"}, el("b", null, handle), extra, caption, count));
    } else {
      // feed posts: a card with the media in its shape and the caption above it
      const name = p === "x" ? "Your name  @yourhandle" : p === "linkedin" ? "Your name · SPECS" : "u/yourname";
      const extra = p === "reddit" ? null : null;
      screen = el("div", {class: "pv-screen feed " + p}, el("div", {class: "pv-card"},
        el("div", {class: "pv-who"}, el("span", {class: "pv-avatar"}), el("b", null, name)),
        caption, count, extra, media,
        el("div", {class: "pv-actions muted"}, p === "x" ? "↩ 4   ⟲ 12   ♥ 86" : p === "linkedin" ? "Like · Comment · Repost · Send" : "▲ 128 ▼   ✎ 14   ➤ Share")));
    }
    root2.append(el("div", {class: "pv-wrap"}, el("div", {class: "phone"}, el("div", {class: "phone-notch"}), screen),
      el("div", {class: "muted pv-note"}, f.why + " Edit the caption right in the preview.")));
  }

  function startDraft(rec) {
    draft = S.newPost({recordingKey: rec.key, recordingSource: rec.source, videoName: rec.name, durationSec: rec.duration});
    editingId = null;
    render();
  }

  // ---- composer
  function composer() {
    const recs = host.recordings();
    const box = el("section", {class: "sch-card"}, el("h3", null, editingId ? "Edit post" : "New post"));
    const pick = el("select", {id: "schRec"}, el("option", {value: ""}, recs.length ? "Choose a recording…" : "No recordings yet"));
    for (const r of recs) {
      const o = el("option", {value: r.source + "|" + r.key}, r.name + " · " + Math.round(r.duration || 0) + " s");
      if (draft && draft.recordingKey === r.key) o.selected = true;
      pick.append(o);
    }
    pick.onchange = () => {
      const [source, ...rest] = pick.value.split("|");
      const key = rest.join("|");
      const r = recs.find((x) => x.source === source && x.key === key);
      if (r) startDraft(r);
      else {
        draft = null;
        render();
      }
    };
    box.append(el("label", {class: "full"}, "Recording", pick));
    if (!draft) {
      box.append(el("p", {class: "muted"}, "Pick a recording to plan where it goes. Nothing is published from here: the queue keeps the plan and the captions, and a connected engine (optional) can publish it."));
      return box;
    }
    const d = draft;
    const problems = S.scheduleProblems(d);
    // time
    const when = el("input", {type: "datetime-local", id: "schWhen", value: toLocalValue(d.runAt)});
    when.oninput = () => {
      const t = new Date(when.value);
      if (Number.isFinite(t.getTime())) d.runAt = t.toISOString();
      refreshProblems();
    };
    box.append(el("label", {class: "full"}, "When", when));
    // platforms
    const list = el("div", {class: "sch-platforms"});
    const fields = {};
    for (const p of S.SCHEDULER_PLATFORMS) {
      const t = d.targets[p];
      const f = S.PLATFORM_FORMATS[p];
      const cb = el("input", {type: "checkbox", "data-platform": p, checked: t.enabled});
      const caption = el("textarea", {rows: 2, placeholder: "Caption for " + S.PLATFORM_LABELS[p], hidden: !t.enabled}, t.caption);
      const count = el("span", {class: "muted"});
      const upd = () => {
        const n = S.captionLength(caption.value);
        count.textContent = n + " / " + S.CAPTION_LIMITS[p];
        count.className = n > S.CAPTION_LIMITS[p] ? "bad" : "muted";
      };
      caption.oninput = () => {
        t.caption = caption.value.trim();
        upd();
        refreshProblems();
      };
      cb.onchange = () => {
        t.enabled = cb.checked;
        caption.hidden = !cb.checked;
        if (cb.checked) previewPlatform = p;
        refreshPreview();
        row.classList.toggle("on", cb.checked);
        refreshProblems();
      };
      upd();
      fields[p] = {caption, upd};
      const row = el(
        "div",
        {class: "sch-platform" + (t.enabled ? " on" : "")},
        el("label", {class: "sch-pname"}, cb, el("b", null, S.PLATFORM_LABELS[p]), el("span", {class: "chip", title: f.why}, f.aspect + " · ≤ " + f.limitSec + " s")),
        caption,
        el("div", {class: "sch-count"}, count, el("button", {class: "ghost", type: "button", onclick: () => {
          caption.value = S.brandCaption(caption.value);
          caption.oninput();
        }}, "SPECS style"))
      );
      list.append(row);
    }
    box.append(list);
    const preview = el("div", {class: "sch-preview"});
    const refreshPreview = () => renderPreview(preview, d, fields, host, () => refreshProblems());
    box.append(preview);
    refreshPreview();
    const title = el("input", {type: "text", id: "schTitle", placeholder: "YouTube title", value: d.title});
    title.oninput = () => {
      d.title = title.value.trim();
      refreshProblems();
    };
    box.append(el("label", {class: "full"}, "Title (YouTube Shorts)", title));
    const probs = el("ul", {class: "sch-problems", id: "schProblems"});
    function refreshProblems() {
      const now = S.scheduleProblems(d);
      probs.replaceChildren(...now.map((m) => el("li", null, m)), ...S.scheduleNotes(d).map((m) => el("li", {class: "note"}, m)));
      approve.disabled = now.length > 0;
    }
    const approve = el("button", {class: "primary", id: "schApprove", onclick: async () => {
      try {
        const who = "";
        const done = await S.approvePost(d, engine, who);
        if (done.status !== "scheduled") throw new Error(done.error);
        save(S.upsertPost(queue, done));
        draft = null;
        render();
        toast("Scheduled · " + engine.name);
      } catch (e) {
        toast(e.message, true);
      }
    }}, "Approve & schedule");
    const later = el("button", {onclick: () => {
      save(S.upsertPost(queue, d));
      draft = null;
      render();
    }}, "Save for review");
    box.append(probs, el("div", {class: "row"}, approve, later), el("p", {class: "muted"}, "Engine: " + engine.name));
    refreshProblems();
    void problems;
    return box;
  }

  // ---- queue
  function postCard(post) {
    const plats = S.enabledPlatforms(post);
    const due = S.isDue(post);
    const card = el("div", {class: "sch-post st-" + post.status + (due ? " due" : ""), "data-id": post.id});
    card.append(
      el("div", {class: "sch-head"},
        el("b", null, S.postDisplay(post)),
        el("span", {class: "badge"}, due ? "Due now" : S.POST_STATUS_LABELS[post.status])),
      el("div", {class: "muted"}, new Date(post.runAt).toLocaleString() + " · " + plats.map((p) => S.PLATFORM_LABELS[p]).join(", "))
    );
    if (post.error) card.append(el("div", {class: "bad"}, post.error));
    for (const p of plats) {
      const t = post.targets[p];
      const line = el("div", {class: "sch-target"}, el("span", null, S.PLATFORM_LABELS[p]), el("span", {class: "muted"}, t.status === "posted" ? "posted" : t.status === "failed" ? "failed: " + t.error : "waiting"));
      if (t.url) line.append(el("a", {href: t.url, target: "_blank", rel: "noreferrer"}, "open"));
      if (post.status === "scheduled" || post.status === "posting" || post.status === "failed" || post.status === "partial") {
        if (t.status !== "posted") {
          line.append(el("button", {class: "ghost", onclick: () => {
            const url = prompt("Link to the " + S.PLATFORM_LABELS[p] + " post (leave empty if it has none):", "");
            if (url === null) return;
            save(S.upsertPost(queue, S.setTargetResult(post, p, {ok: true, url})));
          }}, "I posted it"));
        }
      }
      card.append(line);
    }
    const actions = el("div", {class: "row"});
    for (const preset of S.presetsFor(post)) {
      actions.append(el("button", {class: "ghost", onclick: () => host.openInEditor({key: post.recordingKey, source: post.recordingSource}, preset)}, "Edit & export " + presetLabel(preset)));
    }
    if (post.status === "review") actions.append(el("button", {onclick: () => {
      draft = JSON.parse(JSON.stringify(post));
      editingId = post.id;
      render();
    }}, "Edit"));
    if (post.status === "scheduled") actions.append(el("button", {onclick: async () => save(S.upsertPost(queue, await S.cancelPost(post, engine)))}, "Cancel"));
    if (S.canRetry(post)) actions.append(el("button", {onclick: () => save(S.upsertPost(queue, S.retryFailed(post)))}, "Retry failed"));
    actions.append(el("button", {class: "ghost", onclick: () => {
      if (confirm("Remove this post from the queue?")) save(S.removePost(queue, post.id));
    }}, "Remove"));
    card.append(actions);
    return card;
  }

  function queueView() {
    const box = el("section", {class: "sch-card"}, el("h3", null, "Queue"));
    const sections = [["review", "Needs review"], ["scheduled", "Scheduled"], ["posted", "Posted"]];
    for (const [key, label] of sections) {
      const rows = queue.posts.filter((p) => S.queueSection(p.status) === key);
      if (!rows.length) continue;
      box.append(el("h4", null, label + " · " + rows.length), ...rows.map(postCard));
    }
    if (!queue.posts.length) box.append(el("p", {class: "muted"}, "Nothing queued yet."));
    const io = el("div", {class: "row"},
      el("button", {class: "ghost", onclick: () => download("webcapture-schedule.json", S.exportQueue(queue))}, "Export queue"),
      el("label", {class: "button ghost"}, el("input", {type: "file", accept: ".json", hidden: true, onchange: async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        try {
          const imported = S.importQueue(await f.text());
          let merged = queue;
          for (const p of imported.posts) merged = S.upsertPost(merged, p);
          save(merged);
        } catch (err) {
          toast("Could not import: " + err.message, true);
        }
      }}), "Import queue"));
    box.append(io);
    return box;
  }

  function render() {
    const form = composer();
    // the phone preview gets its own, sticky, column in the middle
    const pv = form.querySelector(".sch-preview");
    const mid = el("section", {class: "sch-card sch-midcol"}, pv || el("p", {class: "muted"}, "Pick a recording to preview it on each platform."));
    root.replaceChildren(el("div", {class: "sch-grid"}, form, mid, queueView()));
  }

  // due posts light up on their own
  setInterval(() => {
    if (!root.closest(".view") || !root.closest(".view").classList.contains("active")) return;
    if (queue.posts.some((p) => S.isDue(p)) && !root.querySelector(".due")) render();
  }, 15000);

  render();
  return {render, refresh: render, getQueue: () => queue};
}

function presetLabel(preset) {
  return {social916: "9:16", social45: "4:5", square1080: "1:1", social34: "3:4"}[preset] || preset;
}

function toLocalValue(iso) {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? S.toLocalInput(d) : "";
}

function download(name, text) {
  const a = el("a", {href: URL.createObjectURL(new Blob([text], {type: "application/json"})), download: name});
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}
