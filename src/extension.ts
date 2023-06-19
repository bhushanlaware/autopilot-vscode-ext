import * as vscode from "vscode";
import { ConfigProvider } from "./ConfigProvider";
import { AutoCompleteProvider } from "./AutoCompleteProvider";
import { ChatGPTViewProvider } from "./ChatGPTViewProvider";
import { sudoVscode } from "./api";
// import { SearchViewProvider } from "./GoogleViewProvider";

export async function activate(context: vscode.ExtensionContext) {
  // const searchViewProvider = new SearchViewProvider(context);
  // const searchViewPanel = vscode.window.registerWebviewViewProvider(
  //   "autopilot.search",
  //   searchViewProvider,
  //   {
  //     webviewOptions: {
  //       retainContextWhenHidden: true,
  //     },
  //   }
  // );
  // context.subscriptions.push(searchViewPanel);
  // setTimeout(() => {
  //   sudoVscode("Create new file user.txt and write 10 users names in it", []);
  // }, 1000);
  async function getBuiltInCommands() {
    const allCommands = await vscode.commands.getCommands();
    const builtInCommands = allCommands.filter((command) => command.startsWith("workbench.") || command.startsWith("editor."));
    console.log(builtInCommands);
  }

  getBuiltInCommands();

  const configProvider = new ConfigProvider();
  configProvider
    .getOpenApiKey()
    .then((key) => {
      console.log(key);
      const autoCompleteProvider = new AutoCompleteProvider(context);
      const chatGPTWebViewProvider = new ChatGPTViewProvider(context);

      const chatGPTWebViewPanel = vscode.window.registerWebviewViewProvider("autopilot.chat", chatGPTWebViewProvider, {
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
