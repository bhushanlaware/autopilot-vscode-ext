import * as vscode from "vscode";
import { Disposable, ExtensionContext } from "vscode";
import { openaiModel } from "./constant";
import { getNonce } from "./utils";
import { IUsage } from "./types";

export class UsageProvider implements vscode.WebviewViewProvider {
  disposable: Disposable[] = [];
  webviewView: vscode.WebviewView | undefined;

  constructor(private readonly context: ExtensionContext) {
    this.disposable.push(
      vscode.commands.registerCommand("autopilot.addChatCost", this.addChatCost.bind(this)),
      vscode.commands.registerCommand("autopilot.addCompletionCost", this.addCompletionCost.bind(this)),
      vscode.commands.registerCommand("autopilot.addEmbeddingCost", this.addEmbeddingCost.bind(this))
    );
  }

  private getCost(tokensUsed: number, model: keyof typeof openaiModel) {
    console.log(tokensUsed, model);
    const pricingPer1kToken = openaiModel[model].pricingPer1kToken;
    return (tokensUsed * pricingPer1kToken) / 1000;
  }

  private get usage(): IUsage {
    const usage = this.context.globalState.get<IUsage>("autopilot.usage");
    if (!usage) {
      return {
        chat: {
          totalTokenUsed: 0,
          totalCost: 0,
        },
        completion: {
          totalTokenUsed: 0,
          totalCost: 0,
        },
        embedding: {
          totalTokenUsed: 0,
          totalCost: 0,
        },
      };
    }
    return usage;
  }

  private updateUi(usage: IUsage) {
    this.webviewView?.webview.postMessage({
      type: "updateUsage",
      usage,
    });
  }
  private async addUsage(type: keyof IUsage, token: number, cost: number) {
    const usage = this.usage;
    usage[type].totalTokenUsed += token;
    usage[type].totalCost += cost;
    this.updateUi(usage);
    await this.context.globalState.update("autopilot.usage", usage);
  }

  private async addChatCost(model: keyof typeof openaiModel, tokenUsed: number) {
    console.log(model, tokenUsed);
    const cost = this.getCost(tokenUsed, model);
    await this.addUsage("chat", tokenUsed, cost);
  }

  private async addCompletionCost(model: keyof typeof openaiModel, tokenUsed: number) {
    const cost = this.getCost(tokenUsed, model);
    await this.addUsage("completion", tokenUsed, cost);
  }

  private async addEmbeddingCost(model: keyof typeof openaiModel, tokenUsed: number) {
    const cost = this.getCost(tokenUsed, model);
    await this.addUsage("embedding", tokenUsed, cost);
  }

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    let webViewLoadedResolve: () => void = () => {};
    const webviewLoadedThenable = new Promise<void>((resolve) => (webViewLoadedResolve = resolve));

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };

    this.webviewView = webviewView;

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((data) => {
      switch (data.type) {
        case "onMountUsage": {
          this.updateUi(this.usage);
          webViewLoadedResolve();
          break;
        }
      }
    });

    return webviewLoadedThenable;
  }
  private _getHtmlForWebview(webview: vscode.Webview) {
    // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "media", "usage.js"));

    const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "media", "usage.css"));

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
    this.disposable.forEach((d) => d.dispose());
  }
}
