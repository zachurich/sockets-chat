#!/usr/bin/env python

import sqlite3

def _get_connection():
    print('Getting connection')
    db = sqlite3.connect("sockets-chat.db")
    cur = db.cursor()
    return cur, db


def init():
    cur, db = _get_connection()
    try:
        is_table_created = bool(
          cur.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='chat'"
          ).fetchone()
        )
        if is_table_created is False:
            print('Table does not exist, creating')
            cur.execute(
              "CREATE TABLE chat(name, text, time, _id, _event, _meta, _authorized)"
            )
    except Exception as e:
        print(f'DB Init Failed: {e}')
    finally:
        db.close()

def _execute(query, data):
    cur, db = _get_connection()
    try:
        cur.execute(query, data)
        db.commit()
    except Exception as e:
        print(f'Query Failed: {query} {e}')
    finally:
        db.close()

def insert(data):
    query = "INSERT INTO chat (name, text, time, _id, _event, _meta, _authorized) VALUES (?, ?, ?, ?, ?, ?, ?)"
    values = (
        data["name"],
        data["text"],
        data["time"],
        data['_id'],
        data['_event'],
        data['_meta'],
        data['_authorized']
    )
    _execute(query, values)
