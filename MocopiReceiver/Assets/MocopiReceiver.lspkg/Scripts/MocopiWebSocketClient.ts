/**
 * Specs Inc. 2026
 * WebSocket client for receiving real-time mocopi motion capture data from relay server. Handles
 * connection management, automatic reconnection, message parsing, and FPS tracking for skeleton
 * and frame data streams.
 */

import NativeLogger from "SpectaclesInteractionKit.lspkg/Utils/NativeLogger"
import { SkeletonDefinition, FrameData, MocopiMessage, ConnectionStats } from "./MocopiDataTypes"

const log = new NativeLogger("MocopiWebSocketClient")

@component
export class MocopiWebSocketClient extends BaseScriptComponent {
  private internetModule: InternetModule = require("LensStudio:InternetModule")

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Server Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">WebSocket server URL (wss:// for production, ws:// for local testing)</span>')
  @input
  serverUrl: string = "ws://10.28.65.216:8080"

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Connection Settings</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Configure connection behavior and reconnection logic</span>')
  @input
  @hint("Auto-connect on start")
  autoConnect: boolean = true

  @input
  @hint("Maximum reconnection attempts (0 = infinite)")
  maxReconnectAttempts: number = 0

  @input
  @hint("Reconnection interval in seconds")
  reconnectInterval: number = 3.0

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Debug Settings</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Enable detailed logging for troubleshooting</span>')
  @input
  enableDebugMode: boolean = true

  private webSocket: WebSocket = null
  private isConnected: boolean = false
  private reconnectAttempts: number = 0
  private reconnectTimer: number = 0
  private isReconnecting: boolean = false

  // Data state
  private skeleton: SkeletonDefinition = null
  private latestFrame: FrameData = null

  // Statistics
  private stats: ConnectionStats = {
    connected: false,
    framesReceived: 0,
    lastFrameTime: 0,
    averageFPS: 0,
    reconnectAttempts: 0
  }
  private frameTimestamps: number[] = []
  private readonly FPS_SAMPLE_SIZE = 30

  // Event callbacks
  public onSkeletonReceived: (skeleton: SkeletonDefinition) => void = null
  public onFrameReceived: (frame: FrameData) => void = null
  public onConnected: () => void = null
  public onDisconnected: () => void = null
  public onError: (error: string) => void = null

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => {
      print("=" .repeat(60))
      print("[MocopiWebSocketClient] INITIALIZING")
      print(`[MocopiWebSocketClient] Server URL: ${this.serverUrl}`)
      print(`[MocopiWebSocketClient] Auto Connect: ${this.autoConnect}`)
      print(`[MocopiWebSocketClient] Debug Mode: ${this.enableDebugMode}`)
      print("=" .repeat(60))
      this.logInfo("mocopi WebSocket Client initialized")
      if (this.autoConnect) {
        this.connect()
      }
    })

    this.createEvent("UpdateEvent").bind(() => {
      this.update()
    })

    this.createEvent("OnDestroyEvent").bind(() => {
      this.disconnect()
    })
  }

  update() {
    // Handle reconnection timer
    if (this.isReconnecting && !this.isConnected) {
      this.reconnectTimer -= getDeltaTime()
      if (this.reconnectTimer <= 0) {
        this.attemptReconnect()
      }
    }

    // Update FPS calculation
    this.updateFPS()
  }

  // Connect to WebSocket server
  public connect() {
    if (this.isConnected) {
      this.logInfo("Already connected")
      return
    }

    this.logInfo(`Connecting to ${this.serverUrl}`)

    try {
      this.webSocket = this.internetModule.createWebSocket(this.serverUrl)
      this.webSocket.binaryType = "blob"

      this.webSocket.onopen = () => {
        print("=" .repeat(60))
        print("[MocopiWebSocketClient] CONNECTED TO SERVER!")
        print("=" .repeat(60))
        this.logInfo("Connected successfully")
        this.isConnected = true
        this.reconnectAttempts = 0
        this.isReconnecting = false
        this.stats.connected = true
        this.stats.reconnectAttempts = 0

        // Request skeleton definition
        print("[MocopiWebSocketClient] Requesting skeleton definition...")
        this.sendMessage({ type: "request_skeleton" })

        if (this.onConnected) {
          this.onConnected()
        }
      }

      this.webSocket.onmessage = async (event: WebSocketMessageEvent) => {
        await this.handleMessage(event)
      }

      this.webSocket.onclose = () => {
        this.logInfo("Connection closed")
        this.isConnected = false
        this.stats.connected = false

        if (this.onDisconnected) {
          this.onDisconnected()
        }

        if (!this.isReconnecting) {
          this.startReconnection()
        }
      }

      this.webSocket.onerror = (event) => {
        this.logError("WebSocket error occurred")
        if (this.onError) {
          this.onError("WebSocket error")
        }
      }

    } catch (error) {
      this.logError(`Connection failed: ${error}`)
      if (this.onError) {
        this.onError(`Connection failed: ${error}`)
      }
      this.startReconnection()
    }
  }

  // Disconnect from server
  public disconnect() {
    this.isReconnecting = false

    if (this.webSocket && this.isConnected) {
      this.logInfo("Disconnecting...")
      try {
        this.webSocket.close()
      } catch (error) {
        this.logError(`Error during disconnect: ${error}`)
      }
    }

    this.webSocket = null
    this.isConnected = false
    this.stats.connected = false
  }

  // Send message to server
  public sendMessage(message: any): boolean {
    if (!this.isConnected || !this.webSocket) {
      this.logWarn("Cannot send message: not connected")
      return false
    }

    try {
      const json = JSON.stringify(message)
      this.webSocket.send(json)
      this.logDebug(`Sent: ${json}`)
      return true
    } catch (error) {
      this.logError(`Error sending message: ${error}`)
      return false
    }
  }

  // Handle incoming message
  private async handleMessage(event: WebSocketMessageEvent) {
    try {
      let data: any

      // Handle text or binary data
      if (typeof event.data === "string") {
        data = JSON.parse(event.data)
      } else if (event.data instanceof Blob) {
        const text = await event.data.text()
        data = JSON.parse(text)
      } else {
        this.logWarn("Unknown message format")
        return
      }

      // Route based on message type
      if (data.type === "skeleton_definition") {
        this.handleSkeletonDefinition(data as SkeletonDefinition)
      } else if (data.type === "frame_data") {
        this.handleFrameData(data as FrameData)
      } else if (data.type === "pong") {
        this.logDebug("Pong received")
      } else {
        this.logWarn(`Unknown message type: ${data.type}`)
      }

    } catch (error) {
      this.logError(`Error handling message: ${error}`)
    }
  }

  // Handle skeleton definition
  private handleSkeletonDefinition(skeleton: SkeletonDefinition) {
    print("=" .repeat(60))
    print("[MocopiWebSocketClient] SKELETON RECEIVED!")
    print(`[MocopiWebSocketClient] Bone count: ${skeleton.num_bones}`)
    if (skeleton.bones && skeleton.bones.length > 0) {
      print(`[MocopiWebSocketClient] Bones: ${skeleton.bones.map(b => b.name).join(", ")}`)
    }
    print("=" .repeat(60))
    this.logInfo(`Skeleton received: ${skeleton.num_bones} bones`)
    this.skeleton = skeleton

    if (this.onSkeletonReceived) {
      this.onSkeletonReceived(skeleton)
    }
  }

  // Handle frame data
  private handleFrameData(frame: FrameData) {
    this.latestFrame = frame
    this.stats.framesReceived++
    this.stats.lastFrameTime = getTime()

    // Track frame timing for FPS
    this.frameTimestamps.push(getTime())
    if (this.frameTimestamps.length > this.FPS_SAMPLE_SIZE) {
      this.frameTimestamps.shift()
    }

    // Log every 50 frames to avoid spam
    if (this.stats.framesReceived % 50 === 0) {
      print(`[MocopiWebSocketClient] Frame ${frame.frame_id} | Total: ${this.stats.framesReceived} | FPS: ${this.stats.averageFPS.toFixed(1)}`)
    }

    this.logDebug(`Frame ${frame.frame_id} received`)

    if (this.onFrameReceived) {
      this.onFrameReceived(frame)
    }
  }

  // Start reconnection process
  private startReconnection() {
    if (this.maxReconnectAttempts > 0 && this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logError("Max reconnection attempts reached")
      return
    }

    this.isReconnecting = true
    this.reconnectTimer = this.reconnectInterval
    this.reconnectAttempts++
    this.stats.reconnectAttempts = this.reconnectAttempts

    this.logInfo(`Will reconnect in ${this.reconnectInterval}s (attempt ${this.reconnectAttempts})`)
  }

  // Attempt to reconnect
  private attemptReconnect() {
    this.isReconnecting = false
    this.connect()
  }

  // Update FPS calculation
  private updateFPS() {
    if (this.frameTimestamps.length < 2) {
      this.stats.averageFPS = 0
      return
    }

    const oldest = this.frameTimestamps[0]
    const newest = this.frameTimestamps[this.frameTimestamps.length - 1]
    const duration = newest - oldest

    if (duration > 0) {
      this.stats.averageFPS = (this.frameTimestamps.length - 1) / duration
    }
  }

  // Send ping to server
  public sendPing() {
    this.sendMessage({ type: "ping" })
  }

  // Getters
  public getSkeleton(): SkeletonDefinition {
    return this.skeleton
  }

  public getLatestFrame(): FrameData {
    return this.latestFrame
  }

  public getStats(): ConnectionStats {
    return this.stats
  }

  public getIsConnected(): boolean {
    return this.isConnected
  }

  // Logging helpers
  private logInfo(message: string) {
    print(`[MocopiWebSocketClient] INFO: ${message}`)
    log.i(message)
  }

  private logWarn(message: string) {
    print(`[MocopiWebSocketClient] WARN: ${message}`)
    log.w(message)
  }

  private logError(message: string) {
    print(`[MocopiWebSocketClient] ERROR: ${message}`)
    log.e(message)
  }

  private logDebug(message: string) {
    if (this.enableDebugMode) {
      print(`[MocopiWebSocketClient] DEBUG: ${message}`)
      log.d(message)
    }
  }
}
