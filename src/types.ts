import { Message } from "./ChatHistoryManager";

export type Files = { [key: string]: string };
export type Role = "user" | "assistant" | "system";
export type ChatModel = "gpt-3.5-turbo" | "gpt-4";
export type ChatContext = "None" | "Current File" | "Opened Files" | "All Files";
export type ChatRestriction = "None" | "No Code";
export type CompletionModel =
  | "text-davinci-003"
  | "text-davinci-002"
  | "text-curie-001"
  | "text-babbage-001"
  | "text-ada-001"
  | "davinci"
  | "curie"
  | "babbage"
  | "ada";

export interface ChatRequest {
  model: ChatModel;
  context: ChatContext;
  temperature: number;
  messages: Message[];
  apiKey: string;
}
export interface ChatConfig {
  model: ChatModel;
  context: ChatContext;
  temperature: number;
}

export interface CompletionRequest {
  apiKey: string;
  prompt: string;
  n: number;
  stop: string;
  model: CompletionModel;
  max_tokens: number;
  temperature: number;
}

export interface CompletionConfig {
  model: CompletionModel;
  temperature: number;
  maxTokens: number;
  numberOfCompletions: number;
}

export interface IEmbedding {
  [fileName: string]: number[];
}
