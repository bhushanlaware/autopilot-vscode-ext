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
  getCurrentWorkSpaceFolderPath,
  getInstruction,
  getOpenAIKey,
  getOpenApi,
  getVscodeControlFunctionDecelerations,
  getVscodeControlFunctionsDescriptions,
  modelMaxTokens,
  openaiBaseURL,
} from "./utils";

let abortController: AbortController | null = null;
export function cancelGPTRequest() {
  if (abortController) {
    abortController.abort();
  }
}

export function askQuestionWithPartialAnswers(
  question: string,
  history: Chat[],
  files: Files,
  onPartialAnswer: (_: string) => void
): Promise<string> {
  return new Promise<string>(async (resolve, reject) => {
    const { temperature, model, context } = getChatConfig();
    const systemInstruction = getInstruction(context, files);
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

    const messages = [systemMessage, systemMessage2, ...history, userMessage];
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
  const prompt = `Suggest me good title for this chat:\n\n${chatContext}\n\nTitle:`;

  const res = await getOpenApi().createCompletion({
    prompt,
    stop: ["\n"],
    model: "davinci-text-002",
    temperature: 0.5,
  });
  return res.data.choices[0].text || "";
}

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
