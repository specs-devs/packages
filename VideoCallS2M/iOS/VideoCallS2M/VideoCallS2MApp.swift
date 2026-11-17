//
//  VideoCallS2MApp.swift
//  VideoCallS2M
//

import SwiftUI

@main
struct VideoCallS2MApp: App {
    @StateObject private var locationModel = LocationModel()
    @StateObject private var multipeerSession = MultipeerSession()
    @StateObject private var mobileKitModel = MobileKitModel()
    @StateObject private var videoCallS2MModel = VideoCallS2MModeModel()
    @StateObject private var nearbyModel = NearbyInteractionModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(locationModel)
                .environmentObject(multipeerSession)
                .environmentObject(mobileKitModel)
                .environmentObject(videoCallS2MModel)
                .environmentObject(nearbyModel)
                .onOpenURL { url in
                    mobileKitModel.pushDeeplinkURL(url: url)
                }
        }
    }
}
