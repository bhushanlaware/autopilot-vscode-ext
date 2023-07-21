import * as vscode from "vscode";
import { ChatCompletionRequestMessageRoleEnum } from "openai";
import { Message } from "./ChatHistoryManager";
import { MSG_WINDOW_SIZE } from "./constant";
// @ts-ignore
import { encode } from "./encoder";
import { Files } from "./types";
import {
  fetchSSE,
  getChatConfig,
  getCompletionConfig,
  getInstruction,
  getOpenAIKey,
  getOpenApi,
  modelMaxTokens,
  openaiBaseURL,
} from "./utils";

let abortController: AbortController | null = null;
export function cancelGPTRequest() {
  if (abortController) {
    abortController.abort();
  }
}

export function askQuestionWithPartialAnswers(question: string, history: Message[], onPartialAnswer: (_: string) => void): Promise<string> {
  return new Promise<string>(async (resolve, reject) => {
    const { temperature, model } = getChatConfig();
    const relativeContext = (await vscode.commands.executeCommand("autopilot.getContext", question)) as Files;
    const systemInstruction = getInstruction(relativeContext);

    let fullResponse = "";
    abortController = new AbortController();

    const systemMessage = {
      role: ChatCompletionRequestMessageRoleEnum.System,
      content: systemInstruction,
    };

    const userMessage = {
      role: ChatCompletionRequestMessageRoleEnum.User,
      content: question,
    };

    const lastNHistory = history.slice(history.length - MSG_WINDOW_SIZE);
    const messages = [systemMessage, ...lastNHistory, userMessage];
    const maxTokens = modelMaxTokens[model];

    const totalTokens = messages.reduce((acc, message) => {
      return acc + encode(message.content).length;
    }, 0);

    console.info("Total tokens: ", totalTokens, "Max tokens: ", maxTokens, "Model: ", model);

    if (totalTokens > maxTokens) {
      console.error("You have reached the maximum number of tokens for this session. Please restart the session.", totalTokens);
      vscode.window.showErrorMessage("You have reached the maximum number of tokens for this session. Please restart the session.");
      return reject("You have reached the maximum number of tokens for this session. Please restart the session.");
    }

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getOpenAIKey()}`,
    };

    const url = `${openaiBaseURL}/v1/chat/completions`;
    const body = {
      messages,
      temperature,
      stream: true,
      model,
    };

    vscode.commands.executeCommand("autopilot.addChatCost", model, totalTokens);

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

export async function getCodeCompletions(prompt: string, stop: string, cancellationToken: vscode.CancellationToken): Promise<string[]> {
  const config = getCompletionConfig();
  const abortController = new AbortController();

  cancellationToken.onCancellationRequested(() => {
    abortController.abort();
  });

  try {
    const { data } = await getOpenApi().createCompletion(
      {
        prompt,
        stop,
        model: config.model,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      },
      {
        signal: abortController.signal,
      }
    );

    const tokenUsed = data.usage?.total_tokens;

    if (tokenUsed) {
      vscode.commands.executeCommand("autopilot.addCompletionCost", config.model, tokenUsed);
    }

    const choices = (data.choices || []).map((completion) => {
      if (completion.text) {
        return completion.text.startsWith("\n") ? completion.text.slice(1) : completion.text;
      }
      return "";
    });
    return choices;
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function getChatTitle(chatContext: string): Promise<string> {
  const prompt = `Suggest me good title for this CHAT::"""${chatContext}"""\n TITLE::`;
  const res = await getOpenApi().createCompletion({
    prompt,
    model: "text-davinci-002",
    temperature: 0.5,
    n: 1,
    top_p: 1,
  });

  const tokenUsed = res.data.usage?.total_tokens;

  if (tokenUsed) {
    vscode.commands.executeCommand("autopilot.addCompletionCost", "text-davinci-002", tokenUsed);
  }

  return res.data.choices[0].text?.trim() || "";
}

export const createEmbedding = async (...contents: string[]) => {
  const response = await getOpenApi().createEmbedding({
    input: contents.join("\n"),
    model: "text-embedding-ada-002",
  });
  vscode.commands.executeCommand("autopilot.addEmbeddingCost", "text-embedding-ada-002", response.data.usage.total_tokens);
  return response.data.data[0].embedding;
};

export const writeCodeForPrompt = (
  prompt: string,
  windowCode: string,
  selectedCode: string,
  fileName: string,
  onPartialCode: (_: string) => void
): Promise<string> => {
  return new Promise<string>(async (resolve, reject) => {
    const systemInstructions = [`You are code writer who write code inside vscode editor. Return output as code.`];
    if (selectedCode) {
      systemInstructions.push(`USER SELECTED CODE::\`\`\`${selectedCode}\`\`\``);
      systemInstructions.push(`USER SELECTED CODE will always be replaced with your code.`);
    }

    if (windowCode) {
      systemInstructions.push(`USER WINDOWED CODE::\`\`\`${windowCode}\`\`\``);
      systemInstructions.push(`USER WINDOWS CODE is code near user cursor.`);
    }

    let fullResponse = "";
    abortController = new AbortController();

    const messages = [
      {
        role: ChatCompletionRequestMessageRoleEnum.System,
        content: systemInstructions.join("\n\n"),
      },
      {
        role: ChatCompletionRequestMessageRoleEnum.User,
        content: `${prompt}, GIVE THE CODE ONLY DON'T PROVIDE INSTRUCTIONS.
        OUTPUT:: \`\`\`\n`,
      },
    ];

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getOpenAIKey()}`,
    };

    const url = `${openaiBaseURL}/v1/chat/completions`;
    const body = {
      messages,
      temperature: 0,
      stream: true,
      model: "gpt-3.5-turbo",
      stop: "```",
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
              onPartialCode(responseText);
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
};
