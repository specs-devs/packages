# ReachyReceiver cheat sheet

[← Agent usage index](../README.md)

## Use when

Read first before using the controllers or adapting the prefab.

1. Use the wired prefab or actual typed component creation. Historical bare ScriptComponent casts are not setup. → [Prefab](examples.md#prefab-setup)
2. Daemon singleton is assigned on Start; `isReady()` means connected socket, not a health response. Use checkConnection for health. → [Daemon](components.md#daemoninterface)
3. `setBaseUrl(url)` ignores its argument and routes to COMPUTER_IP:8001/ws. Use `setWebSocketUrl()` deliberately after Start when a direct URL is needed. → [API status](api-status.md)
4. Mini's input fields are private in TypeScript. Configure through Inspector and public setStateFromUI(true=Idle,false=LookAtTarget), not casts. → [Mini](components.md#reachyminicontroller)
5. Idle starts on Start and can issue neutral/recorded-move commands once connected. Disconnected first start can leave no move UUID/retry. → [Troubleshooting](troubleshooting.md)
6. UIManager initializes UIController and controls its own five panels. Keep a QA carousel from separately toggling these panel roots. → [UIManager](components.md#reachyuimanager)
7. Tracking panel switches: `trackingModeSwitch` = "Idle vs Look at" (off = Idle, on = LookAtTarget); `enableSimulationSwitch` / `enableReachySwitch` = the "Enable Simulation" / "Enable Real Robot" pair in `robotModeToggleGroup` (one on at a time). Both mode methods still route to the same hardcoded bridge, so the pair changes no URL. → [Source gaps](api-status.md#known-source-gaps)
8. Frame visibility animation uses scale (.6 s show/.39 s hide), not position+duration animate(). Cancelled transitions can still finish their state/event work. → [Animator](components.md#uiframeanimator)
9. Look At spawns the target under `ReferenceInstantiationPositionForGrabThisReachyWillFollow`, about 29 cm above the panel centre (≈15° above eye level at 110 cm), not in front of the user. Look up to find it before reporting "no target". → [Troubleshooting](troubleshooting.md)
