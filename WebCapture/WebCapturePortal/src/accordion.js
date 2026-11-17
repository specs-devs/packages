// SPECS Inc. 2027
// Collapsible sections for a side panel. Every <section data-acc="key"> under `root` gets its <h3> turned into a
// header button (chevron, aria-expanded) and its other children wrapped in a body that folds. `data-open` marks the
// sections open by default; what the user opens or closes is remembered per key in this browser.

const KEY = "webcapture.acc.";

function remembered(key, fallback) {
  try {
    const v = localStorage.getItem(KEY + key);
    return v === null ? fallback : v === "1";
  } catch (e) {
    return fallback;
  }
}

function remember(key, open) {
  try {
    localStorage.setItem(KEY + key, open ? "1" : "0");
  } catch (e) {
    /* private window: the state lasts for this page only */
  }
}

export function setOpen(section, open, save = true) {
  section.classList.toggle("open", open);
  const head = section.querySelector(":scope > .acc-head");
  if (head) head.setAttribute("aria-expanded", open ? "true" : "false");
  if (save) remember(section.dataset.acc, open);
}

/** Turns the sections under `root` into collapsibles and adds an expand / collapse-all bar on top. */
export function mountAccordion(root) {
  const sections = [...root.querySelectorAll(":scope > section[data-acc]")];
  for (const section of sections) {
    const title = section.querySelector(":scope > h3");
    if (!title || section.querySelector(":scope > .acc-head")) continue;
    const head = document.createElement("button");
    head.type = "button";
    head.className = "acc-head";
    const label = document.createElement("span");
    label.className = "acc-title";
    while (title.firstChild) label.appendChild(title.firstChild);
    const chevron = document.createElement("span");
    chevron.className = "acc-chevron";
    chevron.setAttribute("aria-hidden", "true");
    head.append(label, chevron);
    const body = document.createElement("div");
    body.className = "acc-body";
    title.remove();
    while (section.firstChild) body.appendChild(section.firstChild);
    section.append(head, body);
    section.classList.add("acc");
    head.onclick = () => setOpen(section, !section.classList.contains("open"));
    setOpen(section, remembered(section.dataset.acc, section.hasAttribute("data-open")), false);
  }
  const bar = document.createElement("div");
  bar.className = "acc-bar";
  const mk = (text, open) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ghost sm";
    b.textContent = text;
    b.onclick = () => sections.forEach((s) => setOpen(s, open));
    return b;
  };
  bar.append(mk("Expand all", true), mk("Collapse all", false));
  root.prepend(bar);
  return {sections};
}
