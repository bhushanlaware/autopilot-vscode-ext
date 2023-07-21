import * as vscode from "vscode";
import { ConfigProvider } from "./ConfigProvider";
import { AutoCompleteProvider } from "./AutoCompleteProvider";
import { ChatGPTViewProvider } from "./ChatGPTViewProvider";
import { IndexingProvider } from "./IndexingProvider";
import ChatsManager from "./ChatHistoryManager";
import { ChatHistoryTreeViewProvider } from "./ChatHistoryTreeViewProvider";
import { UsageProvider } from "./UsageViewProvider";
import { AutoCodeProvider } from "./AutoCodeProvider";

export async function activate(context: vscode.ExtensionContext) {
  const configProvider = new ConfigProvider();
  const chatHistoryManager = new ChatsManager(context);

  configProvider
    .getOpenApiKey()
    .then((key) => {
      // Autocomplete Provider
      const autoCompleteProvider = new AutoCompleteProvider(context);
      context.subscriptions.push(autoCompleteProvider);

      //Chat WebView Provider
      const chatGPTWebViewProvider = new ChatGPTViewProvider(context, chatHistoryManager);
      const chatGPTWebViewPanel = vscode.window.registerWebviewViewProvider("autopilot.chat", chatGPTWebViewProvider, {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      });
      context.subscriptions.push(chatGPTWebViewPanel);

      // Indexing provider
      const indexingProvider = new IndexingProvider(context);
      context.subscriptions.push(indexingProvider);

      // Usage view provider
      const usageProvider = new UsageProvider(context);
      const usageViewPanel = vscode.window.registerWebviewViewProvider("autopilot.usage", usageProvider, {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      });
      context.subscriptions.push(usageViewPanel);

      // Chat history tree view provider
      const chatHistoryTreeViewProvider = new ChatHistoryTreeViewProvider(context, chatHistoryManager);
      vscode.window.registerTreeDataProvider("autopilot.chatList", chatHistoryTreeViewProvider);

      // Auto code writer
      const autoCodeProvider = new AutoCodeProvider(context);
      context.subscriptions.push(autoCodeProvider);
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
    const msg = "Autopilot has been reset. Please reload the window to start using it.";
    const interactions = ["Reload Now"];

    vscode.window.showInformationMessage(msg, ...interactions).then((userSelection) => {
      if (userSelection === "Reload Now") {
        vscode.commands.executeCommand("workbench.action.reloadWindow");
      }
    });
  });
}

// This method is called when your extension is deactivated
export function deactivate() {}
