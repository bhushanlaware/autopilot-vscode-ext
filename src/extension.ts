import * as vscode from 'vscode';
import { AutoCompleteProvider } from './AutoCompleteProvider';
import { ChatGPTViewProvider } from './ChatGPTViewProvider';
import { SearchViewProvider } from './GoogleViewProvider';

export async function activate(context: vscode.ExtensionContext) {
	//1. Autocomplete Feature
	const autoCompleteProvider = new AutoCompleteProvider(context);
	context.subscriptions.push(autoCompleteProvider);
	const searchViewProvider = new SearchViewProvider(context);


	//  2. Chat Feature enable only when product send sessionId and controlId
	const chatGPTWebViewProvider = new ChatGPTViewProvider(context);

	vscode.commands.executeCommand('hackerrank.handleHackerGPTReady');
	vscode.commands.registerCommand('vscode.initHackergpt', ({ sessionId, controlId }) => {
		context.globalState.update('hackergpt.sessionId', sessionId);
		context.globalState.update('hackergpt.controlId', controlId);

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
	});

	//3. Google Search Feature. (Currently disabled.)
	// const searchViewPanel =
	// 	vscode.window.registerWebviewViewProvider(
	// 		'hackergpt.search',
	// 		searchViewProvider,
	// 		{
	// 			webviewOptions: {
	// 				retainContextWhenHidden: true,
	// 			},
	// 		}
	// 	);

	// context.subscriptions.push(searchViewPanel);
}

// This method is called when your extension is deactivated
export function deactivate() {
}


