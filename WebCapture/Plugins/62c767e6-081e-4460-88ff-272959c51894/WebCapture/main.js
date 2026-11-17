// SPECS Inc. 2027
// WebCapture Lens Studio plugin.
//   WebCaptureService (starts with the project): runs the local portal server, see PortalServer.js.
//   WebCapturePanel (Window → WebCapture): status, Open Portal, recordings folder, Record / Stop.
import {CoreService} from "LensStudio:CoreService";
import PanelPlugin from "LensStudio:PanelPlugin";
import * as Shell from "LensStudio:Shell";
import * as Ui from "LensStudio:Ui";
import {HTTP_PORT, PortalServer, WS_PORT} from "./PortalServer.js";

// One server per Lens Studio window, shared by the service and the panel.
const shared = {server: null, model: null};

function projectDir() {
  if (!shared.model || !shared.model.project) return "";
  const assets = shared.model.project.assetManager.assetsDirectory.toString();
  return assets.replace(/[\\/]Assets[\\/]?$/, "");
}

export class WebCaptureService extends CoreService {
  static descriptor() {
    return {
      id: "Com.Snap.WebCapture.Service",
      name: "Web Capture Service",
      description:
        "Local Web Capture portal server (http://127.0.0.1:" +
        HTTP_PORT +
        ") and Lens socket (ws://127.0.0.1:" +
        WS_PORT +
        ")"
    };
  }

  start() {
    shared.model = this.pluginSystem.findInterface(Editor.Model.IModel);
    if (!shared.server)
      shared.server = new PortalServer(
        () => projectDir(),
        (m) => console.log("[WebCapture] " + m)
      );
    shared.server.start();
    this.guard = shared.model.onProjectChanged.connect(() => shared.server && shared.server.changed());
  }

  stop() {
    try {
      if (this.guard) this.guard.disconnect();
    } catch (e) {
      /* already disconnected */
    }
    if (shared.server) shared.server.stop();
    shared.server = null;
  }
}

export class WebCapturePanel extends PanelPlugin {
  static descriptor() {
    return {
      id: "Com.Snap.WebCapture.Panel",
      name: "WebCapture",
      description: "Open the Web Capture portal, see connected Lenses and recordings",
      dependencies: [Ui.IGui]
    };
  }

  createWidget(parent) {
    const widget = new Ui.Widget(parent);
    widget.setSizePolicy(Ui.SizePolicy.Policy.Expanding, Ui.SizePolicy.Policy.Expanding);
    const layout = new Ui.BoxLayout();
    layout.setDirection(Ui.Direction.TopToBottom);

    const title = new Ui.Label(widget);
    title.text =
      '<b>Web Capture</b> · portal <a href="http://127.0.0.1:' +
      HTTP_PORT +
      '/">http://127.0.0.1:' +
      HTTP_PORT +
      "</a>";
    title.openExternalLinks = true;
    layout.addWidget(title);

    this.statusLabel = new Ui.Label(widget);
    this.statusLabel.wordWrap = true;
    this.statusLabel.setMinimumWidth(240);
    layout.addWidget(this.statusLabel);

    const rowWidget = new Ui.Widget(widget);
    const row = new Ui.BoxLayout();
    row.setDirection(Ui.Direction.LeftToRight);
    const open = new Ui.PushButton(rowWidget);
    open.text = "Open Portal";
    open.primary = true;
    open.onClick.connect(() => Shell.openUrl("http://127.0.0.1:" + HTTP_PORT + "/", {}));
    row.addWidget(open);
    const folder = new Ui.PushButton(rowWidget);
    folder.text = "Recordings Folder";
    folder.onClick.connect(() => {
      if (!shared.server) return;
      Shell.showItemInFolder(new Editor.Path(shared.server.recordingsDir()));
    });
    row.addWidget(folder);
    rowWidget.layout = row;
    layout.addWidget(rowWidget);

    const recWidget = new Ui.Widget(widget);
    const rec = new Ui.BoxLayout();
    rec.setDirection(Ui.Direction.LeftToRight);
    const start = new Ui.PushButton(recWidget);
    start.text = "Record";
    start.onClick.connect(() => {
      if (shared.server) shared.server.sendCommand("start", {});
      this.refresh();
    });
    rec.addWidget(start);
    const stop = new Ui.PushButton(recWidget);
    stop.text = "Stop & Save";
    stop.onClick.connect(() => {
      if (shared.server) shared.server.sendCommand("stop", {});
      this.refresh();
    });
    rec.addWidget(stop);
    const restart = new Ui.PushButton(recWidget);
    restart.text = "Restart Server";
    restart.onClick.connect(() => {
      if (shared.server) shared.server.start();
      this.refresh();
    });
    rec.addWidget(restart);
    recWidget.layout = rec;
    layout.addWidget(recWidget);

    layout.addStretch(0);
    widget.layout = layout;
    if (shared.server) shared.server.onChange(() => this.refresh());
    this.refresh();
    return widget;
  }

  refresh() {
    if (!this.statusLabel) return;
    const s = shared.server;
    if (!s) {
      this.statusLabel.text = "The Web Capture service is not running. Reopen the project.";
      return;
    }
    const st = s.status();
    const lines = [];
    lines.push(s.running ? "Server running." : "Server stopped.");
    lines.push(
      st.portalInstalled
        ? "Portal files: WebCapturePortal/"
        : '<span style="color:#f5a524">Unzip ExtractAtProjectRoot/WebCapturePortal.zip at the project root to install the portal.</span>'
    );
    lines.push(
      st.lenses.length
        ? "Connected Lens: " + st.lenses.map((l) => l.lens).join(", ")
        : "No Lens connected (press Play; the project needs Experimental APIs for Local mode)."
    );
    if (st.saved.length) lines.push("Last saved: " + st.saved[0].file);
    if (st.errors.length) lines.push('<span style="color:#f87171">' + st.errors[0].message + "</span>");
    this.statusLabel.text = lines.join("<br>");
  }
}
