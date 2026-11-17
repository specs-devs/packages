//
//  FriendFinderApp.swift
//  FriendFinder
//

import SwiftUI

@main
struct FriendFinderApp: App {
    @StateObject private var locationModel = LocationModel()
    @StateObject private var multipeerSession = MultipeerSession()
    @StateObject private var mobileKitModel = MobileKitModel()
    @StateObject private var friendFinderModel = FriendFinderModeModel()
    @StateObject private var nearbyModel = NearbyInteractionModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(locationModel)
                .environmentObject(multipeerSession)
                .environmentObject(mobileKitModel)
                .environmentObject(friendFinderModel)
                .environmentObject(nearbyModel)
                .onOpenURL { url in
                    mobileKitModel.pushDeeplinkURL(url: url)
                }
        }
    }
}
