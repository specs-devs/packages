#!/usr/bin/env python3
"""
WebSocket Bridge for Reachy Mini
Bridges WebSocket connections from Spectacles to Reachy daemon using NATIVE WebSocket endpoint
"""

import asyncio
import json
import logging
from typing import Optional, Dict, Any
import aiohttp
from aiohttp import web
import websockets

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ReachyWebSocketBridge:
    def __init__(self, daemon_url: str = "http://localhost:8000", ws_port: int = 8001):
        self.daemon_url = daemon_url
        self.ws_port = ws_port
        self.app = web.Application()
        self.app.router.add_get('/ws', self.websocket_handler)
        self.app.router.add_get('/health', self.health_check)

        # WebSocket connection to robot's native WS endpoint
        self.robot_ws: Optional[websockets.WebSocketClientProtocol] = None
        self.robot_ws_lock = asyncio.Lock()
        self.reconnect_task: Optional[asyncio.Task] = None

        # Convert http:// to ws:// for WebSocket connection
        ws_daemon_url = daemon_url.replace('http://', 'ws://').replace('https://', 'wss://')
        self.robot_ws_url = f"{ws_daemon_url}/api/move/ws/set_target"

    async def health_check(self, request):
        """Health check endpoint"""
        robot_connected = self.robot_ws is not None and not self.robot_ws.closed
        return web.json_response({
            "status": "ok",
            "daemon_url": self.daemon_url,
            "robot_ws_connected": robot_connected,
            "robot_ws_url": self.robot_ws_url
        })

    async def connect_to_robot_ws(self):
        """Establish WebSocket connection to robot's native endpoint"""
        try:
            logger.info(f"Connecting to robot WebSocket: {self.robot_ws_url}")
            self.robot_ws = await websockets.connect(
                self.robot_ws_url,
                ping_interval=10,
                ping_timeout=5
            )
            logger.info(f"✓ Connected to robot WebSocket at {self.robot_ws_url}")
        except Exception as e:
            logger.error(f"Failed to connect to robot WebSocket: {e}")
            self.robot_ws = None
            # Schedule reconnect
            if not self.reconnect_task or self.reconnect_task.done():
                self.reconnect_task = asyncio.create_task(self.reconnect_to_robot())

    async def reconnect_to_robot(self):
        """Reconnect to robot WebSocket with exponential backoff"""
        retry_delay = 2
        max_delay = 30

        while True:
            await asyncio.sleep(retry_delay)
            try:
                await self.connect_to_robot_ws()
                if self.robot_ws and not self.robot_ws.closed:
                    logger.info("Successfully reconnected to robot WebSocket")
                    return
            except Exception as e:
                logger.warning(f"Reconnect attempt failed: {e}")
                retry_delay = min(retry_delay * 1.5, max_delay)

    async def ensure_robot_connection(self):
        """Ensure robot WebSocket connection is active"""
        if self.robot_ws is None or self.robot_ws.closed:
            async with self.robot_ws_lock:
                if self.robot_ws is None or self.robot_ws.closed:
                    await self.connect_to_robot_ws()

    async def websocket_handler(self, request):
        """Handle WebSocket connections from Spectacles"""
        ws = web.WebSocketResponse()
        await ws.prepare(request)

        logger.info(f"WebSocket client connected from {request.remote}")

        try:
            async for msg in ws:
                if msg.type == aiohttp.WSMsgType.TEXT:
                    try:
                        data = json.loads(msg.data)
                        logger.debug(f"Received message: {data.get('type', 'unknown')}")

                        # Extract message ID if present
                        message_id = data.get('_id')

                        # Handle different message types
                        response = await self.handle_message(data)

                        # Echo back message ID for request tracking
                        if message_id is not None:
                            response['_id'] = message_id

                        # Send response back to client
                        await ws.send_json(response)

                    except json.JSONDecodeError as e:
                        logger.error(f"Invalid JSON received: {e}")
                        await ws.send_json({"error": "Invalid JSON", "message": str(e)})
                    except Exception as e:
                        logger.error(f"Error handling message: {e}", exc_info=True)
                        await ws.send_json({"error": "Internal error", "message": str(e)})

                elif msg.type == aiohttp.WSMsgType.ERROR:
                    logger.error(f"WebSocket error: {ws.exception()}")

        except Exception as e:
            logger.error(f"WebSocket handler error: {e}", exc_info=True)
        finally:
            logger.info("WebSocket client disconnected")

        return ws

    async def handle_message(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Route message to appropriate handler"""
        msg_type = data.get("type")

        if msg_type == "health":
            return await self.check_daemon_health()
        elif msg_type == "set_target":
            return await self.set_target_ws(data)  # Use WebSocket!
        elif msg_type == "goto":
            return await self.goto(data)
        elif msg_type == "play_recorded_move":
            return await self.play_recorded_move(data)
        elif msg_type == "stop_move":
            return await self.stop_move(data)
        elif msg_type == "get_running_moves":
            return await self.get_running_moves()
        elif msg_type == "list_recorded_moves":
            return await self.list_recorded_moves(data)
        else:
            return {"error": f"Unknown message type: {msg_type}"}

    async def check_daemon_health(self) -> Dict[str, Any]:
        """Check if daemon is responding"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.daemon_url}/api/health", timeout=aiohttp.ClientTimeout(total=2)) as resp:
                    robot_ws_connected = self.robot_ws is not None and not self.robot_ws.closed
                    if resp.status == 200:
                        return {
                            "type": "health",
                            "status": "ok",
                            "robot_ws_connected": robot_ws_connected
                        }
                    else:
                        return {"type": "health", "status": "error", "code": resp.status}
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return {"type": "health", "status": "error", "message": str(e)}

    async def set_target_ws(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Set target pose using native WebSocket connection (high-frequency tracking)"""
        try:
            # Ensure robot WebSocket is connected
            await self.ensure_robot_connection()

            if self.robot_ws is None or self.robot_ws.closed:
                return {"type": "set_target", "status": "error", "message": "Robot WebSocket not connected"}

            head_pose = data.get("head_pose")
            body_yaw = data.get("body_yaw")
            antennas = data.get("antennas", [0, 0])

            # Convert to robot's FullBodyTarget format
            payload = {
                "target_head_pose": head_pose,  # Robot expects "target_head_pose"
                "target_antennas": antennas
            }
            if body_yaw is not None:
                payload["target_body_yaw"] = body_yaw

            # Send through persistent WebSocket connection
            await self.robot_ws.send(json.dumps(payload))

            # Robot's WebSocket endpoint doesn't send responses for successful set_target
            # (it's fire-and-forget for performance), so we return success immediately
            return {"type": "set_target", "status": "ok"}

        except websockets.exceptions.ConnectionClosed:
            logger.warning("Robot WebSocket connection closed, attempting reconnect")
            self.robot_ws = None
            asyncio.create_task(self.reconnect_to_robot())
            return {"type": "set_target", "status": "error", "message": "Robot connection closed"}
        except Exception as e:
            logger.error(f"set_target_ws failed: {e}")
            return {"type": "set_target", "status": "error", "message": str(e)}

    async def goto(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute goto movement with interpolation (uses HTTP REST API)"""
        try:
            head_pose = data.get("head_pose")
            body_yaw = data.get("body_yaw")
            duration = data.get("duration", 0.5)
            interpolation = data.get("interpolation", "minjerk")

            payload = {
                "head_pose": head_pose,
                "duration": duration,
                "interpolation": interpolation,
                "antennas": [0, 0]
            }
            if body_yaw is not None:
                payload["body_yaw"] = body_yaw

            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.daemon_url}/api/move/goto",
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=duration + 2)
                ) as resp:
                    if resp.status == 200:
                        result = await resp.json()
                        return {"type": "goto", "status": "ok", "uuid": result.get("uuid")}
                    else:
                        text = await resp.text()
                        return {"type": "goto", "status": "error", "code": resp.status, "message": text}
        except Exception as e:
            logger.error(f"goto failed: {e}")
            return {"type": "goto", "status": "error", "message": str(e)}

    async def play_recorded_move(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Play a recorded move from dataset (uses HTTP REST API)"""
        try:
            dataset_name = data.get("dataset_name")
            move_name = data.get("move_name")

            # URL-encode the names
            from urllib.parse import quote
            encoded_dataset = quote(dataset_name, safe='')
            encoded_move = quote(move_name, safe='')

            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.daemon_url}/api/move/play/recorded-move-dataset/{encoded_dataset}/{encoded_move}",
                    timeout=aiohttp.ClientTimeout(total=5)
                ) as resp:
                    if resp.status == 200:
                        result = await resp.json()
                        return {"type": "play_recorded_move", "status": "ok", "uuid": result.get("uuid")}
                    else:
                        text = await resp.text()
                        return {"type": "play_recorded_move", "status": "error", "code": resp.status, "message": text}
        except Exception as e:
            logger.error(f"play_recorded_move failed: {e}")
            return {"type": "play_recorded_move", "status": "error", "message": str(e)}

    async def stop_move(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Stop a running move (uses HTTP REST API)"""
        try:
            uuid = data.get("uuid")

            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.daemon_url}/api/move/stop",
                    json={"uuid": uuid},
                    timeout=aiohttp.ClientTimeout(total=2)
                ) as resp:
                    if resp.status == 200:
                        return {"type": "stop_move", "status": "ok"}
                    else:
                        text = await resp.text()
                        return {"type": "stop_move", "status": "error", "code": resp.status, "message": text}
        except Exception as e:
            logger.error(f"stop_move failed: {e}")
            return {"type": "stop_move", "status": "error", "message": str(e)}

    async def get_running_moves(self) -> Dict[str, Any]:
        """Get list of currently running moves (uses HTTP REST API)"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.daemon_url}/api/move/running",
                    timeout=aiohttp.ClientTimeout(total=2)
                ) as resp:
                    if resp.status == 200:
                        result = await resp.json()
                        return {"type": "get_running_moves", "status": "ok", "moves": result}
                    else:
                        text = await resp.text()
                        return {"type": "get_running_moves", "status": "error", "code": resp.status, "message": text}
        except Exception as e:
            logger.error(f"get_running_moves failed: {e}")
            return {"type": "get_running_moves", "status": "error", "message": str(e)}

    async def list_recorded_moves(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """List available recorded moves in a dataset (uses HTTP REST API)"""
        try:
            dataset_name = data.get("dataset_name")

            from urllib.parse import quote
            encoded_dataset = quote(dataset_name, safe='')

            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.daemon_url}/api/move/recorded-move-datasets/list/{encoded_dataset}",
                    timeout=aiohttp.ClientTimeout(total=2)
                ) as resp:
                    if resp.status == 200:
                        result = await resp.json()
                        return {"type": "list_recorded_moves", "status": "ok", "moves": result}
                    else:
                        text = await resp.text()
                        return {"type": "list_recorded_moves", "status": "error", "code": resp.status, "message": text}
        except Exception as e:
            logger.error(f"list_recorded_moves failed: {e}")
            return {"type": "list_recorded_moves", "status": "error", "message": str(e)}

    async def start(self):
        """Start the WebSocket bridge server"""
        # Connect to robot WebSocket endpoint
        await self.connect_to_robot_ws()

        runner = web.AppRunner(self.app)
        await runner.setup()
        site = web.TCPSite(runner, '0.0.0.0', self.ws_port)
        await site.start()
        logger.info(f"WebSocket bridge started on ws://0.0.0.0:{self.ws_port}/ws")
        logger.info(f"Robot HTTP API: {self.daemon_url}")
        logger.info(f"Robot WebSocket: {self.robot_ws_url}")
        logger.info(f"Health check available at http://0.0.0.0:{self.ws_port}/health")

        # Keep running
        await asyncio.Event().wait()

    async def cleanup(self):
        """Clean up WebSocket connections"""
        if self.robot_ws and not self.robot_ws.closed:
            await self.robot_ws.close()

def main():
    import argparse
    parser = argparse.ArgumentParser(description="WebSocket bridge for Reachy Mini (using native WS endpoint)")
    parser.add_argument("--daemon-url", default="http://localhost:8000",
                        help="Reachy daemon URL (default: http://localhost:8000)")
    parser.add_argument("--ws-port", type=int, default=8001,
                        help="WebSocket server port (default: 8001)")
    parser.add_argument("--debug", action="store_true",
                        help="Enable debug logging")

    args = parser.parse_args()

    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)

    bridge = ReachyWebSocketBridge(daemon_url=args.daemon_url, ws_port=args.ws_port)

    try:
        asyncio.run(bridge.start())
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        asyncio.run(bridge.cleanup())

if __name__ == "__main__":
    main()
