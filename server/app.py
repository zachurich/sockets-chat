#!/usr/bin/env python

import os
import asyncio
import json
from datetime import datetime
import uuid
import websockets
import db

from constants import MESSAGES, EVENT

ENV = os.environ

PORT = ENV.get('PORT') if ENV.get('PORT') else 3000
HOST = ENV.get('HOST') if ENV.get('HOST') else 'localhost'

clients = {}
removed_clients = []

async def iterate_clients(_clients, callback):
    for _name in list(_clients.keys()):
        callback(_name)

async def broadcast_message(_message, _clients, log, _removed_clients = None):
    for _name in list(_clients.keys()):
        try:
            message = _message
            if isinstance(message, dict):
                print(log, message)
                db.insert(message)
            await _clients[_name].send(json.dumps(message))
        except Exception as e:
            print(f'Cannot send join message to {_name}. Removing client.', e)
            del clients[_name]
            if _removed_clients:
                _removed_clients.append(_name)
            continue

    return _removed_clients

async def send_server_message(message, websocket):
    message['time'] = datetime.now().strftime('%I:%M %p')
    message["name"] = "Server"
    await websocket.send(json.dumps(message))


def create_message(
        text,
        name = "Server",
        event = EVENT["BROADCAST"],
        meta = '',
        authorized = True,
    ):
    return {
        "name": name,
        "text": text,
        "time": datetime.now().strftime('%I:%M %p'),
        "_id": str(uuid.uuid4()),
        "_event": event,
        "_meta": meta,
        "_authorized": authorized
    }


async def socket(websocket):
    print("Started...")
    try:
        incoming_name = await websocket.recv()
        name_obj = json.loads(incoming_name)
        print(name_obj)
        name = name_obj["name"]
        event = name_obj["_event"]
        is_name_taken = clients.get(name) is not None

        if is_name_taken and event == EVENT["JOIN"]:
            private_message = create_message(
                 text=MESSAGES["ALREADY_HERE"].format(name),
                 event=EVENT["REJECT_NAME"],
                 meta=name,
                 authorized=False
            )
            await send_server_message(private_message, websocket)
        else:
            clients[name] = websocket
            print(clients)
            joined_message = create_message(
                 text=MESSAGES["HERE"].format(name),
                 event=EVENT["ACCEPT_NAME"],
                 meta=name,
            )

            # User joined
            await broadcast_message(joined_message, clients, f"New client joined - {name}")

            # Listen for user messages
            while True:
                incoming_data = await websocket.recv()
                data_obj = json.loads(incoming_data)

                # User manually left, delete them and broadcast
                if data_obj["_event"] == EVENT["LEAVE"]:
                    del clients[data_obj['name']]

                    left_message = create_message(
                        text=MESSAGES["LEFT"].format(data_obj['name']),
                    )
                    await broadcast_message(left_message, clients, f"Left - {name}")
                # Regular incoming message
                else:
                    broadcast = create_message(
                        text=data_obj["text"],
                        name=data_obj["name"],
                    )
                    await broadcast_message(
                        broadcast,
                        clients,
                        "Recieved message:"
                    )

    except websockets.exceptions.ConnectionClosed as e:
        print('A connection was closed.', e)

          # If we have clients, broadcast that somebody left
        if bool(clients):
            # This sends an empty message to check which clients 
            # disconnected and returns any that are being removed
            _removed_clients = await broadcast_message(
              '', 
              clients,
              'Removing clients',
              removed_clients[:]
            )
            if len(_removed_clients) > 0:
                removed_names = ', '.join(_removed_clients)
                outgoing_message = create_message(
                    text=MESSAGES["LEFT"].format(removed_names),
                )

                # Actually send out person left message
                await broadcast_message(
                  outgoing_message,
                  clients,
                  'Broadcasting client(s) that left'
                )
    except Exception as e:
        print('An unknown exception occured', e)

async def main():
    print("Starting server on port", PORT, HOST)
    # db.init()
    async with websockets.serve(socket, HOST, PORT):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
