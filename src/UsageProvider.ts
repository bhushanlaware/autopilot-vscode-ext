import * as vscode from "vscode";
import { Disposable, ExtensionContext } from "vscode";
import { openaiModel } from "./constant";

type TCost = {
  totalTokenUsed: number;
  totalCost: number;
};

interface IUsage {
  chat: TCost;
  completion: TCost;
  embedding: TCost;
}

export class UsageProvider implements Disposable {
  disposable: Disposable[] = [];
  constructor(private readonly context: ExtensionContext) {
    this.disposable.push(
      vscode.commands.registerCommand("autopilot.addChatCost", this.addChatCost.bind(this)),
      vscode.commands.registerCommand("autopilot.addCompletionCost", this.addCompletionCost.bind(this)),
      vscode.commands.registerCommand("autopilot.addEmbeddingCost", this.addEmbeddingCost.bind(this))
    );
  }

  private getCost(tokensUsed: number, model: keyof typeof openaiModel) {
    const pricingPer1kToken = openaiModel[model].pricingPer1kToken;
    return (tokensUsed * pricingPer1kToken) / 1000;
  }

  private get usage(): IUsage {
    const usage = this.context.globalState.get<IUsage>("autopilot.usage");
    if (!usage) {
      return {
        chat: {
          totalTokenUsed: 0,
          totalCost: 0,
        },
        completion: {
          totalTokenUsed: 0,
          totalCost: 0,
        },
        embedding: {
          totalTokenUsed: 0,
          totalCost: 0,
        },
      };
    }
    return usage;
  }

  private async addUsage(type: keyof IUsage, token: number, cost: number) {
    const usage = this.usage;
    usage[type].totalTokenUsed += token;
    usage[type].totalCost += cost;
    await this.context.globalState.update("autopilot.usage", usage);
  }

  private async addChatCost(model: keyof typeof openaiModel, tokenUsed: number) {
    const cost = this.getCost(tokenUsed, model);
    await this.addUsage("chat", tokenUsed, cost);
  }

  private async addCompletionCost(model: keyof typeof openaiModel, tokenUsed: number) {
    const cost = this.getCost(tokenUsed, model);
    await this.addUsage("completion", tokenUsed, cost);
  }

  private async addEmbeddingCost(model: keyof typeof openaiModel, tokenUsed: number) {
    const cost = this.getCost(tokenUsed, model);
    await this.addUsage("embedding", tokenUsed, cost);
  }

  dispose() {
    this.disposable.forEach((d) => d.dispose());
  }
}
