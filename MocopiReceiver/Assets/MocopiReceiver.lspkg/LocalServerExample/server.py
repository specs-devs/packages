"""
mocopi WebSocket Relay Server
Receives UDP from mocopi sensors and relays via WebSocket to Spectacles
"""
import asyncio
import json
import struct
import logging
import os
from datetime import datetime
from typing import Set, Dict, Any
import websockets
from websockets.server import WebSocketServerProtocol

# ============================================================
# CONFIGURATION
# ============================================================
# Set to False to disable file logging (console only)
ENABLE_FILE_LOGGING = True
# ============================================================

# Setup logging handlers
handlers = [logging.StreamHandler()]  # Console output (always enabled)

if ENABLE_FILE_LOGGING:
    LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logs')
    os.makedirs(LOG_DIR, exist_ok=True)
    LOG_TIMESTAMP = datetime.now().strftime('%Y%m%d_%H%M%S')
    LOG_FILE = os.path.join(LOG_DIR, f'server_{LOG_TIMESTAMP}.log')
    handlers.append(logging.FileHandler(LOG_FILE, mode='w'))

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=handlers
)
logger = logging.getLogger(__name__)

# Counters for statistics
stats = {
    'udp_packets_received': 0,
    'skeleton_packets': 0,
    'frame_packets': 0,
    'ws_messages_sent': 0,
    'ws_clients_connected': 0,
    'start_time': datetime.now().isoformat()
}

# Global state
connected_clients: Set[WebSocketServerProtocol] = set()
latest_skeleton: Dict[str, Any] = None
latest_frame: Dict[str, Any] = None

# mocopi bone names (27 bones)
BONE_NAMES = [
    "root", "torso_1", "torso_2", "torso_3", "torso_4", "torso_5", "torso_6", "torso_7",
    "neck_1", "neck_2", "head",
    "l_shoulder", "l_up_arm", "l_low_arm", "l_hand",
    "r_shoulder", "r_up_arm", "r_low_arm", "r_hand",
    "l_up_leg", "l_low_leg", "l_foot", "l_toes",
    "r_up_leg", "r_low_leg", "r_foot", "r_toes"
]


class MocopiParser:
    """
    Parse mocopi UDP binary protocol (Sony Motion Format - MMF)
    
    Packet structure is nested TLV (Type-Length-Value) chunks:
    - head: Main container
      - ftyp: File type ("sony motion format")
      - vrsn: Version
      - sndf: Sender info (present in ALL packets)
      - skdf: Skeleton definition (only in skeleton packets)
      - fram: Frame data (only in frame packets)
        - frid: Frame ID
        - time: Timestamp
        - btrs: Bone transforms
    """
    
    # Frame counter for generating IDs
    _frame_counter = 0
    
    @staticmethod
    def find_chunk(data: bytes, marker: bytes) -> int:
        """Find the position of a chunk marker in the data"""
        return data.find(marker)
    
    @staticmethod
    def detect_packet_type(data: bytes) -> str:
        """
        Detect whether packet is skeleton definition or frame data
        by looking for specific markers deeper in the packet.
        
        All packets have: head, ftyp, vrsn, sndf
        Skeleton packets have: skdf (skeleton definition)
        Frame packets have: fram or btrs (bone transforms)
        """
        # Look for skeleton definition marker "skdf" (0x736b6466)
        if data.find(b'skdf') > 0:
            return 'skeleton'
        
        # Look for frame markers: "fram" (0x6672616d) or "btrs" (0x62747273)
        if data.find(b'fram') > 0 or data.find(b'btrs') > 0:
            return 'frame'
        
        # If no clear marker, use heuristics
        # Skeleton definition packets are typically larger (>1000 bytes) and sent once
        # Frame data packets are smaller and sent at 50fps
        if len(data) > 1200:
            return 'skeleton'
        else:
            return 'frame'
    
    @staticmethod
    def read_float_le(data: bytes, offset: int) -> float:
        """Read little-endian float from bytes"""
        return struct.unpack('<f', data[offset:offset+4])[0]
    
    @staticmethod
    def read_int32_le(data: bytes, offset: int) -> int:
        """Read little-endian int32 from bytes"""
        return struct.unpack('<i', data[offset:offset+4])[0]

    @staticmethod
    def parse_skeleton_definition(data: bytes) -> Dict[str, Any]:
        """
        Parse skeleton definition packet.
        Contains bone hierarchy and initial T-pose transforms.
        """
        try:
            num_bones = 27
            skeleton = {
                "type": "skeleton_definition",
                "timestamp": datetime.utcnow().isoformat(),
                "num_bones": num_bones,
                "bones": []
            }
            
            # Try to find and parse btdt (bone data) chunks
            btdt_pos = data.find(b'btdt')
            
            if btdt_pos > 0:
                logger.debug(f"Found btdt at position {btdt_pos}")
                # Parse actual bone data from btdt chunk
                # Structure after btdt marker:
                # - 4 bytes: chunk size
                # - For each bone: bone_id(4), parent_id(4), rot(16), pos(12) = 36 bytes per bone
                try:
                    chunk_size = MocopiParser.read_int32_le(data, btdt_pos - 4)
                    offset = btdt_pos + 4  # Skip "btdt" marker
                    
                    for i in range(num_bones):
                        if offset + 36 > len(data):
                            break
                        
                        bone_id = MocopiParser.read_int32_le(data, offset)
                        parent_id = MocopiParser.read_int32_le(data, offset + 4)
                        
                        # Rotation quaternion (x, y, z, w)
                        rx = MocopiParser.read_float_le(data, offset + 8)
                        ry = MocopiParser.read_float_le(data, offset + 12)
                        rz = MocopiParser.read_float_le(data, offset + 16)
                        rw = MocopiParser.read_float_le(data, offset + 20)
                        
                        # Position (x, y, z)
                        px = MocopiParser.read_float_le(data, offset + 24)
                        py = MocopiParser.read_float_le(data, offset + 28)
                        pz = MocopiParser.read_float_le(data, offset + 32)
                        
                        bone = {
                            "id": bone_id if bone_id < 27 else i,
                            "name": BONE_NAMES[i] if i < len(BONE_NAMES) else f"bone_{i}",
                            "parent_id": parent_id if parent_id >= -1 and parent_id < 27 else MocopiParser._get_parent_bone_id(i),
                            "rotation": {"x": rx, "y": ry, "z": rz, "w": rw},
                            "position": {"x": px, "y": py, "z": pz}
                        }
                        skeleton["bones"].append(bone)
                        offset += 36
                        
                except Exception as e:
                    logger.warning(f"Failed to parse btdt chunk: {e}, using defaults")
            
            # If we didn't get bones from btdt, create defaults
            if len(skeleton["bones"]) < num_bones:
                skeleton["bones"] = []
                for i in range(num_bones):
                    bone = {
                        "id": i,
                        "name": BONE_NAMES[i] if i < len(BONE_NAMES) else f"bone_{i}",
                        "parent_id": MocopiParser._get_parent_bone_id(i),
                        "rotation": {"x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0},
                        "position": {"x": 0.0, "y": 0.0, "z": 0.0}
                    }
                    skeleton["bones"].append(bone)

            logger.info(f"Parsed skeleton definition: {len(skeleton['bones'])} bones")
            return skeleton

        except Exception as e:
            logger.error(f"Error parsing skeleton: {e}")
            return None

    @staticmethod
    def scan_for_quaternions(data: bytes, start: int, end: int) -> list:
        """Scan a range for valid quaternion patterns (4 floats with magnitude ~1)"""
        valid_positions = []
        for pos in range(start, min(end, len(data) - 16), 4):
            try:
                x = MocopiParser.read_float_le(data, pos)
                y = MocopiParser.read_float_le(data, pos + 4)
                z = MocopiParser.read_float_le(data, pos + 8)
                w = MocopiParser.read_float_le(data, pos + 12)
                mag = (x*x + y*y + z*z + w*w) ** 0.5
                if 0.9 < mag < 1.1 and all(-1.1 < v < 1.1 for v in [x,y,z,w]):
                    valid_positions.append((pos, x, y, z, w, mag))
            except:
                pass
        return valid_positions

    @staticmethod
    def parse_frame_data(data: bytes) -> Dict[str, Any]:
        """
        Parse frame data packet.
        Contains per-frame bone transforms (rotation + position).
        """
        try:
            MocopiParser._frame_counter += 1
            
            frame = {
                "type": "frame_data",
                "timestamp": datetime.utcnow().isoformat(),
                "frame_id": MocopiParser._frame_counter,
                "bones": []
            }
            
            # Try to find frame ID from "frid" chunk
            frid_pos = data.find(b'frid')
            if frid_pos > 0 and frid_pos + 8 <= len(data):
                frame["frame_id"] = MocopiParser.read_int32_le(data, frid_pos + 4)
            
            # Try to find timestamp from "time" chunk
            time_pos = data.find(b'time')
            if time_pos > 0 and time_pos + 12 <= len(data):
                frame["mocopi_time"] = MocopiParser.read_float_le(data, time_pos + 8)
            
            # For first few frames, scan the entire packet to find where quaternions are
            if MocopiParser._frame_counter <= 3:
                logger.info(f"=== SCANNING FRAME {MocopiParser._frame_counter} FOR QUATERNION DATA ===")
                
                # Dump hex around key markers for debugging
                btrs_pos = data.find(b'btrs')
                if btrs_pos > 0:
                    hex_dump = data[btrs_pos:min(btrs_pos+100, len(data))].hex()
                    logger.info(f"Hex from btrs@{btrs_pos}: {hex_dump}")
                
                # Scan for valid quaternions in the packet
                quats = MocopiParser.scan_for_quaternions(data, 100, len(data))
                if quats:
                    logger.info(f"Found {len(quats)} valid quaternion patterns!")
                    for i, (pos, x, y, z, w, mag) in enumerate(quats[:5]):  # Show first 5
                        logger.info(f"  Quat at offset {pos}: ({x:.4f},{y:.4f},{z:.4f},{w:.4f}) mag={mag:.4f}")
                    
                    # If we found quaternions, calculate the likely bone data start
                    if len(quats) >= 27:
                        first_quat_pos = quats[0][0]
                        logger.info(f"First quaternion at offset {first_quat_pos}")
                        
                        # Check if quaternions are evenly spaced (indicating bone stride)
                        if len(quats) >= 2:
                            stride = quats[1][0] - quats[0][0]
                            logger.info(f"Quaternion stride appears to be {stride} bytes")
            
            # Find btrs chunk - it contains the bone transform data
            btrs_pos = data.find(b'btrs')
            
            if btrs_pos > 0:
                # Sony MMF structure: each bone has its own tran marker
                # Find ALL 'tran' markers and read 28 bytes after each
                # 
                # Transform data (28 bytes per bone):
                # rotation_x(4) + rotation_y(4) + rotation_z(4) + rotation_w(4) + pos_x(4) + pos_y(4) + pos_z(4)
                
                # Find all 'tran' markers in the packet
                tran_positions = []
                search_start = btrs_pos
                while True:
                    tran_pos = data.find(b'tran', search_start)
                    if tran_pos < 0 or tran_pos >= len(data) - 28:
                        break
                    tran_positions.append(tran_pos)
                    search_start = tran_pos + 32  # Move past this tran block
                
                if MocopiParser._frame_counter <= 3:
                    logger.info(f"Found {len(tran_positions)} tran markers: {tran_positions[:5]}...")
                
                # Parse bone data from each tran marker
                try:
                    for i, tran_pos in enumerate(tran_positions):
                        if i >= 27:  # Only 27 bones
                            break
                            
                        bone_offset = tran_pos + 4  # Data starts right after 'tran' marker
                        
                        if bone_offset + 28 > len(data):
                            logger.debug(f"Bone {i}: offset {bone_offset} exceeds data")
                            break
                        
                        # Read rotation quaternion (x, y, z, w) - 16 bytes
                        rx = MocopiParser.read_float_le(data, bone_offset)
                        ry = MocopiParser.read_float_le(data, bone_offset + 4)
                        rz = MocopiParser.read_float_le(data, bone_offset + 8)
                        rw = MocopiParser.read_float_le(data, bone_offset + 12)
                        
                        # Read position (x, y, z) - 12 bytes
                        px = MocopiParser.read_float_le(data, bone_offset + 16)
                        py = MocopiParser.read_float_le(data, bone_offset + 20)
                        pz = MocopiParser.read_float_le(data, bone_offset + 24)
                        
                        # Debug first few bones on first frame
                        if i < 5 and MocopiParser._frame_counter == 1:
                            qmag = (rx*rx + ry*ry + rz*rz + rw*rw) ** 0.5
                            logger.info(f"Bone {i} ({BONE_NAMES[i]}) @ {bone_offset}: quat=({rx:.4f},{ry:.4f},{rz:.4f},{rw:.4f}) mag={qmag:.4f}, pos=({px:.4f},{py:.4f},{pz:.4f})")
                        
                        # Apply coordinate conversion (from Unity reference):
                        # Position: negate X -> new Vector3(-x, y, z)
                        # Rotation: negate X and W -> new Quaternion(-x, y, z, -w)
                        bone = {
                            "id": i,
                            "name": BONE_NAMES[i] if i < len(BONE_NAMES) else f"bone_{i}",
                            "rotation": {
                                "x": -rx,
                                "y": ry,
                                "z": rz,
                                "w": -rw
                            },
                            "position": {
                                "x": -px,
                                "y": py,
                                "z": pz
                            }
                        }
                        frame["bones"].append(bone)
                        
                except Exception as e:
                    logger.warning(f"Failed to parse bone data: {e}")
            
            # If we couldn't parse bones, include raw data for debugging
            if len(frame["bones"]) == 0:
                import base64
                frame["raw_data"] = base64.b64encode(data).decode('ascii')
                frame["data_length"] = len(data)
                frame["parse_note"] = "Could not extract bone transforms"
            
            return frame

        except Exception as e:
            logger.error(f"Error parsing frame: {e}")
            return None

    @staticmethod
    def _get_parent_bone_id(bone_id: int) -> int:
        """Get parent bone ID for hierarchical structure"""
        parent_map = {
            0: -1,  # root has no parent
            1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6,  # spine chain
            8: 7, 9: 8, 10: 9,  # neck/head
            11: 6, 12: 11, 13: 12, 14: 13,  # left arm
            15: 6, 16: 15, 17: 16, 18: 17,  # right arm
            19: 0, 20: 19, 21: 20, 22: 21,  # left leg
            23: 0, 24: 23, 25: 24, 26: 25,  # right leg
        }
        return parent_map.get(bone_id, -1)


class MocopiUDPReceiver:
    """UDP receiver for mocopi data"""

    def __init__(self, port: int = 12351):
        self.port = port
        self.transport = None
        self.is_running = False

    async def start(self):
        """Start UDP receiver"""
        loop = asyncio.get_running_loop()

        logger.info(f"Starting UDP receiver on port {self.port}")
        self.transport, _ = await loop.create_datagram_endpoint(
            lambda: MocopiUDPProtocol(self.on_data_received),
            local_addr=('0.0.0.0', self.port)
        )
        self.is_running = True
        logger.info(f"UDP receiver started on port {self.port}")

    def stop(self):
        """Stop UDP receiver"""
        if self.transport:
            self.transport.close()
            self.is_running = False
            logger.info("UDP receiver stopped")

    async def on_data_received(self, data: bytes, addr: tuple):
        """Handle received UDP data"""
        global latest_skeleton, latest_frame

        stats['udp_packets_received'] += 1
        packet_num = stats['udp_packets_received']
        
        # Only log details for first few packets and then periodically
        verbose = packet_num <= 10 or packet_num % 50 == 0
        
        if verbose:
            logger.info(f"===== UDP PACKET #{packet_num} =====")
            logger.info(f"UDP: Received {len(data)} bytes from {addr}")
            logger.debug(f"UDP: First 64 bytes (hex): {data[:64].hex() if len(data) >= 64 else data.hex()}")

        # Use improved packet type detection
        packet_type = MocopiParser.detect_packet_type(data)
        
        if verbose:
            # Log what markers were found for debugging
            markers = []
            for marker in [b'head', b'ftyp', b'vrsn', b'sndf', b'skdf', b'fram', b'btrs', b'btdt', b'frid', b'time']:
                pos = data.find(marker)
                if pos >= 0:
                    markers.append(f"{marker.decode()}@{pos}")
            logger.info(f"UDP: Markers found: {', '.join(markers) if markers else 'none'}")
            logger.info(f"UDP: Detected packet type: {packet_type.upper()}")

        if packet_type == 'skeleton':
            stats['skeleton_packets'] += 1
            skeleton = MocopiParser.parse_skeleton_definition(data)
            if skeleton:
                latest_skeleton = skeleton
                clients_count = len(connected_clients)
                await broadcast_to_clients(skeleton)
                logger.info(f"UDP: Skeleton broadcasted to {clients_count} clients")
            else:
                logger.error("UDP: Failed to parse skeleton data")
                
        elif packet_type == 'frame':
            stats['frame_packets'] += 1
            frame = MocopiParser.parse_frame_data(data)
            if frame:
                latest_frame = frame
                clients_count = len(connected_clients)
                await broadcast_to_clients(frame)
                # Only log every 50th frame to reduce spam (50fps = 1 log/sec)
                if stats['frame_packets'] % 50 == 0:
                    bones_parsed = len(frame.get('bones', []))
                    logger.info(f"UDP: Frame #{frame.get('frame_id', '?')} broadcasted to {clients_count} clients (bones: {bones_parsed}, total frames: {stats['frame_packets']})")
            else:
                logger.error("UDP: Failed to parse frame data")
        
        # Log stats every 100 packets
        if packet_num % 100 == 0:
            logger.info(f"=== STATS: packets={packet_num}, skeletons={stats['skeleton_packets']}, frames={stats['frame_packets']}, clients={len(connected_clients)} ===")


class MocopiUDPProtocol:
    """UDP protocol handler"""

    def __init__(self, callback):
        self.callback = callback

    def connection_made(self, transport):
        self.transport = transport

    def datagram_received(self, data, addr):
        asyncio.create_task(self.callback(data, addr))

    def error_received(self, exc):
        logger.error(f"UDP error: {exc}")


async def broadcast_to_clients(data: Dict[str, Any]):
    """Broadcast data to all connected WebSocket clients"""
    if not connected_clients:
        logger.debug(f"BROADCAST: No clients connected, skipping")
        return

    message = json.dumps(data)
    msg_type = data.get('type', 'unknown')
    disconnected = set()
    sent_count = 0

    for client in connected_clients:
        try:
            await client.send(message)
            sent_count += 1
            stats['ws_messages_sent'] += 1
        except Exception as e:
            logger.error(f"BROADCAST: Error sending to client {client.remote_address}: {e}")
            disconnected.add(client)

    # Remove disconnected clients
    for client in disconnected:
        connected_clients.discard(client)
        logger.info(f"BROADCAST: Removed disconnected client {client.remote_address}")
    
    logger.debug(f"BROADCAST: Sent {msg_type} to {sent_count} clients (total sent: {stats['ws_messages_sent']})")


async def handle_websocket(websocket: WebSocketServerProtocol):
    """Handle WebSocket client connection"""
    client_addr = websocket.remote_address
    logger.info(f"===== WEBSOCKET CLIENT CONNECTED =====")
    logger.info(f"WS: Client connected from {client_addr}")
    connected_clients.add(websocket)
    stats['ws_clients_connected'] = len(connected_clients)
    logger.info(f"WS: Total clients now: {len(connected_clients)}")

    try:
        # Send latest skeleton and frame on connect
        if latest_skeleton:
            await websocket.send(json.dumps(latest_skeleton))
            logger.info(f"WS: Sent cached skeleton to new client")
        else:
            logger.info(f"WS: No cached skeleton to send")
            
        if latest_frame:
            await websocket.send(json.dumps(latest_frame))
            logger.info(f"WS: Sent cached frame to new client")
        else:
            logger.info(f"WS: No cached frame to send")

        # Keep connection alive and handle client messages
        async for message in websocket:
            try:
                data = json.loads(message)
                logger.info(f"WS: Received from client {client_addr}: {data}")

                # Handle client commands
                if data.get("type") == "ping":
                    await websocket.send(json.dumps({
                        "type": "pong",
                        "timestamp": datetime.utcnow().isoformat()
                    }))
                    logger.debug(f"WS: Sent pong to {client_addr}")
                elif data.get("type") == "request_skeleton":
                    if latest_skeleton:
                        await websocket.send(json.dumps(latest_skeleton))
                        logger.info(f"WS: Sent skeleton on request to {client_addr}")

            except json.JSONDecodeError:
                logger.warning(f"WS: Invalid JSON from client: {message}")
            except Exception as e:
                logger.error(f"WS: Error handling client message: {e}")

    except websockets.exceptions.ConnectionClosed:
        logger.info(f"WS: Client {client_addr} disconnected normally")
    except Exception as e:
        logger.error(f"WS: WebSocket error with {client_addr}: {e}")
    finally:
        connected_clients.discard(websocket)
        stats['ws_clients_connected'] = len(connected_clients)
        logger.info(f"WS: Client {client_addr} removed, {len(connected_clients)} clients remaining")


async def main():
    """Main server entry point"""
    # Configuration
    udp_port = int(os.environ.get('MOCOPI_UDP_PORT', 12351))
    ws_port = int(os.environ.get('PORT', 8080))
    ws_host = os.environ.get('HOST', '0.0.0.0')

    logger.info("=" * 60)
    logger.info("mocopi WebSocket Relay Server")
    logger.info("=" * 60)
    logger.info(f"LOG FILE: {LOG_FILE}")
    logger.info(f"UDP Port: {udp_port}")
    logger.info(f"WebSocket: ws://{ws_host}:{ws_port}")
    logger.info("=" * 60)
    
    # Print to console for easy copy
    print(f"\n{'='*60}")
    print(f"LOG FILE LOCATION:")
    print(f"  {LOG_FILE}")
    print(f"{'='*60}\n")

    # Start UDP receiver
    udp_receiver = MocopiUDPReceiver(udp_port)
    await udp_receiver.start()

    # Start WebSocket server
    async with websockets.serve(handle_websocket, ws_host, ws_port):
        logger.info("Server ready - waiting for connections")
        logger.info("Waiting for mocopi UDP data on port 12351...")
        logger.info("Waiting for WebSocket clients on port 8080...")
        await asyncio.Future()  # Run forever


def write_final_stats():
    """Write final statistics to log"""
    stats['end_time'] = datetime.now().isoformat()
    logger.info("=" * 60)
    logger.info("FINAL STATISTICS")
    logger.info("=" * 60)
    for key, value in stats.items():
        logger.info(f"  {key}: {value}")
    logger.info("=" * 60)
    logger.info(f"Log file saved to: {LOG_FILE}")
    print(f"\nLog file saved to: {LOG_FILE}")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server stopped by user (Ctrl+C)")
        write_final_stats()
    except Exception as e:
        logger.error(f"Server error: {e}")
        write_final_stats()
