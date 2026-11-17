# WebCapture troubleshooting

[← Agent usage index](../README.md)

## Use when

Read when the status Text, the plugin panel or the portal shows a problem. Symptom → cause → fix.

| Symptom | Cause | Fix |
|---|---|---|
| Status: *Lens Studio blocks ws:// URLs unless Experimental APIs are enabled* | Local mode without Experimental APIs | *Project Settings → Experimental APIs*, or use Snap Cloud mode |
| Status: *No WebCapture plugin answered at ws://127.0.0.1:47791* | The plugin isn't running in this Lens Studio window, or another app holds the port | **Window → WebCapture** → Restart Server; close the other Lens Studio window that has a Web Capture project open |
| Panel / Logger: *Could not start the portal server on port 47790* | Another Lens Studio window (or another program) uses the port | Close it, then Restart Server |
| Status: *Not connected, recording in memory* | No destination: no plugin and no Snap Cloud credentials | Fix one of the two above; the recording is still available as `WebCapture.recording` |
| Status: *Waiting for objects to capture* | Nothing registered yet (the demo stage is hidden behind the guide, or no targets / tracked objects / capture root) | Dismiss the guide, add `WebCaptureTarget` components, or call `startRecording()` when your content appears |
| Portal page: *Web Capture portal not unpacked yet* | `WebCapturePortal/` isn't at the project root | Unzip `ExtractAtProjectRoot/WebCapturePortal.zip` next to `Assets/` |
| Portal Live: *The WebCapture plugin is not answering* | Lens Studio closed, project not open, or a different address in Settings | Open the project; check Settings → Lens Studio portal address |
| Objects appear far from where you expect | Wrong Capture Origin, or a scaled origin | Set Capture Origin to your content's root (empty = the WebCapture SceneObject) |
| `[WebCapture] Duplicate capture id` | Two objects share a name | Set a unique Target Id |
| Shapes are boxes of the wrong size | The mesh is on a child of the target | Put the target on the mesh object, or set Primitive |
| Status: *Snap Cloud: … is supabase/setup.sql installed on this project?* | Backend missing | Run `setup.sql` in the SQL Editor |
| Status: *Snap Cloud sign-in failed* | Snapchat sign-in unavailable and anonymous sign-ins disabled | Enable *Authentication → Anonymous Sign-Ins* or use Auth Mode *Snapchat only* on Specs |
| Portal Snap Cloud: *Enter the Snap Cloud project URL and public key* | Settings empty | Settings → project URL + public key |
| Export: *This browser cannot record video* | No MediaRecorder | Use a recent Chrome, Edge, Firefox or Safari |
| Exported video is shorter or choppy | The tab was hidden during the real-time export | Keep the tab visible until the progress bar finishes |
| Save edits fails on a recording opened from a file | Files can't be written back from the browser | It is downloaded instead; move it into `WebCaptureRecordings/` |
| Recording's video freezes on one frame, or looks laggy | The glasses' camera stream stalled (the log says *Camera video stalled…*) so the recording holds few camera packets; the portal says where the video stops | Record again. The Lens restarts a stalled stream and a quiet warm stream; keep **Record Reference** off. If it repeats, send the Lens log (`journalctl` on the glasses, lines with `[WebCapture]`) |
| Hands in front do nothing | No hand overlaps virtual content, or too few camera frames were recorded | Tick **Show hand outline** in Edit to see detection; the cut-out only shows where a hand overlaps a virtual object |
| The portal says it is *preparing* for a long time | Lock and hand detection run in the browser | Wait for the loader; a 15 s capture takes 5–25 s |
| Schedule: *Pick a recording* | The Recordings list is empty or still loading | Open the Recordings tab once, then return |
| Schedule: a post shows *Due now* and nothing happens | The built-in engine only queues | Post the exported video yourself and press **I posted it**, or connect an engine with your own tokens |
| Start Capture seems to do nothing for a second | The button debounces double presses (1.2 s) | Press once; the label switches to *Stop Capture* |
| Every capture's video stops after about 22 frames (log: *Camera layer … frames 22* and no growth) | A camera encoder pipeline left running in the glasses' camera service by an earlier Lens session that closed without stopping its stream (the camera processor's kernel log shows `h265e: msm_vidc_qbuf: failed`) | **Reboot the glasses.** The Lens now stops its camera stream when it closes; a Lens that is killed (for example by a re-push while recording) can still leave one behind |
