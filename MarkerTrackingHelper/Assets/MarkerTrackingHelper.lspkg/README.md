![MarkerTrackingHelper](AssetImage/MarkerTrackingHelper.png)

# Marker Tracking Helper

An image tracking utility that extends MarkerTrackingComponent functionality for world-space AR experiences. This package provides marker detection callbacks, world tracking integration, and automatic parent reparenting for persistent marker-based content.

## Features

- **Extended Marker Tracking**: Enhance MarkerTrackingComponent with world tracking
- **Marker Found Callbacks**: React to marker detection events
- **World Space Persistence**: Reparent content to world space after detection
- **DeviceTracking Integration**: Ensure proper world tracking mode setup
- **Delayed Reparenting**: Configurable delay for stable placement
- **Simple Image Tracking**: Streamlined setup for basic marker use cases

## Quick Start

Set up marker tracking with world space persistence:

```typescript
import {ExtendMarkerTrackingController} from "MarkerTrackingHelper.lspkg/Scripts/ExtendedMarkerTracking";

@component
export class MarkerSetup extends BaseScriptComponent {
  @input markerTrackingComp: MarkerTrackingComponent;
  @input contentParent: SceneObject;

  onAwake() {
    const extendedTracking = this.sceneObject.createComponent("ExtendMarkerTrackingController");
    extendedTracking.markerTrackingComponent = this.markerTrackingComp;
    extendedTracking.parentObject = this.contentParent;

    // Marker found event is automatically handled
  }
}
```

## Script Highlights

### ExtendedMarkerTracking.ts
Extends MarkerTrackingComponent functionality by integrating with DeviceTracking in World mode. Validates that the camera has DeviceTrackingComponent with World tracking enabled and sets up the marker tracking parent hierarchy correctly. When a marker is found, creates a new parent object in world space and reparents the content to it with preserved world transform after a configurable delay (default 0.5 seconds). This allows marker-detected content to persist in world space independent of marker visibility.

### SimpleImageTracking.ts
Provides a streamlined interface for basic image marker tracking without world space persistence. Simplifies marker detection by handling the MarkerTrackingComponent setup and providing straightforward onMarkerFound/onMarkerLost callbacks. Ideal for experiences where content should remain attached to the marker rather than persisting in world space.

### ImageTrackingController.ts
Centralized controller for managing multiple image markers with state tracking. Monitors marker tracking status for multiple markers simultaneously and provides callbacks for each marker's found/lost events. Includes helper utilities for enabling/disabling specific markers at runtime and querying current tracking state.

## Core API Methods

```typescript
// Extended tracking setup
markerTrackingComponent: MarkerTrackingComponent
parentObject: SceneObject

// Marker events
onMarkerFound(): void
onMarkerLost(): void

// Utilities
getRootCamera(): SceneObject
validateWorldTracking(): boolean
```

## Advanced Usage

### Multi-Marker Experience

Track multiple markers with unique content:

```typescript
@component
export class MultiMarkerTracker extends BaseScriptComponent {
  @input markers: MarkerTrackingComponent[];
  @input contentPrefabs: ObjectPrefab[];

  private markerContents: Map<MarkerTrackingComponent, SceneObject> = new Map();

  onAwake() {
    this.markers.forEach((marker, index) => {
      const extendedTracking = this.sceneObject.createComponent("ExtendMarkerTrackingController");
      extendedTracking.markerTrackingComponent = marker;

      // Create unique content for this marker
      const content = this.contentPrefabs[index].instantiate(this.sceneObject);
      extendedTracking.parentObject = content;

      this.markerContents.set(marker, content);

      marker.onMarkerFound = () => {
        print(`Marker ${index} detected!`);
        this.onMarkerDetected(index);
      };

      marker.onMarkerLost = () => {
        print(`Marker ${index} lost`);
      };
    });
  }

  onMarkerDetected(markerIndex: number) {
    // Custom logic per marker
    print(`Activating experience ${markerIndex}`);
  }
}
```

## Built with 👻 by the Spectacles team

