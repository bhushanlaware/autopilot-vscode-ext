import * as vscode from 'vscode';
import { Chat } from './ChatHistoryManager';

export type Files = { [key: string]: string };
export type Role = 'user' | 'assistant' | 'system';
export type ChatModel = 'gpt-3.5-turbo' | 'gpt-4';
export type ChatContext = "None" | "Current File" | "Opened Files" | "All Files";
export type ChatRestriction = 'None' | 'No Code';
export type CompletionModel = "text-davinci-003" | "text-davinci-002" | "text-curie-001" | "text-babbage-001" | "text-ada-001" | "davinci" | "curie" | "babbage" | "ada";

export interface ChatConfig {
	chatModel: ChatModel;
	chatContext: ChatContext;
	chatTemperature: number;
	chatRestriction: ChatRestriction;
	chatMessages: Chat[];
};

export interface CompletionConfig {
	prompt: string;
	cancellationToken: vscode.CancellationToken;
	n: number;
	stop: string;
	model: CompletionModel;
}
