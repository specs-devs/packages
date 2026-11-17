//@component
/**
 * Enhanced Supabase client for real-time cursor broadcasting
 * This version writes cursor positions to a database table AND
 * uses Supabase Realtime channels for maximum compatibility
 */

// Use the global supabase object from CDN

class GlassesCursorClient {
    constructor() {
        this.supabase = null;
        this.channel = null;
        this.isConnected = false;
        this.userId = this.generateUserId();
        this.userColor = this.generateRandomColor();
        this.lastBroadcastTime = 0;
        this.broadcastThrottleMs = 50; // 20 FPS max
        this.lastGlassesCursorData = null; // Cache latest Glasses cursor
        this.onModeChange = null; // Callback for mode changes
    }

    generateUserId() {
        return 'pc_' + Math.random().toString(36).substr(2, 9);
    }

    generateRandomColor() {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    async connect(supabaseUrl, supabaseKey, channelName, userName) {
        try {
            // Create Supabase client using global supabase from CDN
            this.supabase = supabase.createClient(supabaseUrl, supabaseKey);
            this.channelName = channelName;
            this.userName = userName;

            // Create realtime channel for broadcasting cursor positions
            // IMPORTANT: Must match the channel name format in Glasses code: `cursor-${channelName}`
            this.channel = this.supabase.channel(`cursor-${channelName}`, {
                config: {
                    broadcast: { self: false } // Don't broadcast to self
                }
            });

            // Listen for cursor movements from Glasses
            this.channel.on('broadcast', { event: 'cursor-move' }, (msg) => {
                // Cache Glasses cursor data for follower mode
                if (msg.payload && msg.payload.user_id && msg.payload.user_id.startsWith('spectacles_')) {
                    this.lastGlassesCursorData = msg.payload;
                    console.log('📍 Received Glasses cursor:', msg.payload);
                }
            });

            // Listen for control mode changes from Glasses
            this.channel.on('broadcast', { event: 'control-mode' }, (msg) => {
                console.log('🎮 Received mode change from Glasses:', msg.payload);
                
                // Store callback for mode changes
                if (this.onModeChange) {
                    this.onModeChange(msg.payload.mode);
                }
            });

            // Subscribe to the channel
            const subscription = await this.channel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    this.isConnected = true;
                    console.log('✅ Connected to Supabase Realtime');
                    return true;
                } else if (status === 'CHANNEL_ERROR') {
                    throw new Error('Failed to subscribe to realtime channel');
                }
            });

            return true;

        } catch (error) {
            console.error('Connection error:', error);
            throw error;
        }
    }

    async broadcastCursorPosition(x, y) {
        if (!this.isConnected || !this.supabase) {
            return false;
        }

        const now = Date.now();

        // Throttle broadcasts
        if (now - this.lastBroadcastTime < this.broadcastThrottleMs) {
            return false;
        }

        this.lastBroadcastTime = now;

        const cursorData = {
            channel_name: this.channelName,
            user_id: this.userId,
            user_name: this.userName,
            x: x,
            y: y,
            color: this.userColor,
            timestamp: now
        };

        try {
            // Broadcast via Realtime channel (matches Glasses broadcaster format)
            if (this.channel) {
                this.channel.send({
                    type: 'broadcast',
                    event: 'cursor-move',
                    payload: cursorData
                });
                
                console.log(`📡 Broadcasted cursor: (${x.toFixed(1)}, ${y.toFixed(1)})`);
                return true;
            } else {
                console.warn('Channel not initialized');
                return false;
            }

        } catch (error) {
            console.error('Broadcast error:', error);
            return false;
        }
    }

    async cleanupOldPositions() {
        // No longer needed - using pure realtime broadcasts without database
        // Keeping this method for backward compatibility
        console.log('🧹 Cleanup not needed (using realtime broadcasts only)');
    }

    async sendUserPresence(status) {
        if (!this.channel) return;

        this.channel.send({
            type: 'broadcast',
            event: status === 'enter' ? 'cursor-enter' : 'cursor-leave',
            payload: {
                user_id: this.userId,
                user_name: this.userName,
                color: this.userColor,
                timestamp: Date.now()
            }
        });
    }

    disconnect() {
        if (this.channel) {
            this.channel.unsubscribe();
            this.channel = null;
        }
        this.supabase = null;
        this.isConnected = false;
        console.log('📱 Disconnected from Supabase');
    }

    isClientConnected() {
        return this.isConnected;
    }

    getUserInfo() {
        return {
            id: this.userId,
            name: this.userName,
            color: this.userColor
        };
    }

    setModeChangeCallback(callback) {
        // Set callback function to be called when Glasses changes mode
        this.onModeChange = callback;
    }

    async getGlassesCursor() {
        // Return cached Glasses cursor data from realtime broadcasts
        if (this.lastGlassesCursorData) {
            console.log('🎯 Returning cached Glasses cursor:', this.lastGlassesCursorData);
            return this.lastGlassesCursorData;
        } else {
            console.log('🔍 No Glasses cursor data received yet');
            return null;
        }
    }
}

// Make it globally available
window.GlassesCursorClient = GlassesCursorClient;