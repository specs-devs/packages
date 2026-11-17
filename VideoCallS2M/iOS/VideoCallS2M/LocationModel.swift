//
//  LocationModel.swift
//  VideoCallS2M
//

import Combine
import CoreLocation
import CoreMotion
import Foundation

enum LocationAuthorizationStatus: String {
    case notDetermined = "Not Determined"
    case authorized = "Authorized"
    case denied = "Denied"
}

final class LocationModel: NSObject, ObservableObject {
    private let manager = CLLocationManager()
    private let altimeter = CMAltimeter()

    @Published var lastLocation: CLLocation?
    @Published var lastHeading: CLHeading?
    /// Raw barometric pressure in kPa. Comparing raw pressure between two nearby
    /// phones cancels the weather component, giving ~1 m relative height accuracy.
    @Published var lastPressureKPa: Double?
    @Published var authorizationStatus: LocationAuthorizationStatus = .notDetermined
    @Published var errorMessage: String?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        // Requires the "location" UIBackgroundModes entry in Info.plist. With
        // when-in-use permission this keeps GPS alive in the background and
        // shows the system blue location indicator.
        manager.allowsBackgroundLocationUpdates = true
        manager.showsBackgroundLocationIndicator = true
        manager.pausesLocationUpdatesAutomatically = false
        manager.startUpdatingHeading()
    }

    func requestAuthorization() {
        manager.requestWhenInUseAuthorization()
    }

    func startUpdates() {
        manager.startUpdatingLocation()
        manager.startUpdatingHeading()
        startAltimeter()
    }

    func stopUpdates() {
        manager.stopUpdatingLocation()
        manager.stopUpdatingHeading()
        altimeter.stopRelativeAltitudeUpdates()
    }

    private func startAltimeter() {
        guard CMAltimeter.isRelativeAltitudeAvailable() else { return }
        altimeter.startRelativeAltitudeUpdates(to: .main) { [weak self] data, _ in
            guard let data else { return }
            self?.lastPressureKPa = data.pressure.doubleValue
        }
    }

    var locationJson: [String: Any] {
        var payload: [String: Any] = [:]
        if let loc = lastLocation {
            payload["lat"] = loc.coordinate.latitude
            payload["lon"] = loc.coordinate.longitude
            payload["accuracy"] = loc.horizontalAccuracy
            if loc.verticalAccuracy > 0 {
                payload["alt"] = loc.altitude
                payload["vAcc"] = loc.verticalAccuracy
            }
        }
        if let heading = lastHeading {
            payload["heading"] = heading.trueHeading >= 0 ? heading.trueHeading : heading.magneticHeading
        }
        if let pressure = lastPressureKPa {
            payload["pressure"] = pressure
        }
        return payload
    }
}

extension LocationModel: CLLocationManagerDelegate {
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        DispatchQueue.main.async {
            self.lastLocation = location
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateHeading newHeading: CLHeading) {
        DispatchQueue.main.async {
            self.lastHeading = newHeading
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        DispatchQueue.main.async {
            switch manager.authorizationStatus {
            case .notDetermined:
                self.authorizationStatus = .notDetermined
            case .restricted, .denied:
                self.authorizationStatus = .denied
                self.errorMessage = "Location access denied. Enable it in Settings."
            case .authorizedWhenInUse, .authorizedAlways:
                self.authorizationStatus = .authorized
                self.startUpdates()
            @unknown default:
                self.authorizationStatus = .notDetermined
            }
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        DispatchQueue.main.async {
            self.errorMessage = error.localizedDescription
        }
    }
}
