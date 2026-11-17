import ARKit
import SceneKit
import SwiftUI

/// AR view of a room. The viewer taps a detected surface to place the stage origin; entities are
/// drawn relative to it (cm from the Lens → m here) as glTF models or placeholder primitives.
/// Each device aligns its own stage: this is manual alignment, not shared AR mapping.
@MainActor final class SpectatorScene: NSObject, ObservableObject, ARSCNViewDelegate {
    let view = ARSCNView(frame: .zero)
    /// Stage origin placed on the real surface. Its scale is the viewer's display scale.
    let stage = SCNNode()
    private let content = SCNNode()
    private let originMarker = SCNNode()
    private let keyLight = SCNLight()

    @Published private(set) var placed = false
    @Published private(set) var moving = false
    @Published private(set) var hint = "Join a room, then tap a surface to place the scene"
    @Published private(set) var assetStatus = ""
    @Published var displayScale: Double = 1 { didSet { applyScale() } }
    @Published var peopleOcclusion = UserDefaults.standard.object(forKey: "arkitSpectator.peopleOcclusion") as? Bool ?? true {
        didSet { UserDefaults.standard.set(peopleOcclusion, forKey: "arkitSpectator.peopleOcclusion"); if arStarted { view.session.run(configuration()) } }
    }

    var config = SpectatorConfig.load()
    private var arStarted = false
    private var active = false
    private var dragOffset: SIMD3<Float>?
    private var rotationStart: Float = 0
    private var scaleStart: Double = 1
    private var nodes: [String: EntityNode] = [:]
    private var failedAssets: Set<String> = []

    override init() {
        super.init()
        view.delegate = self
        view.scene = SCNScene()
        view.automaticallyUpdatesLighting = true
        view.autoenablesDefaultLighting = false
        view.antialiasingMode = .multisampling4X
        view.scene.rootNode.addChildNode(stage)
        stage.isHidden = true
        stage.addChildNode(content)
        configureLighting()
        configureOriginMarker()
        view.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(tap(_:))))
        let pan = UIPanGestureRecognizer(target: self, action: #selector(drag(_:)))
        pan.maximumNumberOfTouches = 1
        view.addGestureRecognizer(pan)
        view.addGestureRecognizer(UIRotationGestureRecognizer(target: self, action: #selector(rotateGesture(_:))))
        view.addGestureRecognizer(UIPinchGestureRecognizer(target: self, action: #selector(pinch(_:))))
    }

    // MARK: AR session

    func start() {
        guard !arStarted else { return }
        #if targetEnvironment(simulator)
        let camera = SCNNode()
        camera.camera = SCNCamera()
        camera.camera?.zNear = 0.005
        camera.position = SCNVector3(0, 0.6, 0.9)
        camera.look(at: SCNVector3(0, 0, 0))
        view.scene.rootNode.addChildNode(camera)
        view.pointOfView = camera
        view.scene.background.contents = UIColor(red: 0.03, green: 0.05, blue: 0.06, alpha: 1)
        view.isPlaying = true
        arStarted = true
        #else
        guard ARWorldTrackingConfiguration.isSupported else { hint = "AR needs a supported iPhone or iPad"; return }
        view.session.run(configuration())
        arStarted = true
        #endif
    }

    private func configuration() -> ARWorldTrackingConfiguration {
        let config = ARWorldTrackingConfiguration()
        config.planeDetection = [.horizontal, .vertical]
        config.environmentTexturing = .automatic
        if peopleOcclusion && ARWorldTrackingConfiguration.supportsFrameSemantics(.personSegmentationWithDepth) {
            config.frameSemantics.insert(.personSegmentationWithDepth)
        }
        return config
    }

    var peopleOcclusionSupported: Bool { ARWorldTrackingConfiguration.supportsFrameSemantics(.personSegmentationWithDepth) }

    /// Called when the viewer joins or leaves a room.
    func setActive(_ joined: Bool) {
        guard joined != active else { return }
        active = joined
        placed = false
        moving = false
        stage.isHidden = true
        nodes.values.forEach { $0.remove() }
        nodes = [:]
        failedAssets = []
        assetStatus = ""
        hint = joined ? "Move your phone over a surface, then tap it" : "Join a room, then tap a surface to place the scene"
        #if targetEnvironment(simulator)
        if joined { place(at: matrix_identity_float4x4) }
        #endif
    }

    // MARK: Placement

    private func hit(_ point: CGPoint) -> simd_float4x4? {
        #if targetEnvironment(simulator)
        let a = view.unprojectPoint(SCNVector3(Float(point.x), Float(point.y), 0))
        let b = view.unprojectPoint(SCNVector3(Float(point.x), Float(point.y), 1))
        let dy = b.y - a.y
        guard abs(dy) > 0.0001 else { return nil }
        let t = -a.y / dy
        guard t >= 0 else { return nil }
        var m = matrix_identity_float4x4
        m.columns.3 = SIMD4(a.x + (b.x - a.x) * t, 0, a.z + (b.z - a.z) * t, 1)
        return m
        #else
        guard let query = view.raycastQuery(from: point, allowing: .existingPlaneGeometry, alignment: .horizontal)
                ?? view.raycastQuery(from: point, allowing: .estimatedPlane, alignment: .horizontal) else { return nil }
        return view.session.raycast(query).first?.worldTransform
        #endif
    }

    private func place(at pose: simd_float4x4) {
        stage.simdPosition = SIMD3(pose.columns.3.x, pose.columns.3.y, pose.columns.3.z)
        // Face the stage's +Z toward the viewer so the Lens's "front" faces the phone.
        if let camera = view.pointOfView {
            let toCamera = camera.simdWorldPosition - stage.simdWorldPosition
            stage.simdEulerAngles = SIMD3(0, atan2(toCamera.x, toCamera.z), 0)
        }
        placed = true
        stage.isHidden = false
        setMoving(true)
    }

    @objc private func tap(_ gesture: UITapGestureRecognizer) {
        guard active, !placed else { return }
        guard let pose = hit(gesture.location(in: view)) else { hint = "Scan the surface slowly until AR detects it, then tap again"; return }
        place(at: pose)
    }

    @objc private func drag(_ gesture: UIPanGestureRecognizer) {
        guard placed, moving else { return }
        let point = gesture.location(in: view)
        switch gesture.state {
        case .began:
            guard let pose = hit(point) else { dragOffset = nil; return }
            dragOffset = stage.simdPosition - SIMD3(pose.columns.3.x, pose.columns.3.y, pose.columns.3.z)
        case .changed:
            if let offset = dragOffset, let pose = hit(point) { stage.simdPosition = SIMD3(pose.columns.3.x, pose.columns.3.y, pose.columns.3.z) + offset }
        default:
            dragOffset = nil
        }
    }

    @objc private func rotateGesture(_ gesture: UIRotationGestureRecognizer) {
        guard placed, moving else { return }
        if gesture.state == .began { rotationStart = stage.eulerAngles.y }
        if gesture.state == .changed { stage.eulerAngles.y = rotationStart - Float(gesture.rotation) }
    }

    @objc private func pinch(_ gesture: UIPinchGestureRecognizer) {
        guard placed, moving else { return }
        if gesture.state == .began { scaleStart = displayScale }
        if gesture.state == .changed { displayScale = min(4, max(0.05, scaleStart * Double(gesture.scale))) }
    }

    func setMoving(_ enabled: Bool) {
        guard placed else { return }
        moving = enabled
        originMarker.isHidden = !enabled
        hint = enabled ? "Drag to move · two fingers to rotate · pinch to scale · then Lock" : "Locked · walk around for your own camera angle"
    }

    func rotate(_ degrees: Float) { guard placed, moving else { return }; stage.eulerAngles.y += degrees * .pi / 180 }

    func replace() {
        guard active else { return }
        placed = false
        moving = false
        stage.isHidden = true
        hint = "Tap a surface to place the scene again"
    }

    private func applyScale() { stage.simdScale = SIMD3<Float>(repeating: Float(displayScale)) }

    // MARK: Scene content

    func update(_ state: SpectatorState, interval: TimeInterval) {
        guard active else { return }
        var alive = Set<String>()
        for entity in state.entities where entity.isValid {
            alive.insert(entity.id)
            let node = nodes[entity.id] ?? {
                let created = EntityNode(id: entity.id)
                content.addChildNode(created.root)
                nodes[entity.id] = created
                return created
            }()
            node.apply(entity, duration: interval, scene: self)
        }
        for (id, node) in nodes where !alive.contains(id) {
            node.remove()
            nodes[id] = nil
        }
        if state.entities.isEmpty && placed { hint = moving ? hint : "Waiting for the host to stream objects" }
    }

    fileprivate func loadModel(_ url: URL, into node: EntityNode) {
        let key = url.absoluteString
        guard !failedAssets.contains(key) else { return }
        node.loading = Task { [weak self, weak node] in
            guard let self else { return }
            do {
                let model = try await LoadedModel.load(url, config: self.config)
                guard !Task.isCancelled, let node, node.assetURL == url else { return }
                node.attach(model)
                if self.assetStatus.hasPrefix("Model") { self.assetStatus = "" }
            } catch {
                guard !Task.isCancelled else { return }
                self.failedAssets.insert(key)
                self.assetStatus = "Model failed (\(url.lastPathComponent)): \(error.localizedDescription)"
            }
        }
    }

    private func configureLighting() {
        let key = SCNNode()
        key.light = keyLight
        keyLight.type = .directional
        keyLight.intensity = 900
        keyLight.castsShadow = true
        keyLight.shadowMode = .deferred
        keyLight.shadowSampleCount = 8
        keyLight.shadowRadius = 4
        keyLight.shadowColor = UIColor(white: 0, alpha: 0.35)
        keyLight.orthographicScale = 3
        key.eulerAngles = SCNVector3(-Float.pi / 3, -Float.pi / 4, 0)
        stage.addChildNode(key)
        let ambient = SCNNode()
        ambient.light = SCNLight()
        ambient.light?.type = .ambient
        ambient.light?.intensity = 300
        stage.addChildNode(ambient)
        // Shadow catcher on the real surface.
        let plane = SCNPlane(width: 6, height: 6)
        plane.firstMaterial?.lightingModel = .shadowOnly
        plane.firstMaterial?.writesToDepthBuffer = false
        let receiver = SCNNode(geometry: plane)
        receiver.eulerAngles.x = -.pi / 2
        receiver.position.y = -0.001
        stage.addChildNode(receiver)
    }

    private func configureOriginMarker() {
        let ring = SCNTorus(ringRadius: 0.08, pipeRadius: 0.004)
        ring.firstMaterial?.diffuse.contents = UIColor.systemTeal
        ring.firstMaterial?.lightingModel = .constant
        let ringNode = SCNNode(geometry: ring)
        originMarker.addChildNode(ringNode)
        // Arrow toward the stage's +Z ("front" in the Lens).
        let arrow = SCNCone(topRadius: 0, bottomRadius: 0.015, height: 0.04)
        arrow.firstMaterial?.diffuse.contents = UIColor.systemTeal
        arrow.firstMaterial?.lightingModel = .constant
        let arrowNode = SCNNode(geometry: arrow)
        arrowNode.eulerAngles.x = .pi / 2
        arrowNode.position = SCNVector3(0, 0, 0.11)
        originMarker.addChildNode(arrowNode)
        originMarker.isHidden = true
        stage.addChildNode(originMarker)
    }

    nonisolated func session(_ session: ARSession, didFailWithError error: Error) {
        Task { @MainActor in self.hint = "AR stopped: \(error.localizedDescription)" }
    }
}

/// One streamed entity: a pose node holding either a glTF model or a placeholder primitive.
@MainActor final class EntityNode {
    let id: String
    let root = SCNNode()
    private(set) var assetURL: URL?
    var loading: Task<Void, Never>?
    private var model: LoadedModel?
    private var placeholder: SCNNode?
    private var appearance = ""
    private var clipKey = ""
    private var pendingClip: SpectatorClip?
    private var firstPose = true

    /// Placeholder primitives are 10 cm reference shapes, scaled by the entity's scale.
    static let placeholderSize: CGFloat = 0.1

    init(id: String) {
        self.id = id
        root.name = "entity:" + id
    }

    func apply(_ entity: SpectatorEntityState, duration: TimeInterval, scene: SpectatorScene) {
        root.isHidden = !entity.isVisible
        // Pose: implicit animation over the update interval smooths 5–15 Hz updates.
        SCNTransaction.begin()
        SCNTransaction.animationDuration = firstPose ? 0 : duration
        root.simdPosition = entity.position
        root.simdOrientation = entity.orientation
        root.simdScale = entity.scale
        SCNTransaction.commit()
        firstPose = false

        let url = entity.assetURL
        let look = "\(url?.absoluteString ?? "-")|\(entity.primitive ?? "box")|\(entity.color ?? "")"
        if look != appearance {
            appearance = look
            loading?.cancel()
            model?.root.removeFromParentNode()
            model = nil
            clipKey = ""
            assetURL = url
            showPlaceholder(entity)
            if let url { scene.loadModel(url, into: self) }
        }
        pendingClip = entity.clip
        applyClip()
    }

    func attach(_ loaded: LoadedModel) {
        placeholder?.removeFromParentNode()
        placeholder = nil
        model = loaded
        root.addChildNode(loaded.root)
        clipKey = ""
        applyClip()
    }

    private func applyClip() {
        guard let model else { return }
        let clip = pendingClip
        let key = clip.map { "\($0.name)|\($0.loop ?? false)|\($0.id ?? "")" } ?? "default"
        guard key != clipKey else { return }
        clipKey = key
        if let clip { model.play(clip.name, loop: clip.loop ?? false) } else { model.play(nil, loop: true) }
    }

    private func showPlaceholder(_ entity: SpectatorEntityState) {
        placeholder?.removeFromParentNode()
        placeholder = nil
        let size = Self.placeholderSize
        let geometry: SCNGeometry?
        switch entity.primitive ?? "box" {
        case "sphere": geometry = SCNSphere(radius: size / 2)
        case "cylinder": geometry = SCNCylinder(radius: size / 2, height: size)
        case "plane":
            let plane = SCNPlane(width: size, height: size)
            plane.firstMaterial?.isDoubleSided = true
            geometry = plane
        case "none": geometry = nil
        default: geometry = SCNBox(width: size, height: size, length: size, chamferRadius: size * 0.04)
        }
        guard let geometry else { return }
        let material = geometry.firstMaterial ?? SCNMaterial()
        material.diffuse.contents = entity.uiColor
        material.lightingModel = .physicallyBased
        material.roughness.contents = 0.6
        geometry.firstMaterial = material
        let node = SCNNode(geometry: geometry)
        // Placeholder shown while a model downloads is translucent.
        node.opacity = entity.assetURL == nil ? 1 : 0.35
        placeholder = node
        root.addChildNode(node)
    }

    func remove() {
        loading?.cancel()
        root.removeFromParentNode()
    }
}

struct ARSpectatorView: UIViewRepresentable {
    let controller: SpectatorScene
    func makeUIView(context: Context) -> ARSCNView { controller.start(); return controller.view }
    func updateUIView(_ uiView: ARSCNView, context: Context) {}
}
