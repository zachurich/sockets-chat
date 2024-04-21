#!/usr/bin/env python

import asyncio
import websockets

port = 4000;

async def hello(websocket):
    name = await websocket.recv()
    print(f"<<< {name}")

    greeting = f"Hello {name}!"

    await websocket.send(greeting)
    print(f">>> {greeting}")

async def main():
  print("Starting server on port", port)
  async with websockets.serve(hello, "localhost", port):
      await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())