import * as React from "react";
import * as ReactDOM from "react-dom";
import MessageBody from "./MessageBody";

import "../common/App.css";
import "./index.css";
// import { ClearIcon } from "./icons";
import { FaPlus as NewChatIcon, FaPaperPlane, FaStop } from 'react-icons/fa';

import AutoResizeTextarea from "./AutoResizeTextarea";
import { ThemeProvider, ThemeType } from "./hook/useTheme";

type GPTMessage = {
  role: "user" | "assistant";
  content: string;
};

//@ts-ignore
const vscode = acquireVsCodeApi();

function ChatApp() {
  const [input, setInput] = React.useState<string>("");
  const [history, setHistory] = React.useState<Array<GPTMessage>>([]);
  const [prePartialAnswer, setPrevPartialAnswer] = React.useState<string>("");
  const [theme, setTheme] = React.useState<ThemeType>("dark");

  React.useEffect(() => {
    vscode.postMessage({ type: "onMountChat" });
  }, []);

  React.useEffect(() => {
    const chatList = document.querySelector(".chat_list");
    if (chatList) {
      chatList.scrollTop = chatList.scrollHeight;
    }
  }, [history, prePartialAnswer]);

  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case "partial_answer_done":
          setHistory([...history, { role: "assistant", content: prePartialAnswer }]);
          setPrevPartialAnswer("");
          break;

        case "partial_answer":
          setPrevPartialAnswer(`${prePartialAnswer}${message.partialAnswer}`);
          break;

        case "set_history":
          setHistory(message.history);
          break;
        default:
          break;
      }
    };
    window.addEventListener("message", handler);

    return () => window.removeEventListener("message", handler);
  }, [prePartialAnswer]);

  function handleClick() {
    if (!input.length) {
      return;
    }
    console.log("sending message", input);
    vscode.postMessage({ type: "ask_question", question: input });

    setHistory([...history, { role: "user", content: input }]);
    setInput("");
  }

  function clearChat() {
    setHistory([]);
    vscode.postMessage({ type: "clear_chat" });
  }

  function handleCancel() {
    vscode.postMessage({ type: "cancel_question", ans: prePartialAnswer });
    setHistory([...history, { role: "assistant", content: prePartialAnswer }]);
    setPrevPartialAnswer("");
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      handleClick();
    }
  };
  const renderStopButton = () => (
    <button className="danger mr-2" onClick={handleCancel}>
      <FaStop />
    </button>
  );

  const renderSendButton = () => (
    <button className="primary mr-2" onClick={handleClick}>
      <FaPaperPlane />
    </button>
  );

  const renderNewChatButton = () => (
    history.length ? (
      <button className="warning" onClick={clearChat}>
        <NewChatIcon />
      </button>
    ) : null
  );

  return (
    <ThemeProvider value={theme}>
      <div className="chat_body">
        <div className="chat_list">
          {history.map((message, index) => (
            <Chat key={index} message={message} />
          ))}
          {prePartialAnswer && <Chat message={{ role: "assistant", content: prePartialAnswer }} />}
        </div>
        <div className="chat-controller">
          <AutoResizeTextarea
            placeholder="Ask question.."
            value={input}
            onChange={setInput}
            onKeyDown={handleKeyPress}
          ></AutoResizeTextarea>

          {prePartialAnswer ? renderStopButton() : (
            <>
              {renderSendButton()}
              {/* {renderNewChatButton()} */}
            </>
          )}
        </div>

      </div>
    </ThemeProvider>
  );
}

type ChatProps = {
  message: GPTMessage;
};

function Chat({ message }: ChatProps) {
  function handleCopy(code: string) {
    vscode.postMessage({ type: "handle_copy", code });
  }

  return (
    <div className="chat">
      <div className="message">
        <div className="message__author">{message.role}</div>
        <div className="message__text">
          <MessageBody onCopy={handleCopy} content={message.content} />
        </div>
      </div>
    </div>
  );
}

ReactDOM.render(<ChatApp />, document.getElementById("root"));
