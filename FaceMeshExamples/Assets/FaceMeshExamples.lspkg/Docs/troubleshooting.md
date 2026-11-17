# FaceMeshExamples troubleshooting

[← Agent usage index](../README.md)

| Symptom | Cause | Fix |
| --- | --- | --- |
| The head never goes on my face | Specs' camera faces outward: it tracks people in front of you, not the wearer | Look at someone else, 0.5–2 m away |
| The head stays on the stage in front of me | No face is tracked (too far, too dark, side profile) | Face the person; good light; under ~2 m |
| The head follows the face but doesn't animate | The head has no shape keys with Lens `Expressions` names, or it isn't in `FaceMeshExamplesExpressionDriver.heads` | Rig it with the [tools](how-heads-were-made.md) and add its visual to `heads` |
| Expressions are weak or noisy | Calibration hasn't seen the person's range yet, or `gain` / `responsiveness` too low | Let the person talk for a few seconds; raise `gain`; raise `minRange` if it's noisy |
| Head jitters when the person is still | Stabilization too loose | Lower `minCutoff` on FaceMeshExamplesHeadController |
| Head lags when the person moves | Stabilization too tight | Raise `speedResponse` |
| A dark band hides the chin | Fade too high | Panel **Fade −**, or lower `fadeAmount` |
| Face tracking never starts | `HeadAnchor` (the Head binding) isn't under the camera | Leave `FaceMeshExamplesMain.headAnchor` wired; it reparents at start |
| Waving doesn't switch heads | Hands not tracked, swings too small or too slow | Wave wider and faster (3 reversals within 1.2 s); in the preview press **W** |
| The panel is in the way | It follows below your view | Tune `FaceMeshExamplesPanelFollow.heightCm` / `distanceCm` |
