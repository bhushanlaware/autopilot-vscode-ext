import * as vscode from 'vscode';
import { AutoCompleteProvider } from './AutoCompleteProvider';
import { ChatGPTViewProvider } from './ChatGPTViewProvider';
import { SearchViewProvider } from './GoogleViewProvider';

export async function activate(context: vscode.ExtensionContext) {
	const searchViewProvider = new SearchViewProvider(context);
	const autoCompleteProvider = new AutoCompleteProvider(context);
	const chatGPTWebViewProvider = new ChatGPTViewProvider(context);

	vscode.commands.executeCommand('hackerrank.handleHackerGPTReady');
	vscode.commands.registerCommand('vscode.hackergptInit', ({ sessionId, controlId }) => {
		console.log("bhula ext Got the session and control id", { sessionId, controlId });
		context.globalState.update('hackergpt.sessionId', sessionId);
		context.globalState.update('hackergpt.controlId', controlId);
	});

	const searchViewPanel =
		vscode.window.registerWebviewViewProvider(
			'hackergpt.search',
			searchViewProvider,
			{
				webviewOptions: {
					retainContextWhenHidden: true,
				},
			}
		);

	const chatGPTWebViewPanel =
		vscode.window.registerWebviewViewProvider(
			'hackergpt.chat',
			chatGPTWebViewProvider,
			{
				webviewOptions: {
					retainContextWhenHidden: true,
				},
			}
		);

	context.subscriptions.push(chatGPTWebViewPanel);
	context.subscriptions.push(autoCompleteProvider);
	context.subscriptions.push(searchViewPanel);

}

// This method is called when your extension is deactivated
export function deactivate() {
}


