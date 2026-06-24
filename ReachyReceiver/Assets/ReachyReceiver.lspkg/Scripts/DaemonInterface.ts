import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent } from "SnapDecorators.lspkg/decorators";

/**
 * Specs Inc. 2026
 * WebSocket interface for communicating with Reachy Mini robot daemon.
 * Provides singleton access to robot control APIs including movement, emotions, and tracking.
 * Handles WebSocket connection management with automatic reconnection.
 */

/**
 * Represents a 3D pose using position (x, y, z) in meters and orientation (roll, pitch, yaw) angles in radians.
 */
export interface XYZRPYPose {
    x: number;
    y: number;
    z: number;
    roll: number;
    pitch: number;
    yaw: number;
}

/**
 * Represents a unique identifier for a move task.
 */
export interface MoveUUID {
    uuid: string;
}

/**
 * WebSocket message structure
 */
interface WSMessage {
    type: string;
    [key: string]: any;
}

/**
 * Pending request tracking
 */
interface PendingRequest {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timeoutEvent: SceneEvent | null;
}

@component
export class DaemonInterface extends BaseScriptComponent {
    private static _instance: DaemonInterface | null = null;

    // IMPORTANT: Update this IP to match your computer's IP address on the network
    // Run: ifconfig | grep "inet " | grep -v 127.0.0.1
    // Example: "192.168.1.100" - Replace with your actual computer IP
    private static readonly COMPUTER_IP: string = "192.168.1.100";

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">WebSocket Configuration</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Internet module for WebSocket connections</span>')

    @input
    @hint("InternetModule asset for creating WebSocket connections")
    private internetModule!: InternetModule;

    @ui.separator
    @ui.label('<span style="color: #60A5FA;">Logging Configuration</span>')
    @ui.label('<span style="color: #94A3B8; font-size: 11px;">Control logging output for this script instance</span>')

    @input
    @hint("Enable general logging (operations, events, etc.)")
    enableLogging: boolean = false;

    @input
    @hint("Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.)")
    enableLoggingLifecycle: boolean = false;

    private logger: Logger;

    // Internal state - WebSocket URL (set via setWebSocketUrl())
    private wsUrl: string = `ws://${DaemonInterface.COMPUTER_IP}:8001/ws`;
    private socket: WebSocket | null = null;
    private isConnected: boolean = false;
    private reconnectEvent: SceneEvent | null = null;
    private pendingRequests: Map<number, PendingRequest> = new Map();
    private nextMessageId: number = 1;

    /**
     * Called when component starts
     */
    @bindStartEvent
    onStart(): void {
        this.logger = new Logger("DaemonInterface", this.enableLogging || this.enableLoggingLifecycle, true);

        if (this.enableLoggingLifecycle) {
            this.logger.debug("LIFECYCLE: onStart() - Component initializing");
        }

        // Set this instance as the singleton
        DaemonInterface._instance = this;

        if (this.enableLogging) {
            this.logger.info("Singleton instance set, starting connection");
        }

        // Start connection
        this.connect();
    }

    /**
     * Get the singleton instance of DaemonInterface
     */
    public static getInstance(): DaemonInterface | null {
        return DaemonInterface._instance;
    }

    /**
     * Check if DaemonInterface is ready (singleton initialized and connected)
     */
    public static isReady(): boolean {
        const instance = DaemonInterface._instance;
        return instance !== null && instance.isConnected;
    }

    /**
     * Set the base URL for the daemon (converts HTTP URL to WebSocket bridge URL)
     * Always uses COMPUTER_IP for Spectacles compatibility
     */
    public setBaseUrl(url: string): void {
        // Always use computer IP so Spectacles can connect to the bridge
        const wsUrl = `ws://${DaemonInterface.COMPUTER_IP}:8001/ws`;
        this.setWebSocketUrl(wsUrl);
    }

    /**
     * Set the WebSocket URL directly
     */
    public setWebSocketUrl(url: string): void {
        if (this.wsUrl === url && this.isConnected) {
            if (this.enableLogging) {
                this.logger.info(`Already connected to ${url}`);
            }
            return;
        }

        this.wsUrl = url;
        if (this.enableLogging) {
            this.logger.info(`WebSocket URL updated to: ${url}`);
        }

        // Reconnect with new URL
        this.disconnect();
        this.connect();
    }

    /**
     * Get the current WebSocket URL
     */
    public getBaseUrl(): string {
        return this.wsUrl;
    }

    /**
     * Connect to WebSocket server
     */
    private connect(): void {
        if (this.socket && this.isConnected) {
            return; // Already connected
        }

        try {
            if (this.enableLogging) {
                this.logger.info(`Connecting to ${this.wsUrl}...`);
            }

            this.socket = this.internetModule.createWebSocket(this.wsUrl);
            this.socket.binaryType = 'blob';

            this.socket.onopen = (event) => {
                this.isConnected = true;
                if (this.enableLogging) {
                    this.logger.info(`WebSocket connected to ${this.wsUrl}`);
                }

                // Clear reconnect event
                if (this.reconnectEvent) {
                    this.removeEvent(this.reconnectEvent);
                    this.reconnectEvent = null;
                }
            };

            this.socket.onmessage = (event) => {
                try {
                    // event.data is either a string or a Blob
                    let text: string;

                    if (typeof event.data === 'string') {
                        text = event.data;
                    } else {
                        // If it's a Blob, we need to read it
                        // For now, we'll assume string format (most common)
                        if (this.enableLogging) {
                            this.logger.debug("Warning: Received Blob data, expected string");
                        }
                        return;
                    }

                    const response = JSON.parse(text);
                    this.handleResponse(response);
                } catch (error) {
                    if (this.enableLogging) {
                        this.logger.error(`Error parsing message: ${error}`);
                    }
                }
            };

            this.socket.onerror = (event) => {
                if (this.enableLogging) {
                    this.logger.error(`WebSocket error: ${event}`);
                }
            };

            this.socket.onclose = (event) => {
                this.isConnected = false;
                if (this.enableLogging) {
                    this.logger.info(`WebSocket closed (code: ${event.code}, reason: ${event.reason})`);
                }

                // Reject all pending requests
                this.rejectAllPendingRequests("WebSocket connection closed");

                // Attempt reconnect after 2 seconds
                if (!this.reconnectEvent) {
                    this.reconnectEvent = this.createEvent("DelayedCallbackEvent");
                    (this.reconnectEvent as DelayedCallbackEvent).bind(() => {
                        if (this.enableLogging) {
                            this.logger.info("Attempting to reconnect...");
                        }
                        this.reconnectEvent = null;
                        this.connect();
                    });
                    (this.reconnectEvent as DelayedCallbackEvent).reset(2.0); // 2 seconds
                }
            };

        } catch (error) {
            if (this.enableLogging) {
                this.logger.error(`Failed to create WebSocket: ${error}`);
            }
            this.isConnected = false;
        }
    }

    /**
     * Disconnect from WebSocket server
     */
    private disconnect(): void {
        if (this.reconnectEvent) {
            this.removeEvent(this.reconnectEvent);
            this.reconnectEvent = null;
        }

        if (this.socket) {
            try {
                this.socket.close();
            } catch (error) {
                if (this.enableLogging) {
                    this.logger.error(`Error closing socket: ${error}`);
                }
            }
            this.socket = null;
        }

        this.isConnected = false;
        this.rejectAllPendingRequests("Disconnected");
    }

    /**
     * Send a message and wait for response
     */
    private async sendMessage(message: WSMessage, timeoutSeconds: number = 5): Promise<any> {
        if (!this.socket || !this.isConnected) {
            throw new Error("WebSocket not connected");
        }

        return new Promise((resolve, reject) => {
            const messageId = this.nextMessageId++;

            // Set up timeout using Lens Studio's event system
            const timeoutEvent = this.createEvent("DelayedCallbackEvent");
            (timeoutEvent as DelayedCallbackEvent).bind(() => {
                this.pendingRequests.delete(messageId);
                reject(new Error(`Request timeout for ${message.type}`));
            });
            (timeoutEvent as DelayedCallbackEvent).reset(timeoutSeconds);

            // Store pending request
            this.pendingRequests.set(messageId, { resolve, reject, timeoutEvent });

            // Add message ID to track response
            const messageWithId = { ...message, _id: messageId };

            try {
                this.socket!.send(JSON.stringify(messageWithId));
            } catch (error) {
                if (timeoutEvent) {
                    this.removeEvent(timeoutEvent);
                }
                this.pendingRequests.delete(messageId);
                reject(error);
            }
        });
    }

    /**
     * Send a fire-and-forget message (no response expected)
     */
    private sendMessageNoResponse(message: WSMessage): void {
        if (!this.socket || !this.isConnected) {
            return; // Silently ignore if not connected
        }

        try {
            this.socket.send(JSON.stringify(message));
        } catch (error) {
            // Silently ignore errors for fire-and-forget messages
        }
    }

    /**
     * Handle WebSocket response
     */
    private handleResponse(response: any): void {
        const messageId = response._id;

        if (messageId !== undefined) {
            const pending = this.pendingRequests.get(messageId);
            if (pending) {
                // Clear timeout event
                if (pending.timeoutEvent) {
                    this.removeEvent(pending.timeoutEvent);
                }
                this.pendingRequests.delete(messageId);

                if (response.status === "ok") {
                    pending.resolve(response);
                } else {
                    pending.reject(new Error(response.message || `Request failed: ${response.type}`));
                }
            }
        }
    }

    /**
     * Reject all pending requests
     */
    private rejectAllPendingRequests(reason: string): void {
        for (const [id, pending] of this.pendingRequests) {
            if (pending.timeoutEvent) {
                this.removeEvent(pending.timeoutEvent);
            }
            pending.reject(new Error(reason));
        }
        this.pendingRequests.clear();
    }

    /**
     * Check if the daemon is available and responding
     * @returns true if connection is successful, false otherwise
     */
    public async checkConnection(): Promise<boolean> {
        try {
            const response = await this.sendMessage({ type: "health" }, 2);
            return response.status === "ok";
        } catch (error) {
            return false;
        }
    }

    /**
     * List available recorded moves in a dataset
     * @param datasetName Name of the dataset to query (may contain slashes, will be URL-encoded)
     * @returns Array of move names available in the dataset
     */
    public async listRecordedMoves(datasetName: string): Promise<string[]> {
        const response = await this.sendMessage({
            type: "list_recorded_moves",
            dataset_name: datasetName
        });
        return response.moves as string[];
    }

    /**
     * Play a recorded move from a dataset
     * @param datasetName Name of the dataset containing the move
     * @param moveName Name of the move to play
     * @returns MoveUUID to track/stop the move
     */
    public async playRecordedMove(datasetName: string, moveName: string): Promise<string> {
        const response = await this.sendMessage({
            type: "play_recorded_move",
            dataset_name: datasetName,
            move_name: moveName
        });
        return response.uuid;
    }

    /**
     * Stop a running move task
     * @param moveUuid UUID of the move to stop
     */
    public async stopMove(moveUuid: string): Promise<void> {
        await this.sendMessage({
            type: "stop_move",
            uuid: moveUuid
        });
    }

    /**
     * Get list of currently running move tasks
     * @returns Array of MoveUUID for running moves
     */
    public async getRunningMoves(): Promise<MoveUUID[]> {
        const response = await this.sendMessage({
            type: "get_running_moves"
        });
        return response.moves as MoveUUID[];
    }

    /**
     * Request a movement to a specific target using goto
     * @param headPose Target head pose (x, y, z in meters, roll, pitch, yaw in radians)
     * @param bodyYaw Optional target body yaw in radians
     * @param duration Duration of the movement in seconds (default: 0.5)
     * @param interpolation Interpolation mode: "linear", "minjerk", "ease", or "cartoon" (default: "minjerk")
     * @returns MoveUUID to track/stop the move
     */
    public async goto(headPose: XYZRPYPose, bodyYaw?: number, duration: number = 0.5, interpolation: string = "minjerk"): Promise<string> {
        const message: any = {
            type: "goto",
            head_pose: headPose,
            duration: duration,
            interpolation: interpolation
        };
        if (bodyYaw !== undefined) {
            message.body_yaw = bodyYaw;
        }
        const response = await this.sendMessage(message);
        return response.uuid;
    }

    /**
     * Set target pose immediately (no interpolation)
     * Used for real-time tracking at high frequency (e.g., 50Hz)
     * Fire-and-forget to avoid blocking at 60fps
     * @param headPose Target head pose (x, y, z in meters, roll, pitch, yaw in radians)
     * @param bodyYaw Optional target body yaw in radians
     * @param antennas Optional antenna positions [left, right] in radians
     */
    public async setTarget(headPose: XYZRPYPose, bodyYaw?: number, antennas?: [number, number]): Promise<void> {
        const message: any = {
            type: "set_target",
            head_pose: headPose,
            antennas: antennas ?? [0, 0]
        };
        if (bodyYaw !== undefined) {
            message.body_yaw = bodyYaw;
        }

        // Fire-and-forget for high-frequency updates
        this.sendMessageNoResponse(message);
    }
}
