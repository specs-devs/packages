# SnapCloudExamples examples

[← Agent usage index](../README.md)

## Use when

Read for offline examples of the actual public contracts.

## Check assigned configuration without connecting

This method checks the cached presence flag; it does not authenticate, print credentials or prove backend health. Requirements itself validates on Awake.

```typescript
import {SnapCloudRequirements} from "SnapCloudExamples.lspkg/SnapCloudRequirements";
export function hasAssignedCloudProject(requirements: SnapCloudRequirements): boolean {
  return requirements.isConfigured();
}
```

## Produce a local leaderboard row

The public UI shape is independent of the network. Passing it to an existing row item's bind() updates local Text components only.

```typescript
import {LeaderboardEntryUI} from "SnapCloudExamples.lspkg/Example6-GlobalLeaderboard/Scripts/LeaderboardRowItem";
export function localScoreRow(displayname: string, score: number): LeaderboardEntryUI {
  return {rank: 1, displayname, score};
}
```

## Select an already initialized media section

This changes enabled SceneObjects; enabling a configured backend component may run its lifecycle. Inspect disabled/unconfigured content for a local-only QA pass.

```typescript
import {UISectionManager} from "SnapCloudExamples.lspkg/Example5-Media/Scripts/UISectionManager";
export function selectMediaSection(manager: UISectionManager, index: number): number {
  manager.switchToSectionManually(index);
  return manager.getActiveSectionIndex();
}
```

These small snippets are compile-checked against installed ambient/dependency declarations. They were not run. They do not establish full source compile/visual/backend correctness. Main prefab path and other prefabs are listed in [setup](setup.md).
