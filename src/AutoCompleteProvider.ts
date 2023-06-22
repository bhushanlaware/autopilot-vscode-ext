import { debounce } from "lodash";
import * as vscode from "vscode";
import { getCodeCompletions, getCodeReplCompletions } from "./api";
import { AUTOCOMPLETION_DEBOUNCE_TIMER, MAX_PREVIOUS_LINE_FOR_PROMPT } from "./constant";

export class AutoCompleteProvider implements vscode.Disposable {
  disposables: vscode.Disposable[] = [];
  timeout: NodeJS.Timeout | null = null;
  statusBarItem: vscode.StatusBarItem;
  cache: { [key: string]: string[] } = {};
  suggestionTimer: NodeJS.Timeout | null = null;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.showStatusBar("ideal");
    const disposableCompletionProvider = vscode.languages.registerInlineCompletionItemProvider("*", {
      provideInlineCompletionItems: async (document, position, context, cancellationToken) => {
        console.log("invoked");
        const promptSelection = new vscode.Range(
          Math.max(0, position.line - MAX_PREVIOUS_LINE_FOR_PROMPT),
          0,
          Math.max(0, position.line - 1),
          1000
        );
        const previousCodeBlock: string = document.getText(promptSelection);
        const isCurrentLineEmpty = document.lineAt(position.line).text.trim().length === 0;

        const currentLineSelectionTillCursor = new vscode.Range(position.line, 0, position.line, position.character);
        const currentLineContentTillCursor = document.getText(currentLineSelectionTillCursor);
        const currentLineSelectionAfterCursor = new vscode.Range(position.line, position.character, position.line, 1000);
        const currentLineContentAfterCursor = document.getText(currentLineSelectionAfterCursor);
        const isLastLine = position.line === document.lineCount - 1;
        const nextLineContent = isLastLine ? "" : document.lineAt(position.line + 1).text;

        const prompt = `${previousCodeBlock}\n${currentLineContentTillCursor}` || `// ${document.fileName}`;
        const stop = isCurrentLineEmpty ? (nextLineContent ? `\n${nextLineContent}` : "\n\n") : currentLineContentAfterCursor || "\n";

        console.log({ prompt, stop });

        this.showStatusBar("thinking");
        cancellationToken.onCancellationRequested(() => {
          console.log("cancelled");
          this.showStatusBar("ideal");
        });

        const suggestions = this.cache[prompt] || (await this.getDebouncedCodeCompletion(prompt, stop, cancellationToken));

        this.cache[prompt] = suggestions;

        this.showStatusBar("ideal");

        return suggestions.map((suggestion) => {
          const endPosition = new vscode.Position(position.line, position.character + suggestion.length);
          return new vscode.InlineCompletionItem(suggestion, new vscode.Range(position, endPosition));
        });
      },
    });

    this.disposables.push(disposableCompletionProvider);
  }

  private getDebouncedCodeCompletion(prompt: string, stop: string, cancellationToken: vscode.CancellationToken): Promise<string[]> {
    return new Promise((resolve, reject) => {
      if (this.suggestionTimer) {
        clearTimeout(this.suggestionTimer);
      }
      this.suggestionTimer = setTimeout(() => {
        getCodeReplCompletions(prompt, stop, cancellationToken).then(resolve, reject);
      }, AUTOCOMPLETION_DEBOUNCE_TIMER);
    });
  }

  private showStatusBar(state: "thinking" | "ideal") {
    switch (state) {
      case "ideal":
        this.statusBarItem.text = "$(hubot)";
        this.statusBarItem.tooltip = "Autopilot";
        break;
      case "thinking":
        this.statusBarItem.text = "$(sync~spin)";
        this.statusBarItem.tooltip = "Loading...";
        break;
      default:
        break;
    }
    this.statusBarItem.show();
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
