# WebSocketExamples troubleshooting

[← Agent usage index](../README.md)

## Use when

Interpret setup failures, stale callbacks and transform behavior for this exact revision.

| Symptom | Source cause | Action/check |
|---|---|---|
| Fresh sample cannot connect | Placeholder URL and external server requirement | Set both URLs and run an owned server; no out-of-box network success expected. |
| IMU status reads `Setup required - set IP Address (see README)`; Logger shows `Cannot connect: 'IP Address' is still the placeholder` | Both scripts still have `ws://YOUR-IP-ADDRESS/ws`; connect returns before creating a socket | Set each script's `ipAddress` to your server (e.g. `ws://192.168.1.100/ws`). |
| Text Echo shows nothing in the Lens | TextEcho has no visuals; results are Logger prints | Watch the Logger for `Message 1` / `Message 2` echoes (needs TextEcho `enableLogging`, which the prefab ships on). |
| Awake assertion fails | Missing InternetModule, IMU Text or cube | Assign exact handles before lifecycle; do not cast unrelated ScriptComponent. |
| No retry after error/disconnect | No automatic reconnection timer | Explicit reconnect through deliberate user action. |
| Status is undefined before connection | `socket && readyState===1` can return undefined | Use truthiness/readiness, not strict boolean guarantees. |
| Binary Message 2 absent | Arduino echo handles only WStype_TEXT | Use a binary-capable server for binary receive QA; do not call Arduino absence a Lens failure. |
| Invalid sensor text rotates cube | parseFloat accepts numeric prefix; Infinity not NaN | Validate finite complete numeric fields at producer or authorized parser extension. |
| CSV spaces accepted | parseFloat trims leading whitespace | Original tutorial's no-spaces rule is stronger than source parser. |
| IMU yaw/axes feel swapped | Arduino emits X,Z,Y and receiver forwards unchanged as Euler X,Y,Z | Deliberately map axes/handedness against actual hardware; no built-in calibration. |
| Cube rotation snaps | Rotation is set immediately on message | Only camera-follow position lerps; rotation smoothing is not implemented. |
| Rotation query differs from sent angles | Quaternion→Euler normalization/wrapping | Compare orientation, not exact angle array equality. |
| Query ignores external transform edits | getCurrentRotation reads desired quaternion | Do not treat it as measured current world orientation. |
| Cube follows after moving carousel | camObj enables independent world follower | Leave camera null for authored/carousel position; otherwise expect 50cm follow override. |
| Cube overshoots after long frame | Raw lerp factor delta*6 not clamped | Observe low-FPS behavior; fix only in later authorized runtime work. |
| Hidden carousel entry stays connected | No OnDisable cleanup, only OnDestroy | Test switching/re-enable, socket ownership and callbacks explicitly. |
| Old socket updates new status/data | reconnect closes without detaching old handlers; async Blob conversion unguarded | Test reconnect/destroy races; future source fix can generation-guard/detach callbacks. |
| Async binary error unhandled | Blob conversion awaits without local rejection handling | Inspect genuine logs; current try/catch only surrounds creation/send/rotation. |
| Cube sat at the user's head (inside the camera) with the status text inside the cube | Older prefab authored IMU at the origin and Text at the cube's center | Fixed in this revision: IMU at local (0,0,−80), Text at (0,−10,0). Re-instantiate an old scene instance to pick it up. |
| Old scene instance still shows a `Guide_ReadAndDisable` note | Stale instance of an earlier prefab | Replace the instance with a fresh one from `WebSocketExamples__PLACE_IN_SCENE.prefab`. |
| ESP32 unreachable despite Wi-Fi changes | Arduino static IP config is active, not optional commented-out DHCP | Configure matching subnet/gateway/DNS deliberately; don't retain developer-local addresses. |

Verified in the Lens Studio Preview (demo project, placeholder URLs): clean compile, both examples start without runtime errors, setup messages as above, cube + status line visible in front of the user. Not verified: a real echo/IMU server, binary echo, reconnect, board flash or sensor axes — they need your own server or hardware.
