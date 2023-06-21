import * as vscode from "vscode";
import { ConfigProvider } from "./ConfigProvider";
import { AutoCompleteProvider } from "./AutoCompleteProvider";
import { ChatGPTViewProvider } from "./ChatGPTViewProvider";
import { IndexingProvider } from "./IndexingProvider";
import ChatsManager from "./ChatHistoryManager";
import { ChatHistoryTreeViewProvider } from "./ChatHistoryTreeViewProvider";

export async function activate(context: vscode.ExtensionContext) {
  const configProvider = new ConfigProvider();
  const chatHistoryManager = new ChatsManager(context);

  configProvider
    .getOpenApiKey()
    .then((key) => {
      console.log(key);
      const autoCompleteProvider = new AutoCompleteProvider(context);
      const chatGPTWebViewProvider = new ChatGPTViewProvider(context, chatHistoryManager);
      const chatHistoryTreeViewProvider = new ChatHistoryTreeViewProvider(context, chatHistoryManager);

      const indexingProvider = new IndexingProvider(context);

      const chatGPTWebViewPanel = vscode.window.registerWebviewViewProvider("autopilot.chat", chatGPTWebViewProvider, {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      });
      vscode.window.registerTreeDataProvider("autopilot.chatList", chatHistoryTreeViewProvider);

      context.subscriptions.push(chatGPTWebViewPanel);
      context.subscriptions.push(autoCompleteProvider);
      context.subscriptions.push(indexingProvider);
    })
    .catch((error) => {
      console.error(error);
      vscode.window.showErrorMessage("Error getting Open API Key. Please check the extension settings.");
    });

  vscode.commands.registerCommand("autopilot.reset", async () => {
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    statusBarItem.text = "$(zap) Resetting Autopilot";
    const globalKeys = await context.globalState.keys();
    for (const key of globalKeys) {
      await context.globalState.update(key, undefined);
    }
    const workSpaceKeys = await context.workspaceState.keys();
    for (const key of workSpaceKeys) {
      await context.workspaceState.update(key, undefined);
    }
    statusBarItem.text = "$(zap) Autopilot Reset";
    statusBarItem.dispose();
  });
}

// This method is called when your extension is deactivated
export function deactivate() {}
