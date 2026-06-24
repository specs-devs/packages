import asyncio
import websockets
import sys

async def test_websocket():
    uri = "ws://10.28.65.123/ws"
    print(f"Connecting to {uri}...")
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected!")

            message_count = 0
            while True:
                message_count += 1
                message = f"Hello ESP32! Message #{message_count}"
                print(f"Sending: {message}")
                await websocket.send(message)

                response = await websocket.recv()
                print(f"Received: {response}")

                # Wait 1 second before sending the next message
                await asyncio.sleep(1)

    except KeyboardInterrupt:
        print("\nStopped by user")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    # Check if websockets is installed
    try:
        import websockets
    except ImportError:
        print("Error: 'websockets' library not found.")
        print("Please install it using: pip install websockets")
        sys.exit(1)

    asyncio.run(test_websocket())

