import { ChatConfig, CompletionConfig } from "./types";

export const MAX_PREVIOUS_LINE_FOR_PROMPT = 50;
export const MAX_ALLOWED_CACHED_SUGGESTION_DIFF = 3;
export const MAX_ALLOWED_LINE = 50;
export const SELECTED_CODE_MAX_LENGTH = 1000;
export const VIEW_RANGE_MAX_LINES = 100;
export const CHAT_HISTORY_FILE_NAME = "chat_history.json";

export const CONFIGURATION_KEYS = {
  name: "hackergpt",
  hackergpt: {
    openaiAPIKey: "openaiAPIKey",
    chat: {
      model: "chatModel",
      temperature: "chatTemperature",
      context: "chatContext",
    },
    completion: {
      model: "completionModel",
      temperature: "completionTemperature",
      numberOfCompletions: "numberOfCompletions",
      maxTokens: "completionMaxTokens",
    },
  },
};

export const CHAT_DEFAULT_CONFIGURATION: ChatConfig = {
  model: "gpt-3.5-turbo",
  temperature: 0.5,
  context: "None",
};

export const COMPLETION_DEFAULT_CONFIGURATION: CompletionConfig = {
  model: "text-davinci-002",
  temperature: 0.5,
  numberOfCompletions: 1,
  maxTokens: 100,
};
