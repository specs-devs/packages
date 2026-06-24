# Spectacles Navigation Kit (SNK) 

The Spectacles Navigation Kit (SNK) is a set of components designed to simplify the development of navigation experiences for the Spectacles platform in Lens Studio. SNK provides functionality for storing a set of places that can be navigated to, as well as visual assets that direct the user to those locations.

## Documentation and API Reference

- **Getting Started**: Learn how to use SNK by following the [Get Started Guide](https://developers.snap.com/spectacles/spectacles-grameworks/spectacles-navigation-kit/getting-started).
- **API Reference**: Explore the full API documentation for SNK [here](https://developers.snap.com/spectacles/spectacles-grameworks/spectacles-navigation-kit/component-list).

## How to Set Up SNK in Your Project

Follow these steps to setup a simple example of the SNK:

1. **Add SIK**: The example use case of the SNK relies on the Spectacles Interaction Kit. Add this to the project and follow that packages setup instructions.
2. **Add Navigation Kit**: In the root of the package there is a prefab named "[Navigation Kit]", add this to the scene.
3. **Set AR Navigation**: In the folder "ARNavigationComponent", find the prefab "ARNavigationPrefab [PUT_IN_SCENE]" and add this to your scene.
4. **Test**: In the scene, there should now be a list of 3 locations, by tapping on the buttons next to them the AR Navigation arrow should appear an point towards that location.
5. **Edit**: The locations used in example as set by the script `ManualPlaceList`, on the "[Navigation Kit]" scene object. These can be edited to customize your experience.

Further instructions on setup can be found in the [Get Started Guide](https://developers.snap.com/spectacles/spectacles-grameworks/spectacles-navigation-kit/getting-started).
A example template of a complex navigation experience can be found here [Navigation Kit Template](https://github.com/Snapchat/Spectacles-Sample/tree/main/Navigation%20Template).

You’re now ready to start building with SNK!





