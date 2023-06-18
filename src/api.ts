import * as vscode from "vscode";
// @ts-ignore
import { encode } from "./encoder";
import { ChatCompletionRequestMessageRoleEnum } from "openai";
import { Chat } from "./ChatHistoryManager";
import { Files } from "./types";
import { getChatConfig, getCompletionConfig, getInstruction, getOpenApi, modelMaxTokens } from "./utils";

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
    const config = getChatConfig();
    const systemInstruction = getInstruction(config.context, files);
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
    const maxTokens = modelMaxTokens[config.model];

    const totalTokens = messages.reduce((acc, message) => {
      return acc + encode(message.content).length;
    }, 0);

    console.info("Total tokens: ", totalTokens, "Max tokens: ", maxTokens, "Model: ", config.model);

    if (totalTokens > maxTokens) {
      console.error("You have reached the maximum number of tokens for this session. Please restart the session.", totalTokens);
      vscode.window.showErrorMessage("You have reached the maximum number of tokens for this session. Please restart the session.");
      return reject("You have reached the maximum number of tokens for this session. Please restart the session.");
    }

    const gptResponse = getOpenApi().createChatCompletion(
      {
        messages,
        model: config.model,
        temperature: config.temperature,
        stream: true,
      },
      { responseType: "stream" }
    );

    gptResponse
      .then((res) => {
        //@ts-ignore
        res.data.on("data", (data) => {
          const lines = data
            .toString()
            .split("\n")
            .filter((line: string) => line.trim() !== "");
          for (const line of lines) {
            const message = line.replace(/^data: /, "");
            if (message === "[DONE]") {
              return resolve(fullResponse);
            }
            try {
              const parsed = JSON.parse(message);
              const response = parsed.choices[0].delta.content;
              if (response) {
                onPartialAnswer?.(response);
                fullResponse += response;
              }
            } catch (error: any) {}
          }
        });
      })
      .catch((error) => {
        console.error("Error during OpenAI request ", error.message);
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
    const res = await getOpenApi().createCompletion(
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
    return res.data.choices.map((choice) => choice.text || "");
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
