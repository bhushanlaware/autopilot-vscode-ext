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

export default class ChatsManager {
  private _chatList: Chat[] = [];
  private _currentChat?: Chat;
  private saveDebounced = () => {};
  private onChatListChangeEmitter = new vscode.EventEmitter<Chat[]>();
  private onChatChangeEmitter = new vscode.EventEmitter<Chat>();

  constructor(private readonly context: vscode.ExtensionContext) {
    this.saveDebounced = debounce(() => this.save(), 1000);
    this._chatList = this.context.workspaceState.get<Chat[]>("autopilot.chat") || [];
  }

  public get onChatListChange(): vscode.Event<Chat[]> {
    return this.onChatListChangeEmitter.event;
  }

  public get onChatChange(): vscode.Event<Chat> {
    return this.onChatChangeEmitter.event;
  }

  private get chatId(): string | undefined {
    return this.context.workspaceState.get<string>("autopilot.chatId");
  }

  private set chatId(id: string) {
    this.context.workspaceState.update("autopilot.chatId", id);
  }

  get currentChat(): Chat | undefined {
    return this._currentChat;
  }

  set currentChat(chat: Chat) {
    this.chatId = chat.chatId;
    this._currentChat = chat;
    this.onChatChangeEmitter.fire(chat);
  }

  get chatList() {
    return this._chatList;
  }

  quickPickChats() {
    const pickItems = this.chatList.map((chat) => {
      const isCurrentChat = chat.chatId === this.currentChat?.chatId;
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
    this._chatList = [];
    this.saveDebounced();
    this.startNewChat();
  }

  private addMessage(msg: Message) {
    if (this.currentChat) {
      this.currentChat.history.push(msg);
      const currentIndex = this._chatList.findIndex((chat) => chat.chatId === this.currentChat?.chatId);
      this._chatList[currentIndex] = this.currentChat;
      this.saveDebounced();
    }
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
    this.currentChat = new Chat(uuid(), "New Chat", []);
  }

  private getChatFromId(chatId: string): Chat | undefined {
    return this._chatList.find((chat) => chat.chatId === chatId);
  }

  public deleteChat(chatId: string) {
    this._chatList = this._chatList.filter((chat) => chat.chatId !== chatId);
    this.saveDebounced();
  }

  private async updateTitleUsingGPT(chatId: string): Promise<string> {
    const chat = this.getChatFromId(chatId);
    if (!chat) {
      return "";
    }
    const question = chat.history[chat.history.length - 1].content;
    const answer = chat.history[chat.history.length - 2].content;
    const context = `USER:${question}\nAI:${answer}`;
    const title = await getChatTitle(context);

    const chatIndex = this._chatList.findIndex((x) => x.chatId === chatId);
    this._chatList[chatIndex].title = title;
    this.saveDebounced();
    this.onChatListChangeEmitter.fire(this._chatList);
    return title;
  }

  private async save() {
    await this.context.workspaceState.update("autopilot.chat", this._chatList);
  }
}
