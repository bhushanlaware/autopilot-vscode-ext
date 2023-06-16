import * as vscode from 'vscode';

export class SearchViewProvider implements vscode.WebviewViewProvider {
	webviewView: vscode.WebviewView | undefined;
	constructor(private readonly _context: vscode.ExtensionContext) {
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
	) {
		this.webviewView = webviewView;
		let webViewLoadedResolve: () => void = () => { };
		const webviewLoadedThenable = new Promise<void>(resolve => webViewLoadedResolve = resolve);
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._context.extensionUri],
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage((data) => {
			console.log('search', data);
			switch (data.type) {
				case 'searchReady': {
					webViewLoadedResolve();
					break;
				}
				case 'search':
					vscode.window.showInformationMessage(`Searching for ${data.query}`);
					break;
			}
		});

		return webviewLoadedThenable;
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		return `
		<!DOCTYPE html>
		<html lang='en'>
			<head>
				<meta charset='UTF-8'>

        <!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
				-->
				<script async src="https://cse.google.com/cse.js?cx=b292e2c27adc04190">
				</script>
			</head>
			<body>
			<div class="gcse-search"></div>
			<script>
				const vscode = acquireVsCodeApi();

				const waitForEl = (selector, callback) => {
					if (document.querySelector(selector)) {
						callback();
					} else {
						setTimeout(() => {
							waitForEl(selector, callback);
						}, 500);
					}
				};

				function searchHandler() {
					const input = document.querySelector('.gsc-input input');
					const query = input.value;
					vscode.postMessage({
						type: 'search',
						query,
					});
				}

				waitForEl('.gsc-search-button button', () => {
					console.log('search ready');
					const button = document.querySelector('.gsc-search-button button');
					const input = document.querySelector('.gsc-input input');

					button.addEventListener('click',searchHandler);
					input.addEventListener('keyup', (e) => {
						if (e.key === 'Enter') {
							searchHandler();
						}
					});

					vscode.postMessage({
						type: 'searchReady'
					});
				});
			 </script>
			</body>
		</html>
	`;
	}

	public dispose() {
		this.webviewView = undefined;
	}
}
