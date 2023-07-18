import * as React from "react";
import * as ReactDOM from "react-dom";
import MessageBody from "./MessageBody";

import "../common/App.css";
import "./index.css";
import { FaPaperPlane, FaStop, FaUser as UserIcon, FaRobot as BotIcon } from 'react-icons/fa';
import { FaPlusSquare as NewChatIcon } from 'react-icons/fa';

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
          setPrevPartialAnswer(prePartialAnswer => {
            setHistory(history => [...history, { role: "assistant", content: prePartialAnswer }]);
            return '';
          });
          break;

        case "partial_answer":
          setPrevPartialAnswer(prePartialAnswer => `${prePartialAnswer}${message.partialAnswer}`);
          break;

        case "set_history":
          setHistory(message.history);
          break;
        case 'update-theme':
          setTheme(message.theme);
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

  function startNewChat() {
    setHistory([]);
    vscode.postMessage({ type: "startNewChat" });
  }

  function handleCancel() {
    vscode.postMessage({ type: "cancelGPTRequest", answer: prePartialAnswer });
    setHistory([...history, { role: "assistant", content: prePartialAnswer }]);
    setPrevPartialAnswer("");
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      console.log('Hi')
      if (e.shiftKey) {
        return;
      } else {
        // Prevent default behavior of Enter key (new line)
        e.preventDefault();
        handleClick();
      }
    }
  };


  const renderStopButton = () => (
    <button className="danger" onClick={handleCancel}>
      Stop
    </button>
  );

  const renderSendButton = () => (
    <button className="primary" onClick={handleClick}>
      <FaPaperPlane />
    </button>
  );

  const renderNewChatButton = () => (
    history.length ? (
      <button className="primary mr-2" onClick={startNewChat} style={{ whiteSpace: 'nowrap' }}>
        New
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
          {prePartialAnswer ? renderStopButton() : (
            <>
              {/* {renderSendButton()} */}
              {renderNewChatButton()}
            </>
          )}
          <AutoResizeTextarea
            placeholder="Ask question.."
            value={input}
            onChange={setInput}
            onKeyDown={handleKeyPress}
          ></AutoResizeTextarea>


        </div>

      </div>
    </ThemeProvider>
  );
}

type ChatProps = {
  message: GPTMessage;
};

const Chat = React.memo(function ({ message }: ChatProps) {
  function handleCopy(code: string) {
    vscode.postMessage({ type: "handle_copy", code });
  }

  return (
    <div className="chat">
      <div className="message">
        <div className="message__author">
          {
            message.role === "assistant" ?
              <> <BotIcon /> Assistant </> :
              <><UserIcon /> You </>
          }
        </div>
        <div className="message__text">
          {
            message.role === "assistant" ?
              <MessageBody onCopy={handleCopy} content={message.content} /> :
              <p className="user-msg">{message.content}</p>
          }
        </div>
      </div>
    </div>
  );
});

ReactDOM.render(<ChatApp />, document.getElementById("root"));
