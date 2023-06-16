
import { ChatConfig, CompletionConfig, Files } from './types';

const devUrl = 'http://localhost:3002';
const gcpAppEngine = 'https://vm-provider-dev.uc.r.appspot.com';
const gcpCloudRun = 'https://hackergpt-backend-rcooobifwa-uc.a.run.app';

function getEndpoints(url: string) {
	return {
		completions: `${url}/completions`,
		chatStream: `${url}/chat/stream`,
		chatHistory: `${url}/chat/history`,
		createIndex: `${url}/indexing/create`,
		updateIndex: `${url}/indexing/update`,
	};
}

const endpoints = getEndpoints(gcpCloudRun);

let abortController: AbortController | null = null;

export function cancelGPTRequest() {
	if (abortController) {
		abortController.abort();
	}
}

export function askQuestionWithPartialAnswers(
	question: string,
	onPartialAnswer: (_: string) => void,
	chatConfig: ChatConfig) {
	const {
		sessionId,
		controlId,
		chatModel,
		chatRestriction,
		chatTemperature,
	} = chatConfig;

	const body = {
		sessionId,
		controlId,
		question,
		options: {
			model: chatModel,
			temperature: chatTemperature,
			restrictions: chatRestriction,
		}
	};

	return streamFetch(endpoints.chatStream,
		body,
		onPartialAnswer,
	);
}

function streamFetch(url: string, requestBody: any, callback: Function): Promise<string> {
	return new Promise(async (res, rej) => {
		try {
			abortController = new AbortController();
			const response = await fetch(url, {
				method: 'POST',
				body: JSON.stringify(requestBody),
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Content-Type': 'application/json',
				},
				signal: abortController?.signal,
			});
			// @ts-ignore

			const reader = response.body.getReader();
			let result = '';
			while (true) {
				const { done, value } = await reader.read();
				if (done) {
					return res(result);
				}
				const newValue = new TextDecoder('utf-8').decode(value);
				result += newValue;
				callback(newValue);
			}
		} catch (error) {
			console.error(error);
			rej(error);
		};
	});
}

export async function getChatHistory(sessionId: string, controlId: string) {
	const body = {
		sessionId,
		controlId,
	};

	try {
		const res = await fetch(endpoints.chatHistory, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body),
		});
		const data = await res.json();

		return data || [];
	} catch (e) {
		console.error(e);
		return [];
	}

}

export async function getCodeCompletions({ prompt, model, stop, cancellationToken, n }: CompletionConfig): Promise<string[]> {

	const abortController = new AbortController();
	cancellationToken.onCancellationRequested(() => {
		abortController.abort();
	});

	console.log(prompt);
	const body = {
		prompt,
		options: {
			stop,
			model,
		}
	};

	const url = endpoints.completions;

	const response = await fetch(url, {
		method: "POST",
		headers: {
			'Content-Type': 'application/json',
		},
		signal: abortController.signal,
		body: JSON.stringify(body),
	});

	const data = await response.json();
	return data;
}


export async function createIndex(sessionId: string, controlId: string, files: Files) {
	const body = {
		sessionId,
		controlId,
		files,
	};

	const url = endpoints.createIndex;

	const response = await fetch(url, {
		method: "POST",
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(body),
	});

	const data = await response.json();
	return data;
}

export async function updateIndex(sessionId: string, controlId: string, files: Files) {
	const body = {
		sessionId,
		controlId,
		files,
	};
	const url = endpoints.updateIndex;
	const response = await fetch(url, {
		method: "POST",
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(body),
	});
	const data = await response.json();
	return data;
}
