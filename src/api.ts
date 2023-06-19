import * as vscode from "vscode";
// @ts-ignore
import { encode } from "./encoder";
import { ChatCompletionRequestMessageRoleEnum } from "openai";
import { Message } from "./ChatHistoryManager";
import { Files } from "./types";
import {
  fetchSSE,
  getChatConfig,
  getCompletionConfig,
  getFiles,
  getCurrentWorkSpaceFolderPath,
  getInstruction,
  getOpenAIKey,
  getOpenApi,
  getVscodeControlFunctionDecelerations,
  getVscodeControlFunctionsDescriptions,
  modelMaxTokens,
  openaiBaseURL,
} from "./utils";
import { IS_ALWAYS_COMPLETIONS_ONE_LINE, MSG_WINDOW_SIZE } from "./constant";

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

    const baseProjectPath = getCurrentWorkSpaceFolderPath();

    const systemMessage2 = {
      role: ChatCompletionRequestMessageRoleEnum.System,
      content: [
        "You are also vscode sudo bot, Help user to get things done with his query.",
        `Consider this root path of project while giving the file paths and always give full filepaths.`,
        `Project root path: ${baseProjectPath}`,
      ].join("\n"),
    };

    const userMessage = {
      role: ChatCompletionRequestMessageRoleEnum.User,
      content: question,
    };

    const lastNHistory = history.slice(history.length - MSG_WINDOW_SIZE);
    const messages = [systemMessage, systemMessage2, ...lastNHistory, userMessage];
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
      functions: getVscodeControlFunctionsDescriptions(),
      model: "gpt-3.5-turbo-0613",
    };

    let functionName = "";

    function onMessage(data: string) {
      var _a2;
      if (data === "[DONE]") {
        if (functionName) {
          const functionArguments = JSON.parse(fullResponse);

          if (functionName && functionArguments) {
            const availableFunctions = getVscodeControlFunctionDecelerations();
            const requiredFunction = availableFunctions[functionName as keyof typeof availableFunctions];
            requiredFunction?.(functionArguments);
            onPartialAnswer("\n DONE!");
            return resolve("Executed" + functionName);
          }
        }
        resolve(fullResponse);
      }
      try {
        const response = JSON.parse(data);

        if ((_a2 = response == null ? void 0 : response.choices) == null ? void 0 : _a2.length) {
          const delta = response.choices[0].delta;

          // Execute function
          if ("function_call" in delta) {
            if (!functionName) {
              functionName = delta.function_call.name;
              onPartialAnswer("Doing my best to execute " + functionName);
            }

            fullResponse += delta.function_call.arguments;
            return;
          }

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
export async function sudoVscode(userCommand: string, history: Chat[]) {
  const baseProjectPath = getCurrentWorkSpaceFolderPath();
  const systemMessage = {
    role: ChatCompletionRequestMessageRoleEnum.System,
    content: [
      "You are vscode sudo bot, Help user to get things done with his query.",
      `Consider this root path of project while giving the file paths and always give full filepaths.`,
      `Project root path: ${baseProjectPath}`,
    ].join("\n"),
  };
  const userMessage = {
    role: ChatCompletionRequestMessageRoleEnum.User,
    content: userCommand,
  };
  const messages = [systemMessage, ...history, userMessage];
  const res = await getOpenApi().createChatCompletion({
    functions: getVscodeControlFunctionsDescriptions(),
    model: "gpt-3.5-turbo-0613",
    messages,
  });

  const resultMessage = res.data.choices[0].message;
  if (!resultMessage) {
    return;
  }

  if ("function_call" in resultMessage) {
    const functionName = resultMessage.function_call?.name;
    const functionArgs = resultMessage.function_call?.arguments;
    if (functionName && functionArgs) {
      console.log(functionName, functionArgs);
      const args = JSON.parse(functionArgs);
      console.log(args);
      const availableFunctions = getVscodeControlFunctionDecelerations();
      const requiredFunction = availableFunctions[functionName as keyof typeof availableFunctions];
      requiredFunction?.(args);
    }
  }
}
