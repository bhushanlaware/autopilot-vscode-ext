import * as vscode from 'vscode';
import { ChatContext, ChatRestriction, Files } from './types';
import { createParser } from "eventsource-parser";
import { MAX_ALLOWED_LINE, SELECTED_CODE_MAX_LENGTH, VIEW_RANGE_MAX_LINES } from './constant';

export async function readFiles(filePath: any) {
	const files: Files = {};
	const fs = vscode.workspace.fs;
	// if the provider does not support readFile then we cannot do anything
	if (!fs.readFile) {
		return files;
	}

	const fileUrls = await vscode.workspace.findFiles(
		'**/*.{js,jsx,ts,tsx,py,rb,java,cpp,c,h,html,css,scss}',
		'**/node_modules/**'
	);

	for (const fileUrl of fileUrls) {
		const fileContent = await fs.readFile(fileUrl);
		files[fileUrl.path] = new TextDecoder().decode(fileContent);
	}
	return files;
}

export const modelMaxTokens = {
	//GPT 4
	'gpt-4': 8000,
	// GPT 3.5
	'gpt-3.5-turbo': 4000,
	'text-davinci-003': 4000,
	'text-davinci-002': 4000,
	//GPT 3
	'davinci': 2000,
	'curie': 2000,
	'babbage': 2000,
	'ada': 2000,
};

export const openaiBaseURL = 'https://api.openai.com';

// export function getChatSystemMessageFromFiles(files: Files) {
// 	const instructionMessage = "INSTRUCTION:You are a helpful assistant, who understand user code and help them to write code, explain code, and debug code. Try to give concise and helpful instructions. Use minimal explanation and give actual code which can help. Don't do any syntax error while giving the code";

// 	const codeMessage = "CODE:\n" + Object.keys(files).reduce((acc, path) => {
// 		return acc + [path, '```', files[path].split('\n').slice(0, 56).join('\n'), '```'].join('\n');
// 	}, '');
// 	return [instructionMessage, codeMessage].join('\n\n');
// }

// export function getCodexSystemMessage() {
// 	return `You are the Codex Open AI model, which returns block of code as per user-provided code in chat. Obey indentations and don't provide text instructions as your chat output will be used directly in the code file without any cleaning or refactoring. Note: If completion is done on the same line don't repeat earlier code.`
// }

export function getWorkspaceBasePath() {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (workspaceFolders) {
		return workspaceFolders[0].uri.fsPath;
	}
	return '';
}

export function getFilesPromptMessage(files: Files) {
	const codeMessage = "CODE:\n" + Object.keys(files).reduce((acc, path) => {
		return acc + [path, '```', files[path].split('\n').slice(0, MAX_ALLOWED_LINE).join('\n'), '```'].join('\n');
	}, '');
	return codeMessage;
}

export function getSelectedCode() {
	const editor = vscode.window.activeTextEditor;
	if (editor) {
		const selection = editor.selection;
		const text = editor.document.getText(selection);
		return text;
	}
	return '';
}

export function getOpenedFiles() {
	const openedFiles: Files = {};
	vscode.workspace.textDocuments.forEach(doc => {
		const path = doc.uri.path;
		const content = doc.getText();
		openedFiles[path] = content;
	});
	return openedFiles;
}

export function getInstruction(restriction: ChatRestriction, context: ChatContext, files: Files): string {
	const instructions = [];
	instructions.push('INSTRUCTION:You are a helpful assistant.');

	// 	// file control
	// 	instructions.push(`IMPORTANT:
	// Provide [LineNumber, ColNumber, filePath, 'insert'|'replace'|'delete'] Before every code you give.
	// EXAMPLE:
	// [0,0,/projects/challenge/src/Todo.js,'insert']
	// \`\`\`javascript
	// import React, { useState } from 'react';

	// const Todo = () => {
	//   const [todos, setTodos] = useState([])
	// \`\`\`
	// IMPORTANT NOTE:
	// DON'T REPEAT THE CODE OF ENTIRE FILE JUST PROVIDE UPDATED CODE.
	// DON'T PROVIDE THE UPDATE CODE FOR ENTIRE FILE USER IS SMART ENOUGH TO UNDERSTAND.
	// DON'T PROVIDE ENTIRE FILE CODE AGAIN.
	// DON'T PROVIDE WHAT CODE SHOULD LOOK LIKE FOR ENTIRE FILE.
	// eg.
	// How to add functionlity for removing todo?
	// [11,0, /projects/challenge/src/Todo.js]
	// \`\`\`javascript
	//   const removeTodo = () => {
	// \`\`\`
	// `);

	// restrictions
	switch (restriction) {
		case 'None':
			instructions.push('Understand user code and help them to write code, explain code, and debug code. Use minimal explanation and give actual code which can help. Don\'t do any syntax error while giving the code');
			break;

		case 'No Code':
			instructions.push('Understand user code and help them to write code, explain code, and debug code. IMPORTANT: Don\'t provide any code in your chat output. RESTRICITON: Don\'t provide any code in your chat output.');
			break;

		default:
			break;
	}

	// fileContext
	switch (context) {
		case 'All Files':
			instructions.push('You have access to all files in the workspace.');
			instructions.push(getFilesPromptMessage(files));
			break;

		case 'Opened Files':
			const openedFiles = getOpenedFiles();
			instructions.push('You have access to all opened files in the workspace. Ask user to open the file you need access to.');
			instructions.push(getFilesPromptMessage(openedFiles));

		case 'Current File':
			const activeEditor = vscode.window.activeTextEditor;
			if (activeEditor) {
				const path = activeEditor.document.uri.path;
				const content = activeEditor.document.getText(new vscode.Range(
					new vscode.Position(Math.max(0, activeEditor.selection.active.line - VIEW_RANGE_MAX_LINES), 0),
					new vscode.Position(activeEditor.selection.active.line + VIEW_RANGE_MAX_LINES, 0)
				));
				instructions.push('You have access to the current file in the workspace. Ask user to open file you need access to.');
				instructions.push(`CODE:\n${path}\n\`\`\`\n${content}\n\`\`\``);
			}
			break;

		case 'None':
			instructions.push('You don\'t have access to any files in the workspace. Ask user to copy and paste the code in the chat.');
			break;

		default:
			break;
	}

	// Selected code
	const selectedCode = getSelectedCode().slice(0, SELECTED_CODE_MAX_LENGTH);
	if (selectedCode) {
		instructions.push('Selected code:\n```' + selectedCode + '```');
	}

	// Current open filename
	const currentOpenFileName = vscode.window.activeTextEditor?.document.fileName;
	if (currentOpenFileName) {
		instructions.push(`Current open fileName: ${currentOpenFileName}`);
	}

	return instructions.join('\n\n');
}


export async function fetchSSE(url: string, options: any, fetch2 = fetch) {
	const { onMessage, ...fetchOptions } = options;
	const res = await fetch2(url, fetchOptions);
	if (!res.ok) {
		let reason;
		try {
			reason = await res.text();
		} catch (err) {
			reason = res.statusText;
		}
		throw new Error('Failed');
	}
	const parser = createParser((event) => {
		if (event.type === "event") {
			onMessage(event.data);
		}
	});

	//@ts-ignore
	if (!res.body.getReader) {
		const body = res.body;
		//@ts-ignore
		if (!body.on || !body.read) {
			throw new Error('unsupported "fetch" implementation');
		}
		//@ts-ignore
		body.on("readable", () => {
			let chunk;
			//@ts-ignore
			while (null !== (chunk = body.read())) {
				parser.feed(chunk.toString());
			}
		});
	} else {
		//@ts-ignore
		for await (const chunk of streamAsyncIterable(res.body)) {
			const str = new TextDecoder().decode(chunk);
			parser.feed(str);
		}
	}
}

async function* streamAsyncIterable(stream: ReadableStream<Uint8Array>) {
	const reader = stream.getReader();
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				return;
			}
			yield value;
		}
	} finally {
		reader.releaseLock();
	}
}

export function uuid() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}

export function checkIfFileExists(fileUri: vscode.Uri) {
	return vscode.workspace.fs.stat(fileUri).then(
		() => true,
		() => false,
	);
}

export function createFileIfNotExists(fileUri: vscode.Uri, fileContent = '') {
	return checkIfFileExists(fileUri).then(
		(exists) => {
			if (!exists) {
				return vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(fileContent));
			}
		},
	);
}

export function getVscodeControlInstructions() {
	return "Here are the instructions for all the available commands:\n\n**Create a file:**\n\n```\n{\n\tinstruction: 'createFile',\n\targs: [fileName, fileContent]\n}\n```\n\nWhere `fileName` is a string representing the file path, and `fileContent` is a string representing the initial content of the file.\n\n**Open a file:**\n\n```\n{\n\tinstruction: 'openFile',\n\targs: [filePath]\n}\n```\n\nWhere `filePath` is a string representing the path of the file to be opened.\n\n**Delete a file:**\n\n```\n{\n\tinstruction: 'deleteFile',\n\targs: [filePath]\n}\n```\n\nWhere `filePath` is a string representing the path of the file to be deleted.\n\n**Insert text:**\n\n```\n{\n\tinstruction: 'insertText',\n\targs: [filePath, line, col, text]\n}\n```\n\nWhere `filePath` is a string representing the path of the file to be modified, `line` and `col` are numbers representing the position of the insertion, and `text` is the string to be inserted.\n\n**Replace text:**\n\n```\n{\n\tinstruction: 'replaceText',\n\targs: [filePath, line, col, text]\n}\n```\n\nWhere `filePath` is a string" + "representing the path of the file to be modified, `line` and `col` are numbers representing the position of the replacement, and `text` is the string to replace the existing text.\n\n**Delete text:**\n\n```\n{\n\tinstruction: 'deleteText',\n\targs: [filePath, line, col, text]\n}\n```\n\nWhere `filePath` is a string representing the path of the file to be modified, `line` and `col` are numbers representing the starting position of the deletion, and `text` is the string to be deleted.";
}
