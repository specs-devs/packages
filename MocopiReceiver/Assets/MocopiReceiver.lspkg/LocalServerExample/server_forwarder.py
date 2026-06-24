"""
mocopi UDP to Railway WebSocket Forwarder
Receives UDP from mocopi sensors and forwards to Railway WebSocket relay
"""
import asyncio
import json
import struct
import logging
import os
from datetime import datetime
from typing import Dict, Any
import websockets

# ============================================================
# CONFIGURATION
# ============================================================
RAILWAY_WEBSOCKET_URL = "wss://mocopy-railway-service-production.up.railway.app"
MOCOPI_UDP_PORT = 12351
ENABLE_FILE_LOGGING = True
# ============================================================

# Setup logging handlers
handlers = [logging.StreamHandler()]

if ENABLE_FILE_LOGGING:
    LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logs')
    os.makedirs(LOG_DIR, exist_ok=True)
    LOG_TIMESTAMP = datetime.now().strftime('%Y%m%d_%H%M%S')
    LOG_FILE = os.path.join(LOG_DIR, f'forwarder_{LOG_TIMESTAMP}.log')
    handlers.append(logging.FileHandler(LOG_FILE, mode='w'))

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=handlers
)
logger = logging.getLogger(__name__)

# Statistics
stats = {
    'udp_packets_received': 0,
    'skeleton_packets': 0,
    'frame_packets': 0,
    'ws_messages_sent': 0,
    'start_time': datetime.now().isoformat()
}

# Global state
railway_websocket = None
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
    """Parse mocopi UDP binary protocol (Sony Motion Format - MMF)"""

    _frame_counter = 0

    @staticmethod
    def detect_packet_type(data: bytes) -> str:
        if data.find(b'skdf') > 0:
            return 'skeleton'
        if data.find(b'fram') > 0 or data.find(b'btrs') > 0:
            return 'frame'
        if len(data) > 1200:
            return 'skeleton'
        else:
            return 'frame'

    @staticmethod
    def read_float_le(data: bytes, offset: int) -> float:
        return struct.unpack('<f', data[offset:offset+4])[0]

    @staticmethod
    def read_int32_le(data: bytes, offset: int) -> int:
        return struct.unpack('<i', data[offset:offset+4])[0]

    @staticmethod
    def parse_skeleton_definition(data: bytes) -> Dict[str, Any]:
        try:
            num_bones = 27
            skeleton = {
                "type": "skeleton_definition",
                "timestamp": datetime.utcnow().isoformat(),
                "num_bones": num_bones,
                "bones": []
            }

            btdt_pos = data.find(b'btdt')

            if btdt_pos > 0:
                try:
                    offset = btdt_pos + 4
                    for i in range(num_bones):
                        if offset + 36 > len(data):
                            break

                        bone_id = MocopiParser.read_int32_le(data, offset)
                        parent_id = MocopiParser.read_int32_le(data, offset + 4)
                        rx = MocopiParser.read_float_le(data, offset + 8)
                        ry = MocopiParser.read_float_le(data, offset + 12)
                        rz = MocopiParser.read_float_le(data, offset + 16)
                        rw = MocopiParser.read_float_le(data, offset + 20)
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
                    logger.warning(f"Failed to parse btdt chunk: {e}")

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
    def parse_frame_data(data: bytes) -> Dict[str, Any]:
        try:
            MocopiParser._frame_counter += 1

            frame = {
                "type": "frame_data",
                "timestamp": datetime.utcnow().isoformat(),
                "frame_id": MocopiParser._frame_counter,
                "bones": []
            }

            frid_pos = data.find(b'frid')
            if frid_pos > 0 and frid_pos + 8 <= len(data):
                frame["frame_id"] = MocopiParser.read_int32_le(data, frid_pos + 4)

            time_pos = data.find(b'time')
            if time_pos > 0 and time_pos + 12 <= len(data):
                frame["mocopi_time"] = MocopiParser.read_float_le(data, time_pos + 8)

            btrs_pos = data.find(b'btrs')

            if btrs_pos > 0:
                tran_positions = []
                search_start = btrs_pos
                while True:
                    tran_pos = data.find(b'tran', search_start)
                    if tran_pos < 0 or tran_pos >= len(data) - 28:
                        break
                    tran_positions.append(tran_pos)
                    search_start = tran_pos + 32

                try:
                    for i, tran_pos in enumerate(tran_positions):
                        if i >= 27:
                            break

                        bone_offset = tran_pos + 4

                        if bone_offset + 28 > len(data):
                            break

                        rx = MocopiParser.read_float_le(data, bone_offset)
                        ry = MocopiParser.read_float_le(data, bone_offset + 4)
                        rz = MocopiParser.read_float_le(data, bone_offset + 8)
                        rw = MocopiParser.read_float_le(data, bone_offset + 12)
                        px = MocopiParser.read_float_le(data, bone_offset + 16)
                        py = MocopiParser.read_float_le(data, bone_offset + 20)
                        pz = MocopiParser.read_float_le(data, bone_offset + 24)

                        bone = {
                            "id": i,
                            "name": BONE_NAMES[i] if i < len(BONE_NAMES) else f"bone_{i}",
                            "rotation": {"x": -rx, "y": ry, "z": rz, "w": -rw},
                            "position": {"x": -px, "y": py, "z": pz}
                        }
                        frame["bones"].append(bone)
                except Exception as e:
                    logger.warning(f"Failed to parse bone data: {e}")

            return frame
        except Exception as e:
            logger.error(f"Error parsing frame: {e}")
            return None

    @staticmethod
    def _get_parent_bone_id(bone_id: int) -> int:
        parent_map = {
            0: -1,
            1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6,
            8: 7, 9: 8, 10: 9,
            11: 6, 12: 11, 13: 12, 14: 13,
            15: 6, 16: 15, 17: 16, 18: 17,
            19: 0, 20: 19, 21: 20, 22: 21,
            23: 0, 24: 23, 25: 24, 26: 25,
        }
        return parent_map.get(bone_id, -1)


class MocopiUDPReceiver:
    """UDP receiver for mocopi data"""

    def __init__(self, port: int = 12351):
        self.port = port
        self.transport = None
        self.is_running = False

    async def start(self):
        loop = asyncio.get_running_loop()
        logger.info(f"Starting UDP receiver on port {self.port}")
        self.transport, _ = await loop.create_datagram_endpoint(
            lambda: MocopiUDPProtocol(self.on_data_received),
            local_addr=('0.0.0.0', self.port)
        )
        self.is_running = True
        logger.info(f"UDP receiver started on port {self.port}")

    def stop(self):
        if self.transport:
            self.transport.close()
            self.is_running = False
            logger.info("UDP receiver stopped")

    async def on_data_received(self, data: bytes, addr: tuple):
        global latest_skeleton, latest_frame

        stats['udp_packets_received'] += 1
        packet_num = stats['udp_packets_received']

        verbose = packet_num <= 10 or packet_num % 100 == 0

        if verbose:
            logger.info(f"UDP packet #{packet_num}: {len(data)} bytes from {addr}")

        packet_type = MocopiParser.detect_packet_type(data)

        if packet_type == 'skeleton':
            stats['skeleton_packets'] += 1
            skeleton = MocopiParser.parse_skeleton_definition(data)
            if skeleton:
                latest_skeleton = skeleton
                await forward_to_railway(skeleton)
                logger.info(f"Skeleton forwarded to Railway")

        elif packet_type == 'frame':
            stats['frame_packets'] += 1
            frame = MocopiParser.parse_frame_data(data)
            if frame:
                latest_frame = frame
                await forward_to_railway(frame)
                if stats['frame_packets'] % 100 == 0:
                    logger.info(f"Frame #{frame.get('frame_id', '?')} forwarded (total: {stats['frame_packets']})")

        if packet_num % 500 == 0:
            logger.info(f"STATS: packets={packet_num}, skeletons={stats['skeleton_packets']}, frames={stats['frame_packets']}")


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


async def forward_to_railway(data: Dict[str, Any]):
    """Forward parsed mocopi data to Railway WebSocket"""
    global railway_websocket

    if not railway_websocket:
        logger.warning("Not connected to Railway, skipping forward")
        return

    try:
        message = json.dumps(data)
        await railway_websocket.send(message)
        stats['ws_messages_sent'] += 1
    except Exception as e:
        logger.error(f"Error forwarding to Railway: {e}")


async def connect_to_railway():
    """Connect to Railway WebSocket as a client and maintain connection"""
    global railway_websocket

    while True:
        try:
            logger.info(f"Connecting to Railway: {RAILWAY_WEBSOCKET_URL}")
            async with websockets.connect(RAILWAY_WEBSOCKET_URL) as websocket:
                railway_websocket = websocket
                logger.info("Connected to Railway WebSocket!")

                # Send identification message
                await websocket.send(json.dumps({
                    "type": "forwarder_connected",
                    "timestamp": datetime.utcnow().isoformat()
                }))

                # Keep connection alive
                async for message in websocket:
                    # Handle any responses from Railway (optional)
                    logger.debug(f"Received from Railway: {message}")

        except Exception as e:
            logger.error(f"Railway connection error: {e}")
            railway_websocket = None
            logger.info("Reconnecting to Railway in 5 seconds...")
            await asyncio.sleep(5)


async def main():
    """Main entry point"""
    logger.info("=" * 60)
    logger.info("mocopi UDP to Railway WebSocket Forwarder")
    logger.info("=" * 60)
    logger.info(f"LOG FILE: {LOG_FILE if ENABLE_FILE_LOGGING else 'Console only'}")
    logger.info(f"UDP Port: {MOCOPI_UDP_PORT}")
    logger.info(f"Railway WebSocket: {RAILWAY_WEBSOCKET_URL}")
    logger.info("=" * 60)

    # Start UDP receiver
    udp_receiver = MocopiUDPReceiver(MOCOPI_UDP_PORT)
    await udp_receiver.start()

    # Connect to Railway (runs in background)
    railway_task = asyncio.create_task(connect_to_railway())

    logger.info("Forwarder ready!")
    logger.info("Configure mocopi app to send UDP to this machine's IP on port 12351")
    logger.info("Spectacles should connect to Railway WebSocket")

    await asyncio.Future()  # Run forever


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Forwarder stopped by user")
    except Exception as e:
        logger.error(f"Forwarder error: {e}")
