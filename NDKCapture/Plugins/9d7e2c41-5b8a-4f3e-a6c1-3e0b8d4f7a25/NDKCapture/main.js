// SPECS Inc. 2027
// NDK Capture Lens Studio plugin.
//   NDKCaptureService (starts with the project): runs the local Studio server, see StudioServer.js.
//   NDKCapturePanel (Window → NDKCapture): status, Open Studio, recordings folder, Record / Mark / Stop, LAN switch.
import {CoreService} from "LensStudio:CoreService";
import PanelPlugin from "LensStudio:PanelPlugin";
import * as Shell from "LensStudio:Shell";
import * as Ui from "LensStudio:Ui";
import {HTTP_PORT, StudioServer, WS_PORT} from "./StudioServer.js";

// One server per Lens Studio window, shared by the service and the panel.
const shared = {server: null, model: null};

function projectDir() {
  if (!shared.model || !shared.model.project) return "";
  const assets = shared.model.project.assetManager.assetsDirectory.toString();
  return assets.replace(/[\\/]Assets[\\/]?$/, "");
}

export class NDKCaptureService extends CoreService {
  static descriptor() {
    return {
      id: "Com.Snap.NDKCapture.Service",
      name: "NDK Capture Service",
      description:
        "Local NDK Capture Studio server (http://127.0.0.1:" +
        HTTP_PORT +
        ") and Lens socket (port " +
        WS_PORT +
        ")"
    };
  }

  start() {
    shared.model = this.pluginSystem.findInterface(Editor.Model.IModel);
    if (!shared.server)
      shared.server = new StudioServer(
        () => projectDir(),
        (m) => console.log("[NDKCapture] " + m)
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

export class NDKCapturePanel extends PanelPlugin {
  static descriptor() {
    return {
      id: "Com.Snap.NDKCapture.Panel",
      name: "NDKCapture",
      description: "Open the NDK Capture Studio, see connected Lenses and recordings",
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
      '<b>NDK Capture</b> · Studio <a href="http://127.0.0.1:' +
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
    open.text = "Open Studio";
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
      if (shared.server) shared.server.sendCommand("startRecording", {});
      this.refresh();
    });
    rec.addWidget(start);
    const stop = new Ui.PushButton(recWidget);
    stop.text = "Stop & Save";
    stop.onClick.connect(() => {
      if (shared.server) shared.server.sendCommand("stopRecording", {});
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
    const mark = new Ui.PushButton(recWidget);
    mark.text = "Mark";
    mark.onClick.connect(() => {
      if (shared.server) shared.server.sendCommand("marker", {label: "Marker"});
    });
    rec.addWidget(mark);
    const lan = new Ui.PushButton(recWidget);
    lan.text = "Accept Specs on my network";
    lan.onClick.connect(() => {
      if (!shared.server) return;
      shared.server.lan = !shared.server.lan;
      shared.server.start();
      lan.text = shared.server.lan ? "Local only" : "Accept Specs on my network";
      this.refresh();
    });
    rec.addWidget(lan);
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
      this.statusLabel.text = "The NDK Capture service is not running. Reopen the project.";
      return;
    }
    const st = s.status();
    const lines = [];
    lines.push(s.running ? "Server running." : "Server stopped.");
    lines.push(
      st.studioInstalled
        ? "Studio files: NDKCaptureStudio/"
        : '<span style="color:#f5a524">Unzip ExtractAtProjectRoot/NDKCaptureStudio.zip at the project root to install the Studio.</span>'
    );
    lines.push(
      st.lenses.length
        ? "Connected Lens: " + st.lenses.map((l) => l.lens).join(", ")
        : "No Lens connected (press Play; local ws:// needs Experimental APIs)."
    );
    if (st.recording) lines.push("Recording " + st.recording.id);
    if (st.saved.length) lines.push("Last saved: " + st.saved[0].id);
    lines.push(st.lan ? "Accepting Specs on this network (port " + WS_PORT + ")." : "Local only (127.0.0.1).");
    if (st.errors.length) lines.push('<span style="color:#f87171">' + st.errors[0].message + "</span>");
    this.statusLabel.text = lines.join("<br>");
  }
}
