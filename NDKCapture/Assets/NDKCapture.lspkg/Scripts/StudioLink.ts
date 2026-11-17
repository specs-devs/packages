/**
 * SPECS Inc. 2027
 * StudioLink: the Lens side of the NDK Capture Studio connection. A WebSocket to the NDK Capture
 * Lens Studio plugin (ws://127.0.0.1:47793 by default) that carries layer frames/packets, settings,
 * markers and recordings to the Studio, and Studio commands (live layer edits, record, mark) back.
 */
import {LensMessage, StudioCommand} from "./NDKCaptureProtocol"

type Log = (message: string) => void

function internetModule(): InternetModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Lens Studio module import
  return require("LensStudio:InternetModule") as InternetModule
}

/** Messages larger than this are dropped instead of queued while the socket is busy. */
const MAX_MESSAGE = 512 * 1024

export class StudioLink {
  private socket: WebSocket | null = null
  private open = false
  private closedByUser = false
  private retryAt = 0
  private sentBytes = 0
  private droppedMessages = 0

  constructor(
    private url: string,
    private hello: () => LensMessage,
    private onCommand: (command: StudioCommand) => void,
    private log: Log
  ) {}

  get connected(): boolean {
    return this.open
  }

  get bytesSent(): number {
    return this.sentBytes
  }

  get dropped(): number {
    return this.droppedMessages
  }

  /** Call every frame; reconnects every 3 s while the Studio isn't reachable. */
  tick(now: number): void {
    if (this.closedByUser || this.open || this.socket || now < this.retryAt) return
    this.retryAt = now + 3
    this.connect()
  }

  connect(): void {
    this.closedByUser = false
    let socket: WebSocket
    try {
      socket = internetModule().createWebSocket(this.url)
    } catch (e) {
      const message = "" + e
      this.log(
        message.indexOf("not secure") >= 0
          ? "Lens Studio blocks ws:// URLs unless Experimental APIs are enabled (Project Settings)."
          : "Couldn't open " + this.url + ": " + message
      )
      return
    }
    this.socket = socket
    socket.onopen = () => {
      this.open = true
      this.log("Connected to the NDK Capture Studio at " + this.url)
      this.send(this.hello())
    }
    socket.onmessage = (event: WebSocketMessageEvent) => {
      if (typeof event.data !== "string") return
      let msg: StudioCommand
      try {
        msg = JSON.parse(event.data) as StudioCommand
      } catch (e) {
        return
      }
      if (msg && msg.type === "command") this.onCommand(msg)
    }
    const gone = () => {
      if (this.open) this.log("Studio connection closed")
      this.open = false
      this.socket = null
    }
    socket.onclose = gone
    socket.onerror = gone
  }

  close(): void {
    this.closedByUser = true
    if (this.socket) {
      try {
        this.socket.close()
      } catch (e) {
        /* already closed */
      }
    }
    this.socket = null
    this.open = false
  }

  /** Send a message; returns false when not connected or the message is too large. */
  send(message: LensMessage): boolean {
    if (!this.open || !this.socket) return false
    const text = JSON.stringify(message)
    if (text.length > MAX_MESSAGE) {
      this.droppedMessages++
      return false
    }
    try {
      this.socket.send(text)
      this.sentBytes += text.length
      return true
    } catch (e) {
      this.droppedMessages++
      return false
    }
  }
}
