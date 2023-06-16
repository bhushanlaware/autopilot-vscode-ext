import { debounce } from 'lodash';
import * as vscode from 'vscode';
import { askQuestionWithPartialAnswers, cancelGPTRequest, createIndex, getChatHistory, updateIndex } from './api';
import { Chat, ChatConfig, Files } from './types';
import { readFiles } from './utils';
export class ChatGPTViewProvider implements vscode.WebviewViewProvider {
	private disposables: vscode.Disposable[] = [];
	private webviewView: vscode.WebviewView | undefined;
	private history: Chat[] = [];
	private pendingFileChangesToBeIndexed: Files = {};

	constructor(private readonly _context: vscode.ExtensionContext) {

		const debouncedUpdateIndex = debounce(this.updateIndexing.bind(this), 3000);
		const fileChangeListener = vscode.workspace.onDidChangeTextDocument(async (changes) => {
			for (const change of changes.contentChanges) {
				const fileName = changes.document.fileName;
				const fileContent = changes.document.getText();
				this.pendingFileChangesToBeIndexed[fileName] = fileContent;
			}
			debouncedUpdateIndex();
		});

		this.disposables.push(
			fileChangeListener,
			vscode.commands.registerCommand('hackergpt.askQuestion', this.handleAskQuestion.bind(this)),
			vscode.commands.registerCommand('vscode.onCollabCustomEvent', this.handleVscodeCollabEvent.bind(this))
		);

		const { sessionId, controlId } = this.config;

		if (sessionId && controlId) {
			getChatHistory(sessionId, controlId).then((history) => {
				this.history = history;
				this.updateWebview();
			});
		}
	}

	private updateWebview() {
		if (this.webviewView) {
			this.webviewView.webview.postMessage({
				type: 'set_history',
				history: this.history,
			});
		}
	}


	get config(): ChatConfig {
		const config = vscode.workspace.getConfiguration('hackergpt');

		return {
			chatModel: (config.get('chatModel')) || 'gpt-3.5-turbo',
			chatTemperature: (config.get('chatTemperature')) || 0.5,
			chatRestriction: (config.get('chatRestriction')) || 'None',
			sessionId: this._context.globalState.get('hackergpt.sessionId') || '',
			controlId: this._context.globalState.get('hackergpt.controlId') || '',
		};
	}

	async updateConfig(key: keyof ChatConfig, value: any) {
		const config = vscode.workspace.getConfiguration('hackergpt');
		await config.update(key, value, true);
	};

	private createIndexing() {
		const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
		statusBar.text = '$(search) indexing';
		statusBar.tooltip = 'HackerGPT Indexing files';
		statusBar.show();
		this.disposables.push(statusBar);

		readFiles(this._context.extensionUri.fsPath).then((files) => {

			createIndex(this.config.sessionId, this.config.controlId, files).then((index) => {
				statusBar.hide();
			}).catch((err) => {
				console.error(err);
				statusBar.hide();
			});
		});
	}

	private updateIndexing() {
		const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
		statusBar.text = '$(search) indexing';
		statusBar.tooltip = 'HackerGPT updating indexing';
		statusBar.show();
		this.disposables.push(statusBar);
		const files = this.pendingFileChangesToBeIndexed;
		updateIndex(this.config.sessionId, this.config.controlId, files).then((index) => {
			statusBar.hide();
			this.pendingFileChangesToBeIndexed = {};
		});
	}


	private handleVscodeCollabEvent(event: { type: string, payload: any }) {
		const { type, payload } = event;
		if (type === 'hackerGPTAddChat') {
			const { role, content } = payload;
			this.history.push({
				role,
				content,
			});
			this.updateWebview();
		}
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		token: vscode.CancellationToken
	) {
		let webViewLoadedResolve: () => void = () => { };
		const webviewLoadedThenable = new Promise<void>(resolve => webViewLoadedResolve = resolve);

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._context.extensionUri],
		};

		this.webviewView = webviewView;

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage((data) => {
			switch (data.type) {
				case 'onMountChat': {
					webViewLoadedResolve();
					this.createIndexing();
					this.updateWebview();
					break;
				}
				case 'ask_question':
					this.handleAskQuestion(data.question);
					break;

				case 'cancel_question':
					this.addChat({
						role: 'assistant',
						content: data.ans,
					});
					cancelGPTRequest();
					break;

				case 'handle_copy':
					this.handleCopyCode(data.code);
					break;
				default:
					break;
			}
		});


		return webviewLoadedThenable;
	}

	private handleCopyCode(code: string) {
		vscode.commands.executeCommand('hackerrank.handleCopyToClipboard', { text: code });
	}

	private handleAskQuestion(question: string) {
		const webviewView = this.webviewView;
		if (!webviewView) {
			return;
		}

		this.webviewView?.show(false);

		this.addChat({
			role: 'user',
			content: question,
		});

		const onPartialAnswer = ((partialAnswer: string) => {
			webviewView.webview.postMessage({
				type: 'partial_answer',
				partialAnswer
			});
		});

		askQuestionWithPartialAnswers(question, onPartialAnswer, this.config).then((ans) => {
			webviewView.webview.postMessage({
				type: 'partial_answer_done',
			});
			this.addChat({
				role: 'assistant',
				content: ans,
			});
		});
	}

	private addChat(chat: Chat) {
		this.history.push(chat);
		this.sendCollabCustomEvent(chat);
	}

	private sendCollabCustomEvent(chat: Chat) {
		vscode.commands.executeCommand('vscode.sendCollabCustomEvent', {
			type: 'hackerGPTAddChat',
			payload: chat
		});
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		// Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this._context.extensionUri, 'media', 'chat.js')
		);

		const styleMainUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this._context.extensionUri, 'media', 'chat.css')
		);

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
	let text = '';
	const possible =
		'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
