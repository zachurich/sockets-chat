/* eslint-disable react-hooks/exhaustive-deps */

import { useEffect, useRef, useState } from "react";
import styles from "./App.module.css";
import classnames from "classnames";
import { MESSAGES } from "./constants";

const env = import.meta.env;
const SOCKET_PATH = `ws://${env.VITE_SOCKET}`;
const isDebugEnabled =
  env.VITE_DEBUG === "true" || localStorage.getItem("DEBUG") === "true";

// Assume any event not suffixed with _CLIENT is for server communication
export type _Event =
  | "JOIN"
  | "LEAVE"
  | "BROADCAST"
  | "REJECT_NAME"
  | "ACCEPT_NAME"
  | "LEFT_CLIENT"
  | "ERROR_CLIENT"
  | "CONNECTED_CLIENT"
  | "RECONNECTED_CLIENT";

type _Meta = string;

type Message = {
  name: "Server" | string;
  text?: string;
  time?: string;
  private?: boolean;
  /**
   * uuid generated on server
   */
  _id?: string;
  /**
   * Communicate effectively with server via message type. Client-only messages have _CLIENT suffix
   */
  _event: _Event;
  /**
   * Send/Recieve actionable data from server based on event
   */
  _meta?: _Meta;
  /**
   * May be useful...
   */
  _authorized?: boolean;
};

const log = (message: string, ...args: unknown[]) => {
  if (isDebugEnabled) {
    console.log(message, ...args);
  }
};

function App() {
  const [chatText, setChatText] = useState("");
  const [name, setName] = useState<string | null>(null);
  const [nameText, setNameText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [validation, setValidation] = useState("");
  const [socketReady, setSocketReady] = useState(false);
  const [socketDisconnected, setSocketDisconnected] = useState(false);
  const [shouldPoll, setShouldPoll] = useState(false);
  const [previouslyLeft, setPreviouslyLeft] = useState(false);

  const nameRef = useRef("");

  const pollRef = useRef(0);

  const _socket = useRef<WebSocket>();
  const messageContainerRef = useRef<HTMLUListElement>(null);
  const messageContainerTimer = useRef(0);

  const onOpenSocket = (event: Event) => {
    const target = event.target as WebSocket;
    if (target.readyState === 1) {
      log("Socket ready:", target);

      setSocketReady(true);

      if (!previouslyLeft) {
        appendMessage({
          name: "Server",
          _event: shouldPoll ? "RECONNECTED_CLIENT" : "CONNECTED_CLIENT",
        });
      }

      setShouldPoll(false);
      clearTimeout(pollRef.current);

      _socket.current = target;
      pollRef.current = 0;
    }
  };

  useEffect(() => {
    console.log(shouldPoll, _socket.current, pollRef.current);
    if (_socket.current?.readyState !== 1 && !pollRef.current && shouldPoll) {
      pollRef.current = setInterval(() => {
        log("Attempting re-connect.");
        connect(true);
      }, 5000);
    }
  }, [shouldPoll]);

  const onSocketError = () => {
    appendMessage({
      name: "Server",
      _event: "ERROR_CLIENT",
    });

    if (!shouldPoll) {
      setShouldPoll(true);
    }
  };

  const connect = (skipCleanup = false) => {
    if (!socketReady) {
      const socket = new WebSocket(SOCKET_PATH);
      // Connection opened
      socket.addEventListener("open", onOpenSocket);
      socket.addEventListener("error", onSocketError);
      socket.addEventListener("close", onSocketError);

      if (!skipCleanup) {
        return () => {
          socket.removeEventListener("open", onOpenSocket);
          socket.removeEventListener("error", onSocketError);
          socket.removeEventListener("close", onSocketError);
          socket.close();
        };
      }
    }
  };

  const reConnect = () => {
    if (socketDisconnected && !socketReady) {
      setSocketDisconnected(false);
      connect();
    }
  };

  const listen = () => {
    if (socketReady) {
      log("Listening for messages.");
      const onRecieve = (event: MessageEvent) => {
        log("Recieved message:", event.data);
        const incomingMessage: Message = JSON.parse(event.data);

        if (
          incomingMessage.name === "Server" &&
          incomingMessage._event === "ACCEPT_NAME" &&
          incomingMessage._meta === nameRef.current
        ) {
          setName(nameRef.current);
        }

        if (
          incomingMessage.name === "Server" &&
          incomingMessage._event === "REJECT_NAME" &&
          incomingMessage.text
        ) {
          setValidation(incomingMessage.text);
          // !TODO: Maybe clean this up. If name is rejected, we are just re-connecting...
          setSocketDisconnected(true);
          setSocketReady(false);
        }

        // Empty messages are pings from server to check open connections, do not add to feed
        if (
          incomingMessage.text &&
          ["BROADCAST", "ACCEPT_NAME"].includes(incomingMessage._event)
        ) {
          appendMessage(incomingMessage);
          setNameText("");
        }
      };

      // Listen for messages
      _socket.current?.addEventListener("message", onRecieve);

      return () => {
        _socket.current?.removeEventListener("message", onRecieve);
        setSocketReady(false);
      };
    }
  };

  // Establish initial connection
  useEffect(connect, []);

  // Re-connect if manually left
  useEffect(reConnect, [socketDisconnected]);

  // Listen for messages
  useEffect(listen, [socketReady]);

  // Clear input validation
  useEffect(() => {
    setValidation("");
  }, [nameText, name, chatText]);

  // Maintain name state in a ref for use in callbacks
  useEffect(() => {
    if (nameText) {
      nameRef.current = nameText;
    }
  }, [nameText]);

  const appendMessage = (message: Message) => {
    if (!message.text) {
      message.text = MESSAGES[message._event];
    }

    if (message._event.includes("CLIENT")) {
      message.private = true;
    }

    if (messageContainerTimer.current) {
      clearTimeout(messageContainerTimer.current);
    }

    setMessages((current) => [...current, message]);
    messageContainerTimer.current = setTimeout(() => {
      const listOfHeights = [
        ...(messageContainerRef?.current?.querySelectorAll?.("li") ?? []),
      ].reduce((acc, li: HTMLLIElement) => (acc += li.clientHeight + 10), 0);

      log("Message Height:", listOfHeights);
      messageContainerRef.current?.scroll(0, listOfHeights);
      // NOTE: Sync timing with animation var
    }, 100);
  };

  const onSend = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();

    if (name && chatText) {
      const message: Message = {
        name,
        text: chatText,
        _event: "BROADCAST",
      };
      _socket.current?.send(JSON.stringify(message));
      setChatText("");
    }
  };

  const onJoin = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const message: Message = {
      name: nameText,
      _event: "JOIN",
    };
    _socket.current?.send(JSON.stringify(message));
  };

  const onLeave = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (name) {
      const message: Message = {
        name,
        _event: "LEAVE",
      };
      _socket.current?.send(JSON.stringify(message));
      setSocketDisconnected(true);
      setSocketReady(false);
      setName(null);
      setPreviouslyLeft(true);
      appendMessage({
        name: "Server",
        _event: "LEFT_CLIENT",
      });
    } else {
      setValidation("You haven't even joined yet 😅");
    }
  };

  const onValidationError = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setValidation(`Enter a ${!nameText ? "name" : "message"}`);
  };

  const inputValue = !name ? nameText : chatText;
  const inputHandler = (event: React.ChangeEvent<HTMLInputElement>) =>
    !name ? setNameText(event.target.value) : setChatText(event.target.value);
  const actionText = !name ? "Join" : "Send";
  const actionHandler = !name ? onJoin : onSend;

  return (
    <div className={styles.root}>
      <header>
        <h1>Tiny Chat</h1>
      </header>
      <div className={styles.wrapper}>
        <div className={styles.container}>
          <div className={styles.chatContainer}>
            <ul className={styles.messageContainer} ref={messageContainerRef}>
              {messages.map((message, index) => (
                <li
                  key={`${message._id}-${index}`}
                  className={classnames(styles.message, {
                    [styles.messageServer]: message.name === "Server",
                    [styles.messageYou]: message.name === name,
                  })}
                >
                  <div className={styles.messageHeader}>
                    <span className={styles.name}>
                      {message.name === name ? "You" : message.name}{" "}
                    </span>
                    <span className={styles.time}>{message.time}</span>
                  </div>
                  <span className={styles.messageBody}>{message.text}</span>
                  <span className={styles.details}>
                    {message.private ? "Only you can see this" : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div className={styles.chatBar}>
        <div className={styles.container}>
          <form id="chatForm" className={styles.form} aria-describedby="error">
            <div className={styles.input}>
              {validation ? (
                <span id="error" className={styles.inputAlert}>
                  {validation}
                </span>
              ) : null}
              <input type="text" value={inputValue} onChange={inputHandler} />
            </div>
            <button
              className={classnames(styles.button, {
                [styles.buttonDisabled]: !inputValue.length,
                [styles.buttonEnabled]: inputValue.length,
              })}
              type="submit"
              onClick={!inputValue.length ? onValidationError : actionHandler}
            >
              {actionText}
            </button>
            <button
              className={classnames(styles.button, styles.buttonLeave, {
                [styles.buttonDisabled]: !name,
                [styles.buttonEnabled]: name,
              })}
              onClick={onLeave}
            >
              Leave
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;
