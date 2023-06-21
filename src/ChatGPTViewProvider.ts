import * as vscode from "vscode";
import ChatsManager, { Chat } from "./ChatHistoryManager";
import { askQuestionWithPartialAnswers, cancelGPTRequest } from "./api";

export class ChatGPTViewProvider implements vscode.WebviewViewProvider {
  private disposables: vscode.Disposable[] = [];
  private webviewView: vscode.WebviewView | undefined;

  constructor(private readonly _context: vscode.ExtensionContext, private readonly chatHistoryManager: ChatsManager) {
    this.disposables.push(
      vscode.commands.registerCommand("autopilot.askQuestion", this.handleAskQuestion.bind(this)),
      vscode.commands.registerCommand("autopilot.chatHistory", this.chatHistoryManager.quickPickChats.bind(this.chatHistoryManager)),
      vscode.commands.registerCommand("autopilot.startNew", this.chatHistoryManager.startNewChat.bind(this.chatHistoryManager)),
      vscode.commands.registerCommand("autopilot.clearHistory", this.chatHistoryManager.removeAllChats.bind(this.chatHistoryManager)),
      vscode.commands.registerCommand("autopilot.openChat", this.chatHistoryManager.openChat.bind(this.chatHistoryManager)),
      vscode.window.onDidChangeActiveColorTheme(this.updateUITheme.bind(this))
    );
    this.chatHistoryManager.onChatChange(this.handleChatChange.bind(this));
  }

  private handleChatChange(chatHistory: Chat) {
    if (this.webviewView) {
      this.webviewView.webview.postMessage({
        type: "set_history",
        history: chatHistory.history,
      });
    }
  }

  public resolveWebviewView(webviewView: vscode.WebviewView) {
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
          this.handleChatChange(this.chatHistoryManager.currentChat);
          this.updateUITheme();
          webViewLoadedResolve();
          break;
        }
        case "ask_question":
          this.handleAskQuestion(data.question);
          break;

        case "cancelGPTRequest":
          cancelGPTRequest();
          break;

        case "startNewChat":
          this.chatHistoryManager.startNewChat();
          break;
      }
    });

    return webviewLoadedThenable;
  }

  private updateUITheme() {
    const activeColorTheme = vscode.window.activeColorTheme;
    console.log(activeColorTheme);
    if (activeColorTheme.kind === vscode.ColorThemeKind.Dark) {
      this.webviewView?.webview.postMessage({
        type: "update-theme",
        theme: "dark",
      });
    } else {
      this.webviewView?.webview.postMessage({
        type: "update-theme",
        theme: "light",
      });
    }
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

    const history = this.chatHistoryManager.currentChat?.history || [];

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
