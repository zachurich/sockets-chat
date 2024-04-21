import { useEffect, useRef, useState } from "react";
import "./App.css";

function App() {
  const [text, setText] = useState("");
  const socket = useRef<WebSocket>();

  useEffect(() => {
    socket.current = new WebSocket("ws://localhost:4000");
  }, []);

  const onType = (_text: string) => {
    setText(_text);
  };

  const onSend = () => {
    socket.current?.send(text);
  };

  return (
    <>
      <input type="text" onChange={(e) => onType(e.target.value)} />
      <button onClick={onSend}>SEND</button>
    </>
  );
}

export default App;
