import * as vscode from "vscode";
import ChatsManager, { Chat } from "./ChatHistoryManager";

export class ChatHistoryTreeViewProvider implements vscode.TreeDataProvider<Chat> {
  private _onDidChangeTreeData: vscode.EventEmitter<Chat[] | null> = new vscode.EventEmitter<Chat[]>();
  readonly onDidChangeTreeData: vscode.Event<Chat[] | null> = this._onDidChangeTreeData.event;

  constructor(private context: vscode.ExtensionContext, private readonly chatManager: ChatsManager) {
    this.chatManager.onChatRepoChange((e) => {
      console.log(e);
      this._onDidChangeTreeData.fire(null);
    });

    this.context.subscriptions.push(
      vscode.commands.registerCommand("autopilot.deleteChat", async (chat: Chat) => {
        const confirm = await vscode.window.showWarningMessage(`Are you sure you want to delete "${chat.title}"?`, { modal: true }, "Yes");
        if (confirm === "Yes") {
          this.chatManager.deleteChat(chat.chatId);
        }
      })
    );
  }

  getTreeItem(element: Chat): vscode.TreeItem {
    return {
      label: element.title,
      command: {
        command: "autopilot.openChat",
        arguments: [element.chatId],
        title: "Open",
      },
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      contextValue: "autopilot.chat",
      iconPath: vscode.ThemeIcon.File,
      tooltip: element.title,
    };
  }

  getChildren(element?: Chat): Thenable<Chat[]> {
    return Promise.resolve(this.chatManager.chatList);
  }
}
