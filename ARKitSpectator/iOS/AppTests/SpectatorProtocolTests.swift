import XCTest
@testable import ARKitSpectator

final class SpectatorProtocolTests: XCTestCase {
    private let sample = """
    {"room_id":"95239a85-f846-44a8-b21d-67760a7dd22d","revision":3,"updated_at":"2026-10-01T00:00:00Z",
     "state":{"entities":[
       {"id":"cube","p":[10,20,-30],"r":[0,0.7071068,0,0.7071068],"s":[2,2,2],"primitive":"sphere","color":"#FF880080",
        "clip":{"name":"Wave","loop":false,"id":"4"},"data":{"hp":3,"tags":["a"],"ok":true,"none":null}},
       {"id":"robot","p":[0,0,0],"r":[0,0,0,1],"s":[1,1,1],"asset":"https://demo.snapcloud.dev/storage/v1/object/public/models/robot.glb","visible":false}
     ],"data":{"title":"Demo"}}}
    """

    func testDecodesRowAndConvertsUnits() throws {
        let row = try JSONDecoder().decode(SpectatorStateRow.self, from: Data(sample.utf8))
        XCTAssertEqual(row.revision, 3)
        XCTAssertEqual(row.state.entities.count, 2)
        let cube = row.state.entities[0]
        XCTAssertTrue(cube.isValid)
        XCTAssertEqual(cube.position.x, 0.1, accuracy: 1e-6)
        XCTAssertEqual(cube.position.z, -0.3, accuracy: 1e-6)
        XCTAssertEqual(cube.clip?.id, "4")
        XCTAssertEqual(cube.data, .object(["hp": .number(3), "tags": .array([.string("a")]), "ok": .bool(true), "none": .null]))
        XCTAssertFalse(row.state.entities[1].isVisible)
        XCTAssertEqual(row.state.data, .object(["title": .string("Demo")]))
    }

    func testRejectsInvalidEntities() {
        let bad = SpectatorEntityState(id: "x", p: [0, 0], r: [0, 0, 0, 1], s: [1, 1, 1])
        XCTAssertFalse(bad.isValid)
        let http = SpectatorEntityState(id: "x", p: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1], asset: "http://insecure/model.glb")
        XCTAssertFalse(http.isValid)
    }

    func testColorParsing() {
        var a: CGFloat = 0
        XCTAssertNotNil(UIColor(spectatorHex: "#14A08D"))
        UIColor(spectatorHex: "#FF000080")!.getRed(nil, green: nil, blue: nil, alpha: &a)
        XCTAssertEqual(a, 128.0 / 255, accuracy: 0.01)
        XCTAssertNil(UIColor(spectatorHex: "red"))
    }

    func testAssetHostAllowlist() {
        let config = SpectatorConfig(supabaseURL: "https://demo.snapcloud.dev", publishableKey: "public", allowedAssetHosts: ["*.example.com"])
        XCTAssertTrue(config.isComplete)
        XCTAssertTrue(config.allowsAsset(URL(string: "https://demo.snapcloud.dev/storage/v1/object/public/a.glb")!))
        XCTAssertTrue(config.allowsAsset(URL(string: "https://cdn.example.com/a.glb")!))
        XCTAssertFalse(config.allowsAsset(URL(string: "https://evil.com/a.glb")!))
        XCTAssertFalse(config.allowsAsset(URL(string: "http://demo.snapcloud.dev/a.glb")!))
        XCTAssertFalse(SpectatorConfig().isComplete)
    }

    func testCacheFileNamesAreDistinct() {
        let a = AssetCache.fileName(for: URL(string: "https://h/a/model.glb")!)
        let b = AssetCache.fileName(for: URL(string: "https://h/b/model.glb")!)
        XCTAssertNotEqual(a, b)
        XCTAssertTrue(a.hasSuffix(".glb"))
    }

    func testRoomCodesAreFourDigits() {
        XCTAssertTrue(SpectatorSession.isValidCode("0042"))
        XCTAssertFalse(SpectatorSession.isValidCode("123456"))
        XCTAssertFalse(SpectatorSession.isValidCode("12a4"))
        XCTAssertFalse(SpectatorSession.isValidCode("123"))
    }
}
