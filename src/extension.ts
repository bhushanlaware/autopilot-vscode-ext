import * as vscode from "vscode";
import { ConfigProvider } from "./ConfigProvider";
import { AutoCompleteProvider } from "./AutoCompleteProvider";
import { ChatGPTViewProvider } from "./ChatGPTViewProvider";
// import { SearchViewProvider } from "./GoogleViewProvider";

export async function activate(context: vscode.ExtensionContext) {
  // const searchViewProvider = new SearchViewProvider(context);
  // const searchViewPanel = vscode.window.registerWebviewViewProvider(
  //   "hackergpt.search",
  //   searchViewProvider,
  //   {
  //     webviewOptions: {
  //       retainContextWhenHidden: true,
  //     },
  //   }
  // );
  // context.subscriptions.push(searchViewPanel);

  const configProvider = new ConfigProvider();
  configProvider
    .getOpenApiKey()
    .then((key) => {
      console.log(key);
      const autoCompleteProvider = new AutoCompleteProvider(context);
      const chatGPTWebViewProvider = new ChatGPTViewProvider(context);

      const chatGPTWebViewPanel = vscode.window.registerWebviewViewProvider("hackergpt.chat", chatGPTWebViewProvider, {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      });

      context.subscriptions.push(chatGPTWebViewPanel);
      context.subscriptions.push(autoCompleteProvider);
    })
    .catch((error) => {
      console.error(error);
      vscode.window.showErrorMessage("Error getting Open API Key. Please check the extension settings.");
    });
}

// This method is called when your extension is deactivated
export function deactivate() {}
