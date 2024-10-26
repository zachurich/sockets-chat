import { _Event } from "./App";

export const MESSAGES: Partial<Record<_Event, string>> = {
  CONNECTED_CLIENT:
    "Welcome 👋! Enter a name and hit 'Join' to start chatting.",
  RECONNECTED_CLIENT: "Connected! 🎉",
  ERROR_CLIENT: "Cannot connect to server. Attempting to re-connect...",
  LEFT_CLIENT: "Thanks for chatting 👋",
};
