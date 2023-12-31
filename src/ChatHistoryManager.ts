import { debounce } from "lodash";
import * as vscode from "vscode";
import { getChatTitle } from "./api";
import { CHAT_HISTORY_FILE_NAME } from "./constant";
import { createFileIfNotExists, uuid } from "./utils";

export class Chat {
  constructor(public role: "user" | "assistant", public content: string) {}
}

export class ChatHistory {
  constructor(public chatId: string, public title: string, public history: Chat[]) {}
}

export default class ChatHistoryManager {
  private _history: ChatHistory[] = [];
  private _historyMap: { [chatId: string]: ChatHistory } = {};
  private currentChatId: string | null = null;
  private isInitiated = false;
  private saveDebounced = () => {};

  constructor() {
    this.saveDebounced = debounce(() => this.save(), 1000);
    this.init();
  }

  get currentChat(): ChatHistory {
    return this.getHistory(this.getChatId);
  }

  private get getChatId(): string {
    const config = vscode.workspace.getConfiguration("autopilot");

    if (!this.currentChatId) {
      this.currentChatId = config.get<string>("chatId") ?? null;
      if (!this.currentChatId) {
        this.currentChatId = uuid();

        // Update in background
        config.update("chatId", this.currentChatId, true).then(() => {});
      }
    }
    return this.currentChatId;
  }

  private get chatHistoryFileUri(): vscode.Uri {
    return vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, ".vscode", CHAT_HISTORY_FILE_NAME);
  }

  showAndChangeHistory(onHistorySelect: (chatHistory: ChatHistory) => void) {
    this.waitForInit().then(() => {
      const pickItems = this.getHistoryList().map((history) => {
        const isCurrentChat = history.chatId === this.getChatId;
        return {
          label: history.title,
          history,
          description: isCurrentChat ? "Current Chat" : "",
          picked: isCurrentChat,
        };
      });

      vscode.window.showQuickPick(pickItems).then((item) => {
        if (item) {
          this.changeCurrentChatId(item.history.chatId);
          onHistorySelect(item.history);
        }
      });
    });
  }

  clearHistory() {
    this._history = [];
    this._historyMap = {};
    this.changeCurrentChatId("");
    this.saveDebounced();
  }

  waitForInit(): Promise<void> {
    return new Promise((resolve) => {
      if (this.isInitiated) {
        resolve();
      } else {
        this.init().then(() => resolve());
      }
    });
  }

  private addMessage(chat: Chat) {
    this.addHistory(this.getChatId, chat);
  }

  addQuestion(question: string) {
    this.addMessage(new Chat("user", question));
  }

  addAnswer(answer: string) {
    this.addMessage(new Chat("assistant", answer));

    // check if current title is 'New Chat' then update it using GPT
    if (this.getHistory(this.getChatId).title === "New Chat") {
      console.log("Updating title using GPT");
      this.updateTitleUsingGPT(this.getChatId);
    }
  }

  getMessages(): Chat[] {
    return this.getHistory(this.getChatId)?.history || [];
  }

  startNewChat() {
    this.changeCurrentChatId(uuid());
  }

  private async init() {
    await createFileIfNotExists(this.chatHistoryFileUri, "[]");
    await this.load();
    this.isInitiated = true;
  }

  private getHistory(chatId: string): ChatHistory {
    return this._historyMap[chatId];
  }

  private addHistory(chatId: string, chat: Chat) {
    if (!this._historyMap[chatId]) {
      const title = "New Chat";
      this._historyMap[chatId] = new ChatHistory(chatId, title, []);
      this._history.push(this._historyMap[chatId]);
    }
    this._historyMap[chatId].history.push(chat);
    this.saveDebounced();
  }

  private async updateTitleUsingGPT(chatId: string): Promise<void> {
    const history = this.getHistory(chatId);
    const question = history.history[history.history.length - 1].content;
    const answer = history.history[history.history.length - 2].content;
    const context = `USER:${question}\nAI:${answer}`;
    const title = await getChatTitle(context);
    this._historyMap[chatId].title = title;
    this.saveDebounced();
  }

  private getHistoryList(): ChatHistory[] {
    return this._history;
  }

  private changeCurrentChatId(chatId: string) {
    const config = vscode.workspace.getConfiguration("autopilot");
    this.currentChatId = chatId;
    config.update("chatId", chatId, true);
  }

  private async save() {
    const chatHistoryData = JSON.stringify(this._history);
    return vscode.workspace.fs.writeFile(this.chatHistoryFileUri, new TextEncoder().encode(chatHistoryData));
  }

  private async load() {
    const chatHistoryData = await vscode.workspace.fs.readFile(this.chatHistoryFileUri);
    const textData = new TextDecoder().decode(chatHistoryData);
    console.log(textData);
    try {
      this._history = JSON.parse(textData);
    } catch (error) {
      this._history = [];
      console.error(error);
    }
    this._history.forEach((chatHistory) => {
      this._historyMap[chatHistory.chatId] = chatHistory;
    });
  }
}
