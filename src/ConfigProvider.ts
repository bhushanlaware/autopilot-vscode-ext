import * as vscode from "vscode";
import { ChatConfig } from "./types";
import { CompletionConfig } from "./types";
import { CONFIGURATION_KEYS } from "./constant";

export class ConfigProvider {
  async getOpenApiKey(): Promise<string> {
    const config = vscode.workspace.getConfiguration(CONFIGURATION_KEYS.name);
    const apiKey = config.get<string>(CONFIGURATION_KEYS.autopilot.openaiAPIKey);
    if (apiKey) {
      return apiKey;
    } else {
      const input = await vscode.window.showInputBox({
        prompt: "Please enter your OpenAi API Key",
        password: true,
      });
      if (input) {
        await config.update(CONFIGURATION_KEYS.autopilot.openaiAPIKey, input, vscode.ConfigurationTarget.Global);
        return input;
      } else {
        throw new Error("No API Key entered");
      }
    }
  }

  async updateChatConfig(key: keyof ChatConfig | CompletionConfig, value: any) {
    const config = vscode.workspace.getConfiguration("autopilot");
    await config.update(key as string, value, true);
  }
}
