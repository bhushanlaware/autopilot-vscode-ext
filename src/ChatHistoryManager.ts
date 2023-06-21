import { debounce } from "lodash";
import * as vscode from "vscode";
import { getChatTitle } from "./api";
import { uuid } from "./utils";

export class Message {
  constructor(public role: "user" | "assistant", public content: string) {}
}

export class Chat {
  constructor(public chatId: string, public title: string, public history: Message[]) {}
}

export interface ChatRepository {
  [chatId: string]: Chat;
}

export default class ChatsManager {
  private _chatRepo: ChatRepository;
  private _currentChat: Chat;
  private saveDebounced = () => {};
  private onChatRepoChangeEmitter = new vscode.EventEmitter<ChatRepository>();
  private onChatChangeEmitter = new vscode.EventEmitter<Chat>();

  constructor(private readonly context: vscode.ExtensionContext) {
    this.saveDebounced = debounce(() => this.save(), 100);

    this._chatRepo = this.context.workspaceState.get<ChatRepository>("autopilot.chatRepo") || {};
    const savedChatId = this.context.workspaceState.get<string>("autopilot.chatId");

    console.log("savedChatId", savedChatId);
    console.log("chatRepo", this._chatRepo);

    if (savedChatId && this._chatRepo[savedChatId]) {
      this._currentChat = this._chatRepo[savedChatId];
    } else {
      const chatId = uuid();
      this.setChatId(chatId);
      this._currentChat = new Chat(chatId, "New Chat", []);
      this._chatRepo[chatId] = this._currentChat;
      this.saveDebounced();
    }
  }

  public get onChatRepoChange(): vscode.Event<ChatRepository> {
    return this.onChatRepoChangeEmitter.event;
  }

  public get onChatChange(): vscode.Event<Chat> {
    return this.onChatChangeEmitter.event;
  }

  private async setChatId(chatId: string) {
    return this.context.workspaceState.update("autopilot.chatId", chatId);
  }

  get currentChat(): Chat {
    return this._currentChat;
  }

  set currentChat(chat: Chat) {
    this.setChatId(chat.chatId);
    this._currentChat = chat;
    this.onChatChangeEmitter.fire(chat);
  }

  get chatList(): Chat[] {
    return Object.keys(this._chatRepo).map((key) => this._chatRepo[key]);
  }

  public quickPickChats() {
    const pickItems = this.chatList.map((chat) => {
      const isCurrentChat = chat.chatId === this.currentChat.chatId;
      return {
        label: chat.title,
        chat,
        description: isCurrentChat ? "Current Chat" : "",
        picked: isCurrentChat,
      };
    });

    vscode.window.showQuickPick(pickItems).then((item) => {
      if (item) {
        this.currentChat = item.chat;
      }
    });
  }

  removeAllChats() {
    this._chatRepo = {};
    this.saveDebounced();
    this.startNewChat();
  }

  private addMessage(msg: Message) {
    const chatId = this.currentChat.chatId;
    this._chatRepo[chatId].history.push(msg);
  }

  addQuestion(question: string) {
    this.addMessage(new Message("user", question));
  }

  addAnswer(answer: string) {
    this.addMessage(new Message("assistant", answer));

    // check if current title is 'New Chat' then update it using GPT
    if (this.currentChat?.title === "New Chat") {
      console.log("Updating title using GPT");
      this.updateTitleUsingGPT(this.currentChat.chatId).then((title) => {
        console.info(`Updated title to ${title}`);
      });
    }
  }

  startNewChat() {
    const newChatId = uuid();
    this.currentChat = new Chat(newChatId, "New Chat", []);
    this._chatRepo[newChatId] = this.currentChat;
    this.saveDebounced();
  }

  public deleteChat(chatId: string) {
    delete this._chatRepo[chatId];
    this.saveDebounced();
  }

  public openChat(chatId: string) {
    this.currentChat = this._chatRepo[chatId];
  }

  private async updateTitleUsingGPT(chatId: string): Promise<string> {
    const history = this._chatRepo[chatId].history;

    const question = history[history.length - 1].content;
    const answer = history[history.length - 2].content;

    const context = `USER:${question}\nAI:${answer}`;

    const title = await getChatTitle(context);

    this._chatRepo[chatId].title = title;
    this.saveDebounced();
    return title;
  }

  private async save() {
    await this.context.workspaceState.update("autopilot.chatRepo", this._chatRepo);
    this.onChatRepoChangeEmitter.fire(this._chatRepo);
  }
}
