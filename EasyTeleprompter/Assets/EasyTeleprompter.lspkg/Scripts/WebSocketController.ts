import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";

@component
export class WebSocketController extends BaseScriptComponent {
  private internetModule: InternetModule = require("LensStudio:InternetModule")
  @input
  @hint("WebSocket server URL (e.g., wss://google-slide-spectacles-03332e1cf78e.herokuapp.com)")
  serverUrl: string = "wss://google-slide-spectacles-03332e1cf78e.herokuapp.com"

  @input
  @hint("Text component to display connection status")
  statusText: Text

  @input
  @hint("Auto-connect on start")
  autoConnect: boolean = true

  @input
  @hint("Maximum reconnection attempts")
  maxReconnectAttempts: number = 5

  @input
  @hint("Reconnection interval in seconds")
  reconnectInterval: number = 3.0

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Logging Configuration</span>')

  @input
  @hint("Enable general logging")
  enableLogging: boolean = false

  @input
  @hint("Enable lifecycle logging (onAwake, onStart, etc.)")
  enableLoggingLifecycle: boolean = false

  private logger: Logger

  private webSocket: WebSocket
  private isConnected: boolean = false
  private reconnectAttempts: number = 0
  private reconnectTimer: number = 0
  private isReconnecting: boolean = false

  // Track last received command
  private lastCommand: string = ""
  private lastCommandTime: number = 0

  onAwake() {
    this.logger = new Logger("WebSocketController", this.enableLogging || this.enableLoggingLifecycle, true);

    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }

    this.createEvent("OnStartEvent").bind(() => {
      if (this.autoConnect) {
        this.connect()
      }
    })

    this.createEvent("UpdateEvent").bind(() => {
      this.update()
    })
  }

  update() {
    // Handle reconnection if needed
    if (this.isReconnecting) {
      this.reconnectTimer -= getDeltaTime()
      if (this.reconnectTimer <= 0) {
        this.attemptReconnect()
      }
    }
  }

  // Connect to the WebSocket server
  public connect() {
    if (this.isConnected) {
      this.logger.debug("Already connected to WebSocket server")
      return
    }

    if (!this.internetModule) {
      this.logger.error("Internet Module is not assigned. Please assign it in the Inspector.")
      this.updateStatus("Error: No Internet Module")
      return
    }

    this.logger.debug(`Connecting to WebSocket server: ${this.serverUrl}`)
    this.updateStatus("Connecting...")

    try {
      // Create WebSocket using the Internet Module
      this.webSocket = this.internetModule.createWebSocket(this.serverUrl)
      this.webSocket.binaryType = "blob"

      // Set up event handlers
      this.webSocket.onopen = (event) => {
        this.logger.debug("WebSocket connection established")
        this.isConnected = true
        this.reconnectAttempts = 0
        this.isReconnecting = false
        this.updateStatus("Connected")
      }

      this.webSocket.onmessage = (message) => {
        this.logger.debug(`Received message: ${message}`)
        this.handleMessage(message)
      }

      this.webSocket.onclose = () => {
        this.logger.debug("WebSocket connection closed")
        this.isConnected = false
        this.updateStatus("Disconnected")

        // Start reconnection process
        if (!this.isReconnecting) {
          this.startReconnection()
        }
      }

      this.webSocket.onerror = (event) => {
        this.logger.error("WebSocket error")
        this.updateStatus("Connection error")
      }
    } catch (error) {
      this.logger.error(`Error creating WebSocket: ${error}`)
      this.updateStatus("Connection failed")

      // Start reconnection process
      if (!this.isReconnecting) {
        this.startReconnection()
      }
    }
  }

  // Disconnect from the WebSocket server
  public disconnect() {
    if (!this.isConnected || !this.webSocket) {
      this.logger.debug("Not connected to WebSocket server")
      return
    }

    this.logger.debug("Disconnecting from WebSocket server")
    this.isReconnecting = false // Stop any reconnection attempts

    try {
      this.webSocket.close()
      this.webSocket = null
      this.isConnected = false
      this.updateStatus("Disconnected")
    } catch (error) {
      this.logger.error(`Error disconnecting: ${error}`)
    }
  }

  // Check if WebSocket is connected
  public isWebSocketConnected(): boolean {
    return this.isConnected
  }

  // Send a generic message to the WebSocket server
  public sendMessage(messageObj: any) {
    if (!this.isConnected || !this.webSocket) {
      this.logger.warn("Cannot send message: Not connected to WebSocket server")
      return false
    }

    try {
      const message = JSON.stringify(messageObj)
      this.logger.debug(`Sending message: ${message}`)
      this.webSocket.send(message)
      return true
    } catch (error) {
      this.logger.error(`Error sending message: ${error}`)
      return false
    }
  }

  // Send a command to the WebSocket server
  public sendCommand(command: string) {
    return this.sendMessage({
      type: "command",
      command: command
    })
  }

  // Send a "next" command
  public next() {
    return this.sendCommand("next")
  }

  // Send a "previous" command
  public previous() {
    return this.sendCommand("previous")
  }

  // Check if a "next" command was received
  public wasNextCommandReceived(sinceTime: number = 0): boolean {
    return this.lastCommand === "next" && this.lastCommandTime > sinceTime
  }

  // Check if a "previous" command was received
  public wasPreviousCommandReceived(sinceTime: number = 0): boolean {
    return this.lastCommand === "previous" && this.lastCommandTime > sinceTime
  }

  // Get the last command received
  public getLastCommand(): {command: string; timestamp: number} {
    return {
      command: this.lastCommand,
      timestamp: this.lastCommandTime
    }
  }

  // Clear the last command (useful after processing a command)
  public clearLastCommand(): void {
    this.lastCommand = ""
    this.lastCommandTime = 0
  }

  // Handle incoming messages
  private handleMessage(data: any) {
    try {
      // Parse the message data
      let messageData = data

      // If data is a string, parse it as JSON
      if (typeof data === "string") {
        messageData = JSON.parse(data)
      }
      // If data is a MessageEvent (from WebSocket), extract the data property
      else if (data && data.data) {
        const dataStr = data.data.toString()
        messageData = JSON.parse(dataStr)
      }

      this.logger.debug(`Processing message: ${JSON.stringify(messageData)}`)

      if (messageData.type === "command") {
        this.logger.debug(`Received command: ${messageData.command}`)

        // Process specific commands
        switch (messageData.command) {
          case "next":
            // Store the command and timestamp
            this.lastCommand = "next"
            this.lastCommandTime = Date.now() / 1000 // Convert to seconds
            this.logger.debug("Received next command")
            break

          case "previous":
            // Store the command and timestamp
            this.lastCommand = "previous"
            this.lastCommandTime = Date.now() / 1000 // Convert to seconds
            this.logger.debug("Received previous command")
            break

          default:
            this.logger.debug(`Unknown command: ${messageData.command}`)
            break
        }
      }
    } catch (error) {
      this.logger.error(`Error processing message: ${error}`)
    }
  }

  // Start the reconnection process
  private startReconnection() {
    if (this.isReconnecting) {
      return
    }

    this.isReconnecting = true
    this.reconnectAttempts = 0
    this.reconnectTimer = this.reconnectInterval
    this.logger.debug("Starting reconnection process")
    this.updateStatus("Reconnecting...")
  }

  // Attempt to reconnect to the WebSocket server
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.debug("Maximum reconnection attempts reached")
      this.isReconnecting = false
      this.updateStatus("Reconnection failed")
      return
    }

    this.reconnectAttempts++
    this.logger.debug(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)
    this.updateStatus(`Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)

    this.connect()

    // Set timer for next attempt if this one fails
    this.reconnectTimer = this.reconnectInterval
  }

  // Update the status text
  private updateStatus(status: string) {
    if (this.statusText) {
      this.statusText.text = status
    }
  }
}
