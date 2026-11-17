//
//  RadarView.swift
//  FriendFinder
//
//  A compact, self-centered polar "radar scope" for the bottom of the map.
//  You sit at the center (heading-up — the top of the scope is where you're
//  facing); your friend is a blip at the true bearing + distance between the
//  two phones. Distance is UWB when a fresh reading exists (crisp green blip +
//  exact dashed range ring) and falls back to phone GPS (indigo blip with a
//  translucent accuracy halo sized by the combined horizontal uncertainty).
//  Range rings auto-scale to keep the friend on-screen.
//
//  Everything is passed in as plain values so the view stays decoupled from the
//  app's models (ContentView maps model → inputs).
//

import CoreLocation
import SwiftUI

struct RadarView: View {
    // Self (this phone).
    let selfLocation: CLLocation?
    let heading: CLHeading?
    // Friend (their phone's GPS, relayed to us over Multipeer).
    let friendCoordinate: CLLocationCoordinate2D?
    let friendAccuracyM: Double?
    let friendName: String?
    // UWB (phone ↔ phone NearbyInteraction).
    let uwbFreshM: Double?
    let uwbSupported: Bool

    // Palette — matches the map dots: self = blue, friend/GPS = indigo,
    // UWB = green (same as the existing `wave.3.right` UWB indicator).
    private let uwbColor = Color.green
    private let gpsColor = Color.indigo
    private let selfColor = Color.blue
    private let gridColor = Color.secondary

    private let feetPerMeter = 3.28084

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            scope.frame(height: 172)
            legend
        }
    }

    // MARK: - Derived values

    /// Compass heading in degrees (true, else magnetic); nil if unavailable.
    private var headingDeg: Double? {
        guard let h = heading else { return nil }
        let d = h.trueHeading >= 0 ? h.trueHeading : h.magneticHeading
        return d >= 0 ? d : nil
    }

    /// Great-circle GPS distance between the two phones, meters.
    private var gpsDistanceM: Double? {
        guard let s = selfLocation, let c = friendCoordinate else { return nil }
        return s.distance(from: CLLocation(latitude: c.latitude, longitude: c.longitude))
    }

    /// The distance we actually plot: UWB if fresh, else GPS.
    private var displayDistanceM: Double? { uwbFreshM ?? gpsDistanceM }
    private var usingUWB: Bool { uwbFreshM != nil }

    /// True (north-referenced) bearing self → friend, degrees clockwise 0..360.
    private var trueBearingDeg: Double? {
        guard let s = selfLocation?.coordinate, let c = friendCoordinate else { return nil }
        let lat1 = s.latitude * .pi / 180, lat2 = c.latitude * .pi / 180
        let dLon = (c.longitude - s.longitude) * .pi / 180
        let y = sin(dLon) * cos(lat2)
        let x = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(dLon)
        let deg = atan2(y, x) * 180 / .pi
        return (deg + 360).truncatingRemainder(dividingBy: 360)
    }

    /// Combined GPS horizontal uncertainty (self + friend), meters — the halo.
    private var gpsAccuracyM: Double? {
        let s = selfLocation?.horizontalAccuracy ?? -1
        let f = friendAccuracyM ?? -1
        guard s >= 0 || f >= 0 else { return nil }
        return max(0, s) + max(0, f)
    }

    /// Full-scale radar range in feet — the smallest "nice" value that fits.
    private var maxRangeFt: Double {
        let ladder: [Double] = [10, 20, 30, 60, 120, 300, 600, 1200, 3000, 6000, 15000]
        guard let m = displayDistanceM else { return 30 }
        let ft = m * feetPerMeter
        return ladder.first(where: { $0 >= ft * 1.12 }) ?? ladder.last!
    }

    // MARK: - Scope (Canvas)

    private var scope: some View {
        Canvas { ctx, size in
            let R = min(size.width, size.height) / 2 - 10
            let center = CGPoint(x: size.width / 2, y: size.height / 2)
            drawGrid(ctx, center: center, R: R)
            drawNorthTick(ctx, center: center, R: R)
            if let d = displayDistanceM {
                drawFriend(ctx, center: center, R: R, distanceM: d)
            }
            drawSelf(ctx, center: center)
        }
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color.primary.opacity(0.04))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(gridColor.opacity(0.15), lineWidth: 0.5)
        )
    }

    private func radius(forFt ft: Double, R: CGFloat) -> CGFloat {
        CGFloat(min(1.0, ft / maxRangeFt)) * R
    }

    /// Screen angle (radians, clockwise from up) for a true bearing. Heading-up
    /// when we have a compass; north-up otherwise.
    private func screenAngle(trueDeg: Double) -> Double {
        let rel = (headingDeg != nil) ? trueDeg - headingDeg! : trueDeg
        return rel * .pi / 180
    }

    private func point(_ center: CGPoint, _ angleRad: Double, _ r: CGFloat) -> CGPoint {
        CGPoint(x: center.x + r * CGFloat(sin(angleRad)),
                y: center.y - r * CGFloat(cos(angleRad)))
    }

    private func drawGrid(_ ctx: GraphicsContext, center: CGPoint, R: CGFloat) {
        for frac in [1.0 / 3.0, 2.0 / 3.0, 1.0] {
            let r = R * frac
            let rect = CGRect(x: center.x - r, y: center.y - r, width: 2 * r, height: 2 * r)
            ctx.stroke(Path(ellipseIn: rect), with: .color(gridColor.opacity(0.22)),
                       lineWidth: frac == 1.0 ? 1.2 : 0.8)
            let ft = maxRangeFt * frac
            let label = ft >= 1000 ? String(format: "%.1fk", ft / 1000) : "\(Int(ft))"
            let text = ctx.resolve(Text("\(label) ft")
                .font(.system(size: 8, weight: .medium))
                .foregroundColor(gridColor))
            ctx.draw(text, at: CGPoint(x: center.x + 3, y: center.y - r - 1), anchor: .bottomLeading)
        }
        var cross = Path()
        cross.move(to: CGPoint(x: center.x - R, y: center.y))
        cross.addLine(to: CGPoint(x: center.x + R, y: center.y))
        cross.move(to: CGPoint(x: center.x, y: center.y - R))
        cross.addLine(to: CGPoint(x: center.x, y: center.y + R))
        ctx.stroke(cross, with: .color(gridColor.opacity(0.1)), lineWidth: 0.8)
    }

    private func drawNorthTick(_ ctx: GraphicsContext, center: CGPoint, R: CGFloat) {
        let a = screenAngle(trueDeg: 0)
        var tick = Path()
        tick.move(to: point(center, a, R - 9))
        tick.addLine(to: point(center, a, R))
        ctx.stroke(tick, with: .color(.red.opacity(0.7)), lineWidth: 2)
        let label = ctx.resolve(Text("N").font(.system(size: 9, weight: .bold)).foregroundColor(.red.opacity(0.8)))
        ctx.draw(label, at: point(center, a, R - 17))
    }

    private func drawFriend(_ ctx: GraphicsContext, center: CGPoint, R: CGFloat, distanceM: Double) {
        let r = radius(forFt: distanceM * feetPerMeter, R: R)
        let color = usingUWB ? uwbColor : gpsColor

        guard let b = trueBearingDeg else {
            // Distance known (UWB) but direction unknown → ring at that radius.
            let rect = CGRect(x: center.x - r, y: center.y - r, width: 2 * r, height: 2 * r)
            ctx.stroke(Path(ellipseIn: rect), with: .color(color.opacity(0.7)),
                       style: StrokeStyle(lineWidth: 2, dash: [4, 4]))
            return
        }

        let a = screenAngle(trueDeg: b)
        let p = point(center, a, r)

        // Bearing spoke.
        var spoke = Path()
        spoke.move(to: center)
        spoke.addLine(to: p)
        ctx.stroke(spoke, with: .color(color.opacity(0.35)), lineWidth: 1.5)

        if usingUWB {
            // Crisp blip + exact dashed range ring (UWB gives precise distance).
            let ring = CGRect(x: center.x - r, y: center.y - r, width: 2 * r, height: 2 * r)
            ctx.stroke(Path(ellipseIn: ring), with: .color(uwbColor.opacity(0.45)),
                       style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
            drawBlip(ctx, at: p, color: uwbColor, radius: 5.5)
        } else {
            // GPS: fuzzy blip with an uncertainty halo sized by accuracy.
            if let acc = gpsAccuracyM, acc > 0 {
                let hr = max(6, radius(forFt: acc * feetPerMeter, R: R))
                let hrect = CGRect(x: p.x - hr, y: p.y - hr, width: 2 * hr, height: 2 * hr)
                ctx.fill(Path(ellipseIn: hrect), with: .color(gpsColor.opacity(0.14)))
                ctx.stroke(Path(ellipseIn: hrect), with: .color(gpsColor.opacity(0.3)),
                           style: StrokeStyle(lineWidth: 0.8, dash: [2, 3]))
            }
            drawBlip(ctx, at: p, color: gpsColor, radius: 6)
        }
    }

    private func drawBlip(_ ctx: GraphicsContext, at p: CGPoint, color: Color, radius: CGFloat) {
        let rect = CGRect(x: p.x - radius, y: p.y - radius, width: 2 * radius, height: 2 * radius)
        ctx.fill(Path(ellipseIn: rect), with: .color(color.opacity(0.9)))
        ctx.stroke(Path(ellipseIn: rect), with: .color(.white.opacity(0.9)), lineWidth: 1.5)
    }

    private func drawSelf(_ ctx: GraphicsContext, center: CGPoint) {
        // Heading-up: when we know the compass, the top of the scope IS our
        // facing, so the self arrow always points straight up.
        if headingDeg != nil {
            var tri = Path()
            tri.move(to: CGPoint(x: center.x, y: center.y - 13))
            tri.addLine(to: CGPoint(x: center.x - 6, y: center.y + 4))
            tri.addLine(to: CGPoint(x: center.x + 6, y: center.y + 4))
            tri.closeSubpath()
            ctx.fill(tri, with: .color(selfColor.opacity(0.85)))
        }
        let puck = CGRect(x: center.x - 6, y: center.y - 6, width: 12, height: 12)
        ctx.fill(Path(ellipseIn: puck), with: .color(.white))
        let inner = CGRect(x: center.x - 4, y: center.y - 4, width: 8, height: 8)
        ctx.fill(Path(ellipseIn: inner), with: .color(selfColor))
    }

    // MARK: - Legend

    private var legend: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 8) {
                if let d = displayDistanceM {
                    Circle().fill(usingUWB ? uwbColor : gpsColor).frame(width: 9, height: 9)
                    Text(distanceText(d * feetPerMeter))
                        .font(.subheadline.weight(.bold))
                        .monospacedDigit()
                    if let card = compass(trueBearingDeg) {
                        Text("· \(card)").font(.caption).foregroundStyle(.secondary)
                    }
                } else {
                    Image(systemName: "dot.radiowaves.left.and.right").foregroundStyle(.secondary)
                    Text("Searching for friend…").font(.subheadline).foregroundStyle(.secondary)
                }
                Spacer()
                sourceChip("UWB", uwbColor, active: usingUWB, dimmed: !uwbSupported)
                sourceChip("GPS", gpsColor, active: !usingUWB && displayDistanceM != nil, dimmed: false)
            }
            Text(sourceDetail).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
        }
    }

    private func distanceText(_ ft: Double) -> String {
        if usingUWB { return String(format: "%.1f ft", ft) }        // precise
        if ft >= 5280 { return String(format: "≈ %.1f mi", ft / 5280) }
        return "≈ \(Int(ft.rounded())) ft"                          // approximate
    }

    private var sourceDetail: String {
        let who = friendName.map { "→ \($0)" } ?? "→ friend"
        if usingUWB {
            return "\(who) · UWB precise · phone↔phone"
        }
        if displayDistanceM != nil {
            if let acc = gpsAccuracyM, acc > 0 {
                let m = Int(acc.rounded())
                return "\(who) · phone GPS · ±\(m) m\(uwbSupported ? "" : " · UWB n/a")"
            }
            return "\(who) · phone GPS\(uwbSupported ? "" : " · UWB n/a")"
        }
        return uwbSupported ? "Waiting for GPS or UWB…" : "Waiting for GPS… (UWB n/a on this device)"
    }

    private func compass(_ deg: Double?) -> String? {
        guard let d = deg else { return nil }
        let dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
        return dirs[Int((d / 45).rounded()) % 8]
    }

    private func sourceChip(_ label: String, _ color: Color, active: Bool, dimmed: Bool) -> some View {
        HStack(spacing: 4) {
            Circle().fill(active ? color : color.opacity(0.25)).frame(width: 7, height: 7)
            Text(label)
                .font(.caption2.weight(active ? .bold : .regular))
                .foregroundStyle(active ? color : Color.secondary)
        }
        .padding(.horizontal, 7)
        .padding(.vertical, 3)
        .background((active ? color.opacity(0.12) : Color.clear), in: Capsule())
        .opacity(dimmed ? 0.4 : 1)
    }
}
