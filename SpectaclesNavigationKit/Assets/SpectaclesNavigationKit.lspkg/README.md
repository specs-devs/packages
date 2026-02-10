![SpectaclesNavigationKit](AssetImage/SpectaclesNavigationKit.png)

# Spectacles Navigation Kit

A comprehensive AR navigation system for creating location-based experiences on Spectacles. This package provides tools for managing places, tracking user position with GPS, and displaying directional guidance with animated AR arrows and distance indicators.

## Features

- **Place Management System**: Define and track multiple locations (custom coordinates, scene objects, or GeoJSON locations)
- **Real-Time GPS Tracking**: Continuous user position updates with configurable accuracy and update intervals
- **AR Navigation Arrow**: Animated directional indicator that points toward the selected destination
- **Distance Display**: Real-time distance calculation and formatting (meters/kilometers or feet/miles)
- **Navigation Events**: Hooks for navigation started, arrival detection, and place visit tracking
- **Multiple Place Types**: Support for CustomLocationPlace, SceneObjectPlace, GeoLocationPlace, and PlacesFromLocationGroup
- **Flexible User Position**: Manual override for testing or automatic GPS-based tracking

## Quick Start

Add the Navigation Data Component to track places and user position:

```typescript
import {NavigationDataComponent} from "SpectaclesNavigationKit.lspkg/NavigationDataComponent/NavigationDataComponent";
import {CustomLocationPlace} from "SpectaclesNavigationKit.lspkg/NavigationDataComponent/CustomLocationPlace";

@component
export class NavigationExample extends BaseScriptComponent {
  @input navigationData: NavigationDataComponent;
  @input arNavigation: ARNavigation;

  onAwake() {
    // Create a destination place
    const destination = new CustomLocationPlace(
      this.getSceneObject(),
      "Coffee Shop",
      37.7749,  // latitude
      -122.4194, // longitude
      5.0        // arrival threshold in meters
    );

    // Add place to navigation system
    this.navigationData.addPlace(destination);

    // Start navigating to the place
    this.navigationData.navigateToPlace(destination);

    // Listen for arrival
    this.navigationData.onArrivedAtPlace.add((place) => {
      print(`Arrived at ${place.name}!`);
      this.arNavigation.setEnabled(false);
    });
  }
}
```

## Script Highlights

### NavigationDataComponent.ts
The core component that manages a set of Places for location-based experiences. It provides real-time GPS tracking with configurable update intervals and accuracy settings. The system automatically detects when users arrive at places (within the defined arrival threshold) and tracks which locations have been visited. Events are emitted for navigation state changes including navigation started, arrival at place, and when all places have been visited. The component maintains NavigationStatus states (Initializing, InProgress, LocationNotSelected) and supports both automatic GPS updates and manual position overrides for testing.

### ARNavigation.ts
Provides visual AR guidance with an animated arrow that rotates to point toward the selected destination and a text label displaying the distance. The arrow smoothly interpolates rotation changes and the distance is formatted based on unit preferences (metric or imperial). The component updates continuously during navigation, calculating the direction vector from user position to target and converting it to screen space for intuitive visualization. Distance updates use threshold logic to prevent jitter, and the arrow includes configurable rotation speed for smooth animation.

### Place.ts
Abstract base class defining the interface for navigation destinations. Each Place has a name, geographic coordinates (latitude/longitude), and an arrival threshold distance in meters. Subclasses implement different place types: CustomLocationPlace for manually specified coordinates, SceneObjectPlace for AR objects in the scene, GeoLocationPlace for real-world GeoJSON data, and PlacesFromLocationGroup for collections loaded from external sources.

### UserPosition.ts
Encapsulates the user's current position for navigation calculations. Provides latitude, longitude, and heading data from either GPS sensors or manual override. The EditableUserPosition subclass supports runtime position changes for testing without requiring actual GPS movement. Integrates with RawLocationModule for accessing device location services and supports configurable accuracy levels and update frequencies.

## Core API Methods

### NavigationDataComponent

```typescript
// Navigate to a specific place
navigateToPlace(place: Place): void

// Stop current navigation
stopNavigation(): void

// Add a place to track
addPlace(place: Place): void

// Remove a place from tracking
removePlace(place: Place): void

// Get user's current position
getUserPosition(): UserPosition

// Check navigation status
get status(): NavigationStatus

// Access all places
get places(): Place[]
```

### ARNavigation

```typescript
// Enable/disable the navigation arrow
setEnabled(enabled: boolean): void

// Update arrow direction and distance display
update(): void

// Set the place to navigate toward
setPlace(place: Place): void

// Configure distance display units
setDistanceUnits(useMetric: boolean): void
```

### Place

```typescript
// Get place name
get name(): string

// Get geographic coordinates
get latitude(): number
get longitude(): number

// Get arrival detection threshold
get arrivalThreshold(): number

// Calculate distance from user
distanceFrom(userPosition: UserPosition): number
```

## Advanced Usage

### Multi-Place Scavenger Hunt

Create an experience where users must visit multiple locations in sequence:

```typescript
@component
export class ScavengerHunt extends BaseScriptComponent {
  @input navigationData: NavigationDataComponent;
  @input arNavigation: ARNavigation;

  private places: Place[] = [];
  private currentPlaceIndex = 0;

  onAwake() {
    // Define hunt locations
    this.places = [
      new CustomLocationPlace(this.getSceneObject(), "Statue", 37.7749, -122.4194, 10.0),
      new CustomLocationPlace(this.getSceneObject(), "Fountain", 37.7750, -122.4190, 10.0),
      new CustomLocationPlace(this.getSceneObject(), "Garden", 37.7748, -122.4195, 10.0),
    ];

    // Add all places to navigation system
    this.places.forEach(place => this.navigationData.addPlace(place));

    // Start with first location
    this.navigateToNextPlace();

    // Handle arrivals
    this.navigationData.onArrivedAtPlace.add(() => {
      this.currentPlaceIndex++;
      if (this.currentPlaceIndex < this.places.length) {
        delayedCallback(() => this.navigateToNextPlace(), 2.0);
      } else {
        print("Scavenger hunt complete!");
        this.arNavigation.setEnabled(false);
      }
    });
  }

  navigateToNextPlace() {
    const nextPlace = this.places[this.currentPlaceIndex];
    print(`Navigate to: ${nextPlace.name}`);
    this.navigationData.navigateToPlace(nextPlace);
    this.arNavigation.setPlace(nextPlace);
  }
}
```

### Dynamic Place Loading from GeoJSON

Load places from external location data and create a discoverable map:

```typescript
@component
export class DynamicPlaceLoader extends BaseScriptComponent {
  @input navigationData: NavigationDataComponent;
  @input locationGroupAsset: Asset.LocationAsset;

  onAwake() {
    // Load places from GeoJSON location group
    const placesGroup = new PlacesFromLocationGroup(
      this.getSceneObject(),
      this.locationGroupAsset,
      "Local Attractions"
    );

    // Add to navigation system
    this.navigationData.addPlace(placesGroup);

    // Create UI for place selection
    placesGroup.getLocationData().forEach((location, index) => {
      const place = new GeoLocationPlace(
        this.getSceneObject(),
        location.name,
        location.latitude,
        location.longitude,
        20.0  // 20 meter arrival threshold
      );

      this.navigationData.addPlace(place);
      print(`Loaded place: ${place.name}`);
    });

    // Listen for place updates
    this.navigationData.onPlacesUpdated.add(() => {
      print(`Places updated. Total: ${this.navigationData.places.length}`);
    });
  }
}
```

### Custom Navigation UI with Progress

Build a custom interface showing navigation progress and proximity alerts:

```typescript
@component
export class CustomNavigationUI extends BaseScriptComponent {
  @input navigationData: NavigationDataComponent;
  @input arNavigation: ARNavigation;
  @input progressText: Text;
  @input distanceText: Text;
  @input proximityAlert: SceneObject;

  private currentPlace: Place = null;
  private updateEvent: SceneEvent;

  onAwake() {
    this.proximityAlert.enabled = false;

    // Track navigation start
    this.navigationData.onNavigationStarted.add((place) => {
      this.currentPlace = place;
      this.progressText.text = `Navigating to: ${place.name}`;
    });

    // Track arrivals
    this.navigationData.onArrivedAtPlace.add((place) => {
      this.progressText.text = `Arrived at: ${place.name}`;
      this.proximityAlert.enabled = false;
    });

    // Update distance display
    this.updateEvent = this.createEvent("UpdateEvent");
    this.updateEvent.bind(() => {
      if (this.currentPlace) {
        const userPos = this.navigationData.getUserPosition();
        const distance = this.currentPlace.distanceFrom(userPos);

        // Update distance text
        this.distanceText.text = this.formatDistance(distance);

        // Show proximity alert when close
        if (distance < 50 && distance > this.currentPlace.arrivalThreshold) {
          this.proximityAlert.enabled = true;
        }
      }
    });
  }

  formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)}m away`;
    } else {
      return `${(meters / 1000).toFixed(1)}km away`;
    }
  }
}
```

## Built with 👻 by the Spectacles team


