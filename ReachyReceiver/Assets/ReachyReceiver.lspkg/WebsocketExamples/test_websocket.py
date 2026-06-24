#!/usr/bin/env python3
"""
Test script for WebSocket bridge

This script tests the WebSocket bridge by sending various commands
and verifying responses.
"""

import asyncio
import json
import websockets
import sys

async def test_health_check(ws):
    """Test health check"""
    print("Testing health check...")
    msg = {"type": "health", "_id": 1}
    await ws.send(json.dumps(msg))
    response = await ws.recv()
    data = json.loads(response)
    print(f"  Response: {data}")
    assert data.get("status") == "ok", "Health check failed"
    print("  ✓ Health check passed")

async def test_goto(ws):
    """Test goto command"""
    print("\nTesting goto command...")
    msg = {
        "type": "goto",
        "_id": 2,
        "head_pose": {
            "x": 0, "y": 0, "z": 0,
            "roll": 0, "pitch": 0, "yaw": 0
        },
        "body_yaw": 0,
        "duration": 0.5,
        "interpolation": "minjerk"
    }
    await ws.send(json.dumps(msg))
    response = await ws.recv()
    data = json.loads(response)
    print(f"  Response: {data}")
    assert data.get("status") == "ok", f"Goto failed: {data.get('message', 'Unknown error')}"
    assert "uuid" in data, "Goto response missing uuid"
    print(f"  ✓ Goto passed (UUID: {data['uuid']})")
    return data["uuid"]

async def test_get_running_moves(ws):
    """Test get running moves"""
    print("\nTesting get running moves...")
    msg = {"type": "get_running_moves", "_id": 3}
    await ws.send(json.dumps(msg))
    response = await ws.recv()
    data = json.loads(response)
    print(f"  Response: {data}")
    assert data.get("status") == "ok", "Get running moves failed"
    print(f"  ✓ Get running moves passed (count: {len(data.get('moves', []))})")

async def test_play_recorded_move(ws):
    """Test play recorded move"""
    print("\nTesting play recorded move...")
    msg = {
        "type": "play_recorded_move",
        "_id": 4,
        "dataset_name": "pollen-robotics/reachy-mini-emotions-library",
        "move_name": "attentive2"
    }
    await ws.send(json.dumps(msg))
    response = await ws.recv()
    data = json.loads(response)
    print(f"  Response: {data}")
    assert data.get("status") == "ok", f"Play recorded move failed: {data.get('message', 'Unknown error')}"
    assert "uuid" in data, "Play recorded move response missing uuid"
    print(f"  ✓ Play recorded move passed (UUID: {data['uuid']})")
    return data["uuid"]

async def test_stop_move(ws, uuid):
    """Test stop move"""
    print(f"\nTesting stop move (UUID: {uuid})...")
    msg = {"type": "stop_move", "_id": 5, "uuid": uuid}
    await ws.send(json.dumps(msg))
    response = await ws.recv()
    data = json.loads(response)
    print(f"  Response: {data}")
    assert data.get("status") == "ok", f"Stop move failed: {data.get('message', 'Unknown error')}"
    print("  ✓ Stop move passed")

async def test_set_target(ws):
    """Test set_target (fire-and-forget)"""
    print("\nTesting set_target (fire-and-forget)...")
    msg = {
        "type": "set_target",
        "head_pose": {
            "x": 0, "y": 0, "z": 0,
            "roll": 0, "pitch": 0.1, "yaw": 0
        },
        "body_yaw": 0,
        "antennas": [0, 0]
    }
    # Note: fire-and-forget doesn't expect a response when no _id is provided
    await ws.send(json.dumps(msg))
    print("  ✓ Set target sent (fire-and-forget, no response expected)")

async def run_tests(ws_url):
    """Run all tests"""
    print(f"Connecting to {ws_url}...\n")

    try:
        async with websockets.connect(ws_url) as ws:
            print("✓ Connected to WebSocket bridge\n")
            print("=" * 60)

            # Run tests
            await test_health_check(ws)
            move_uuid = await test_goto(ws)
            await test_get_running_moves(ws)

            # Wait for goto to complete
            print("\nWaiting 1 second for goto to complete...")
            await asyncio.sleep(1)

            # Play a recorded move
            recorded_uuid = await test_play_recorded_move(ws)

            # Wait a bit then stop it
            print("\nWaiting 2 seconds before stopping move...")
            await asyncio.sleep(2)
            await test_stop_move(ws, recorded_uuid)

            # Test fire-and-forget set_target
            await test_set_target(ws)

            print("\n" + "=" * 60)
            print("\n✅ All tests passed!")

    except websockets.exceptions.WebSocketException as e:
        print(f"\n❌ WebSocket error: {e}")
        print("\nMake sure the WebSocket bridge is running:")
        print("  python3 websocket_bridge.py")
        sys.exit(1)
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Test WebSocket bridge")
    parser.add_argument("--url", default="ws://localhost:8001/ws",
                        help="WebSocket URL (default: ws://localhost:8001/ws)")
    args = parser.parse_args()

    print("WebSocket Bridge Test Script")
    print("=" * 60)
    print("\nPrerequisites:")
    print("1. Reachy daemon running (port 8000)")
    print("2. WebSocket bridge running (port 8001)")
    print("\nStarting tests...\n")

    asyncio.run(run_tests(args.url))
