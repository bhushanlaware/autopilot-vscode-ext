
import * as vscode from 'vscode';
// @ts-ignore
import { encode } from './encoder';
import { ChatConfig, ChatModel, CompletionConfig, CompletionModel, Files } from './types';

import { fetchSSE, getInstruction, modelMaxTokens, openaiBaseURL } from './utils';

// Implement Gateway to secure token
const apiKey = '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';

const Roles = {
	Assistant: 'assistant',
	System: 'system',
	User: 'user',
};

const headers = {
	'Content-Type': 'application/json',
	'Authorization': `Bearer ${apiKey}`,
};

let abortController: AbortController | null = null;
export function cancelGPTRequest() {
	if (abortController) {
		abortController.abort();
	}
}

export function askQuestionWithPartialAnswers(
	question: string,
	onPartialAnswer: (_: string) => void,
	chatConfig: ChatConfig,
	files: Files): Promise<string> {
	return new Promise<string>(async (resolve, reject) => {

		const {
			chatContext,
			chatMessages,
			chatModel,
			chatRestriction,
			chatTemperature,
		} = chatConfig;

		const systemInstruction = getInstruction(chatRestriction, chatContext, files);

		let fullResponse = '';
		abortController = new AbortController();

		const systemMessage = {
			role: Roles.System,
			content: systemInstruction,
		};

		const userMessage = {
			role: Roles.User,
			content: question,
		};

		const messages = [systemMessage, ...chatMessages, userMessage];
		const maxTokens = modelMaxTokens[chatModel];
		const model = chatModel;

		const totalTokens = messages.reduce((acc, message) => {
			return acc + encode(message.content).length;
		}, 0);

		console.info('Chat Config: ', chatConfig);
		console.info('Total tokens: ', totalTokens, 'Max tokens: ', maxTokens, 'Model: ', chatConfig.chatModel);
		console.info('Messages: ', messages);

		if (totalTokens > maxTokens) {
			console.error('You have reached the maximum number of tokens for this session. Please restart the session.', totalTokens);
			vscode.window.showErrorMessage('You have reached the maximum number of tokens for this session. Please restart the session.');
			return reject('You have reached the maximum number of tokens for this session. Please restart the session.');
		}

		const url = `${openaiBaseURL}/v1/chat/completions`;
		const body = {
			messages,
			temperature: chatTemperature,
			stream: true,
			model,
		};

		function onMessage(data: string) {
			var _a2;
			if (data === "[DONE]") {
				resolve(fullResponse);
			}
			try {
				const response = JSON.parse(data);
				if ((_a2 = response == null ? void 0 : response.choices) == null ? void 0 : _a2.length) {
					const delta = response.choices[0].delta;
					if (delta == null ? void 0 : delta.content) {
						const responseText = delta.content;
						if (responseText) {
							fullResponse += responseText;
							onPartialAnswer(responseText);
						}
					}
				}
			} catch (err) {
				console.warn("OpenAI stream SEE event unexpected error", err);
			}
		}

		fetchSSE(url, {
			method: "POST",
			headers,
			body: JSON.stringify(body),
			onMessage,
			signal: (abortController as any).signal,
		});
	});
}

export async function getCodeCompletions({ prompt, model, stop, cancellationToken, n }: CompletionConfig): Promise<string[]> {

	const abortController = new AbortController();
	cancellationToken.onCancellationRequested(() => {
		abortController.abort();
	});

	const body = {
		prompt,
		temperature: 0,
		stream: false,
		max_tokens: 500,
		model,
		n: 1,
		stop
	};

	const url = `${openaiBaseURL}/v1/completions`;
	const response = await fetch(url, {
		method: "POST",
		headers,
		signal: abortController.signal,
		body: JSON.stringify(body),
	});

	const data = await response.json();
	const choices = (data.choices || []).map((completion: { text: string }) => {
		return completion.text.startsWith("\n") ? completion.text.slice(1) : completion.text;
	});
	return choices;
}

export async function getChatTitle(chatContext: string): Promise<string> {
	const url = `${openaiBaseURL}/v1/completions`;
	console.log('Chat context:\n\n', chatContext);
	const prompt = `Suggest me good title for this chat:\n\n${chatContext}\n\nTitle:`;

	const body = {
		prompt,
		temperature: 0.1,
		stream: false,
		max_tokens: 50,
		model: 'text-curie-001',
		n: 1,
		stop: '\n'
	};

	const response = await fetch(url, {
		method: "POST",
		headers,
		body: JSON.stringify(body),
	});
	const data = await response.json();

	const choices = (data.choices || []).map((completion: { text: string }) => {
		return completion.text;
	});
	console.log('Choices: ', choices);
	return choices[0];
}
