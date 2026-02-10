/**
 * Specs Inc. 2026
 * Main orchestrator for mocopi motion capture integration. Coordinates WebSocket client
 * and avatar controller components. Handles event routing and status updates.
 */

import NativeLogger from "SpectaclesInteractionKit.lspkg/Utils/NativeLogger"
import { MocopiWebSocketClient } from "./MocopiWebSocketClient"
import { MocopiAvatarController } from "./MocopiAvatarController"
import { SkeletonDefinition, FrameData } from "./MocopiDataTypes"

const log = new NativeLogger("MocopiMainController")

@component
export class MocopiMainController extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Component References</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Assign all required mocopi system components</span>')
  @input
  @hint("WebSocket client component")
  webSocketClient: MocopiWebSocketClient

  @input
  @hint("Avatar controller component")
  avatarController: MocopiAvatarController

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">System Settings</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure which features are active</span>')
  @input
  @hint("Show avatar")
  showAvatar: boolean = true

  private isInitialized: boolean = false
  private hasReceivedSkeleton: boolean = false

  onAwake() {
    print("=" .repeat(60))
    print("[MocopiMainController] INITIALIZING")
    print("=" .repeat(60))
    log.i("Main Controller initializing...")

    if (!this.webSocketClient) {
      print("[MocopiMainController] ERROR: WebSocket client not assigned!")
      log.e("WebSocket client not assigned")
      return
    }

    print("[MocopiMainController] WebSocket client: ASSIGNED")
    print(`[MocopiMainController] Avatar Controller: ${this.avatarController ? "ASSIGNED" : "NOT ASSIGNED"}`)
    print(`[MocopiMainController] Show Avatar: ${this.showAvatar}`)

    // Setup event handlers
    this.setupEventHandlers()

    this.createEvent("UpdateEvent").bind(() => {
      this.update()
    })

    this.isInitialized = true
    print("[MocopiMainController] INITIALIZED SUCCESSFULLY")
    print("=" .repeat(60))
    log.i("Main Controller initialized")
  }

  // Setup all event handlers
  private setupEventHandlers() {
    // WebSocket events
    this.webSocketClient.onConnected = () => {
      this.handleConnected()
    }

    this.webSocketClient.onDisconnected = () => {
      this.handleDisconnected()
    }

    this.webSocketClient.onSkeletonReceived = (skeleton: SkeletonDefinition) => {
      this.handleSkeletonReceived(skeleton)
    }

    this.webSocketClient.onFrameReceived = (frame: FrameData) => {
      this.handleFrameReceived(frame)
    }

    this.webSocketClient.onError = (error: string) => {
      this.handleError(error)
    }

    log.i("Event handlers configured")
  }

  update() {
    if (!this.isInitialized) return
  }

  // Handle connection established
  private handleConnected() {
    print("=" .repeat(60))
    print("[MocopiMainController] CONNECTED TO MOCOPI SERVER")
    print("=" .repeat(60))
    log.i("Connected to mocopi server")
  }

  // Handle disconnection
  private handleDisconnected() {
    print("=" .repeat(60))
    print("[MocopiMainController] DISCONNECTED FROM SERVER")
    print("=" .repeat(60))
    log.w("Disconnected from mocopi server")
  }

  // Handle skeleton definition received
  private handleSkeletonReceived(skeleton: SkeletonDefinition) {
    print("=" .repeat(60))
    print("[MocopiMainController] SKELETON RECEIVED")
    print(`[MocopiMainController] Bone count: ${skeleton.num_bones}`)
    print("=" .repeat(60))
    log.i(`Skeleton received: ${skeleton.num_bones} bones`)
    this.hasReceivedSkeleton = true

    // Initialize avatar controller
    if (this.avatarController && this.showAvatar) {
      print("[MocopiMainController] Initializing avatar controller...")
      this.avatarController.initializeAvatar(skeleton)
      print("[MocopiMainController] Avatar controller INITIALIZED")
      log.i("Avatar controller initialized")
    }
  }

  // Handle frame data received
  private handleFrameReceived(frame: FrameData) {
    if (!this.hasReceivedSkeleton) {
      print("[MocopiMainController] WARN: Received frame before skeleton definition")
      log.w("Received frame before skeleton definition")
      return
    }

    // Update avatar
    if (this.avatarController && this.showAvatar) {
      this.avatarController.updateFrame(frame)
    }
  }

  // Handle error
  private handleError(error: string) {
    print("=" .repeat(60))
    print(`[MocopiMainController] ERROR: ${error}`)
    print("=" .repeat(60))
    log.e(`Error: ${error}`)
  }

  // Public API

  // Connect to server
  public connect() {
    if (this.webSocketClient) {
      this.webSocketClient.connect()
    }
  }

  // Disconnect from server
  public disconnect() {
    if (this.webSocketClient) {
      this.webSocketClient.disconnect()
    }
  }

  // Reset avatar controller (for prefab replacement)
  public resetAvatarController() {
    if (this.avatarController) {
      this.avatarController.resetAvatar()
      print("[MocopiMainController] Avatar controller reset")
      log.i("Avatar controller reset for prefab replacement")
    }
  }

  // Reset avatar pose
  public resetAvatar() {
    if (this.avatarController) {
      this.avatarController.resetPose()
    }
  }

  // Get connection stats
  public getConnectionStats() {
    if (this.webSocketClient) {
      return this.webSocketClient.getStats()
    }
    return null
  }
}
