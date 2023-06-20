import * as vscode from "vscode";
// @ts-ignore
import { encode } from "./encoder";
import { ChatCompletionRequestMessageRoleEnum } from "openai";
import { Chat } from "./ChatHistoryManager";
import { Files } from "./types";
import {
  fetchSSE,
  getChatConfig,
  getCompletionConfig,
  getFiles,
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

export function askQuestionWithPartialAnswers(question: string, history: Chat[], onPartialAnswer: (_: string) => void): Promise<string> {
  return new Promise<string>(async (resolve, reject) => {
    const { temperature, model } = getChatConfig();
    const relativeContext = (await vscode.commands.executeCommand("autopilot.getContext")) as Files;
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

    const messages = [systemMessage, ...history, userMessage];
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
  return res.data.choices[0].text?.trim() || "";
}

export const createEmbedding = async (...contents: string[]) => {
  const response = await getOpenApi().createEmbedding({
    input: contents.join("\n"),
    model: "text-embedding-ada-002",
  });
  return response.data.data[0].embedding;
};
