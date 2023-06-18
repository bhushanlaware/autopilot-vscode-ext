import * as vscode from "vscode";
import ChatHistoryManager, { ChatHistory } from "./ChatHistoryManager";
import { askQuestionWithPartialAnswers, cancelGPTRequest } from "./api";
import { Files } from "./types";
import { createFileIfNotExists, readFiles } from "./utils";

export class ChatGPTViewProvider implements vscode.WebviewViewProvider {
  private files: Files = {};
  private disposables: vscode.Disposable[] = [];
  private webviewView: vscode.WebviewView | undefined;
  private chatHistoryManager: ChatHistoryManager;

  constructor(private readonly _context: vscode.ExtensionContext) {
    this.chatHistoryManager = new ChatHistoryManager();
    this.chatHistoryManager.waitForInit().then(() => {
      const history = this.chatHistoryManager.currentChat;
      this.handleChatChange(history);
    });

    const fileChangeListener = vscode.workspace.onDidChangeTextDocument(async (changes) => {
      for (const change of changes.contentChanges) {
        const fileName = changes.document.fileName;
        const fileContent = changes.document.getText();
        this.files[fileName] = fileContent;
      }
    });

    this.disposables.push(
      fileChangeListener,
      vscode.commands.registerCommand("autopilot.askQuestion", (q) => this.handleAskQuestion(q)),
      vscode.commands.registerCommand("autopilot.chatHistory", () =>
        this.chatHistoryManager.showAndChangeHistory(this.handleChatChange.bind(this))
      ),
      vscode.commands.registerCommand("autopilot.clearAll", () => this.chatHistoryManager.clearHistory())
    );
  }

  private handleChatChange(chatHistory: ChatHistory) {
    if (this.webviewView) {
      this.webviewView.webview.postMessage({
        type: "chatHistory",
        data: chatHistory,
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
          webViewLoadedResolve();
          this.readVscodeFiles();
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
        case "insert_code":
          this.insertText("/src/App.js", 10, 1, data.code);
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

    askQuestionWithPartialAnswers(question, history, files, onPartialAnswer).then((ans) => {
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

  private createFile(fileName: string, fileContent: string) {
    const fileUri = vscode.Uri.parse(fileName);
    createFileIfNotExists(fileUri, fileContent);
  }

  insertTextHelper(code: string) {
    const chat = this.chatHistoryManager.getMessages().find((chat) => chat.content.includes(code));
    if (!chat) {
      return;
    }
  }
  private insertText(filepath: string, line: number, col: number, text: string) {
    const document = vscode.workspace.textDocuments.find((doc) => doc.uri.fsPath.endsWith(filepath));

    const fileUri = document?.uri;
    if (fileUri) {
      vscode.workspace.openTextDocument(fileUri).then((document) => {
        const edit = new vscode.WorkspaceEdit();
        edit.insert(fileUri, new vscode.Position(line, col), text);
        return vscode.workspace.applyEdit(edit);
      });
    }
  }

  private openFile(filepath: string) {
    const fileUri = vscode.Uri.parse(filepath);
    vscode.workspace.openTextDocument(fileUri).then((document) => {
      vscode.window.showTextDocument(document);
    });
  }

  private deleteFile(filepath: string) {
    const fileUri = vscode.Uri.parse(filepath);
    vscode.workspace.openTextDocument(fileUri).then((document) => {
      vscode.workspace.fs.delete(fileUri);
    });
  }

  private replaceText(filepath: string, line: number, col: number, text: string) {
    const fileUri = vscode.Uri.parse(filepath);
    vscode.workspace.openTextDocument(fileUri).then((document) => {
      const edit = new vscode.WorkspaceEdit();
      edit.replace(fileUri, new vscode.Range(line, col, line, col + text.length), text);
      return vscode.workspace.applyEdit(edit);
    });
  }

  private deleteText(filepath: string, line: number, col: number, text: string) {
    const fileUri = vscode.Uri.parse(filepath);
    vscode.workspace.openTextDocument(fileUri).then((document) => {
      const edit = new vscode.WorkspaceEdit();
      edit.delete(fileUri, new vscode.Range(line, col, line, col + text.length));
      return vscode.workspace.applyEdit(edit);
    });
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
