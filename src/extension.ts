import * as vscode from "vscode";
import { ConfigProvider } from "./ConfigProvider";
import { AutoCompleteProvider } from "./AutoCompleteProvider";
import { ChatGPTViewProvider } from "./ChatGPTViewProvider";
import { IndexingProvider } from "./IndexingProvider";

export async function activate(context: vscode.ExtensionContext) {
  const configProvider = new ConfigProvider();
  configProvider
    .getOpenApiKey()
    .then((key) => {
      console.log(key);
      const autoCompleteProvider = new AutoCompleteProvider(context);
      const chatGPTWebViewProvider = new ChatGPTViewProvider(context);
      const indexingProvider = new IndexingProvider(context);

      const chatGPTWebViewPanel = vscode.window.registerWebviewViewProvider("autopilot.chat", chatGPTWebViewProvider, {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      });

      context.subscriptions.push(chatGPTWebViewPanel);
      context.subscriptions.push(autoCompleteProvider);
      context.subscriptions.push(indexingProvider);
    })
    .catch((error) => {
      console.error(error);
      vscode.window.showErrorMessage("Error getting Open API Key. Please check the extension settings.");
    });
}

// This method is called when your extension is deactivated
export function deactivate() {}
