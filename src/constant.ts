import { ChatConfig, CompletionConfig } from "./types";

export const MAX_PREVIOUS_LINE_FOR_PROMPT = 10;
export const MAX_ALLOWED_CACHED_SUGGESTION_DIFF = 3;
export const MAX_ALLOWED_LINE = 50;
export const SELECTED_CODE_MAX_LENGTH = 1000;
export const VIEW_RANGE_MAX_LINES = 100;
export const CHAT_HISTORY_FILE_NAME = "chat_history.json";
export const TOP_INDEX = 5;
export const CHUNK_SIZE = 2500;
export const EMBEDDING_DEBOUNCE_TIMER = 5000;
export const AUTOCOMPLETION_DEBOUNCE_TIMER = 300;
export const AUTOSUGGESTION_TRIGGER_DEBOUNCE_TIME = 100;
export const MSG_WINDOW_SIZE = 5;
export const IS_ALWAYS_COMPLETIONS_ONE_LINE = true;
export const AUTOWRITE_CONTEXT_WINDOW = 10;
export const CONFIGURATION_KEYS = {
  name: "autopilot",
  autopilot: {
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

export const CHAT_CONTEXT = {
  allFiles: "All Files",
  None: "None",
  currentFile: "Current File",
  openedFiles: "Opened Files",
};

export const openaiModel = {
  "gpt-4": {
    maxToken: 8000,
    pricingPer1kToken: 0.03,
  },
  "gpt-4-32k": {
    maxToken: 32000,
    pricingPer1kToken: 0.06,
  },
  "gpt-3.5-turbo": {
    maxToken: 4000,
    pricingPer1kToken: 0.0015,
  },
  "gpt-3.5-turbo-16k": {
    maxToken: 16000,
    pricingPer1kToken: 0.003,
  },
  "text-davinci-002": {
    pricingPer1kToken: 0.02,
  },
  "text-davinci-003": {
    pricingPer1kToken: 0.02,
  },
  "text-curie-001": {
    pricingPer1kToken: 0.002,
  },
  "text-babbage-001": {
    pricingPer1kToken: 0.0005,
  },
  "text-ada-001": {
    pricingPer1kToken: 0.0004,
  },
  "text-embedding-ada-002": {
    pricingPer1kToken: 0.0001,
  },
  "text-search-ada-doc-001": {
    pricingPer1kToken: 0.004,
  },
};
