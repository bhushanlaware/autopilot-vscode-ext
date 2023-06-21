import * as vscode from "vscode";
import ChatHistoryManager, { ChatHistory } from "./ChatHistoryManager";
import { askQuestionWithPartialAnswers, cancelGPTRequest } from "./api";
import { Files } from "./types";
import { readFiles } from "./utils";

export class ChatGPTViewProvider implements vscode.WebviewViewProvider {
  private files: Files = {};
  private disposables: vscode.Disposable[] = [];
  private webviewView: vscode.WebviewView | undefined;
  private chatHistoryManager: ChatHistoryManager;

  constructor(private readonly _context: vscode.ExtensionContext) {
    this.chatHistoryManager = new ChatHistoryManager(_context);

    this.disposables.push(
      vscode.commands.registerCommand("autopilot.askQuestion", (q) => this.handleAskQuestion(q)),
      vscode.commands.registerCommand("autopilot.chatHistory", () =>
        this.chatHistoryManager.showAndChangeHistory(this.handleChatChange.bind(this))
      ),
      vscode.commands.registerCommand("autopilot.startNew", () => {
        this.chatHistoryManager.startNewChat();
        this.handleChatChange({ chatId: "", title: "", history: [] });
      }),
      vscode.commands.registerCommand("autopilot.clearHistory", () => {
        this.chatHistoryManager.clearHistory();
        this.handleChatChange({ chatId: "", title: "", history: [] });
      })
    );
  }

  private handleChatChange(chatHistory: ChatHistory) {
    if (this.webviewView) {
      this.webviewView.webview.postMessage({
        type: "set_history",
        history: chatHistory.history,
      });
    }
  }

  private readVscodeFiles() {
    readFiles(this._context.extensionUri.fsPath).then((files) => {
      this.files = files;
    });
  }

  public resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, token: vscode.CancellationToken) {
    let webViewLoadedResolve: () => void = () => {};
    const webviewLoadedThenable = new Promise<void>((resolve) => (webViewLoadedResolve = resolve));

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._context.extensionUri],
    };

    this.webviewView = webviewView;

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((data) => {
      switch (data.type) {
        case "onMountChat": {
          this.readVscodeFiles();

          this.chatHistoryManager.waitForInit().then(() => {
            const history = this.chatHistoryManager.currentChat;
            this.handleChatChange(history);
          });
          webViewLoadedResolve();
          break;
        }
        case "ask_question":
          this.handleAskQuestion(data.question);
          break;

        case "cancel_question":
          cancelGPTRequest();
          break;

        case "clear_chat":
          this.chatHistoryManager.startNewChat();
          break;
      }
    });

    const waitForHistoryMangerInit = this.chatHistoryManager.waitForInit();

    return new Promise<void>((resolve) => Promise.all([webviewLoadedThenable, waitForHistoryMangerInit]).then(() => resolve()));
  }

  private handleAskQuestion(question: string) {
    const webviewView = this.webviewView;
    if (!webviewView) {
      return;
    }

    this.chatHistoryManager.addQuestion(question);

    // Focus on webview if it is not focused
    this.webviewView?.show(false);

    const onPartialAnswer = (partialAnswer: string) => {
      webviewView.webview.postMessage({
        type: "partial_answer",
        partialAnswer,
      });
    };

    const { files, chatHistoryManager } = this;
    const history = chatHistoryManager.currentChat.history;

    askQuestionWithPartialAnswers(question, history, onPartialAnswer).then((ans) => {
      this.chatHistoryManager.addAnswer(ans);
      webviewView.webview.postMessage({
        type: "partial_answer_done",
      });
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, "media", "chat.js"));

    const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, "media", "chat.css"));

    // Use a nonce to only allow a specific script to be run.
    const nonce = getNonce();

    return `
		<!DOCTYPE html>
		<html lang='en'>
			<head>
				<meta charset='UTF-8'>

        <!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
				-->

				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; connect-src https: wss:">
				<meta name='viewport' content='width=device-width, initial-scale=1.0'>
				<link href='${styleMainUri}' rel='stylesheet'>

				<title>Chat</title>
			</head>
			<body>
				<div id='root'></div>
			</body>
			<script nonce='${nonce}' src='${scriptUri}'></script>
		</html>
	`;
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.webviewView = undefined;
  }
}

function getNonce() {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
