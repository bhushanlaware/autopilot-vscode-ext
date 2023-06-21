import { debounce } from "lodash";
import * as vscode from "vscode";
import { getCodeCompletions } from "./api";
import { MAX_PREVIOUS_LINE_FOR_PROMPT } from "./constant";

export class AutoCompleteProvider implements vscode.Disposable {
  disposables: vscode.Disposable[] = [];
  timeout: NodeJS.Timeout | null = null;
  statusBarItem: vscode.StatusBarItem;
  cache: { [key: string]: string[] } = {};

  constructor(private readonly context: vscode.ExtensionContext) {
    // Status bar item
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.showStatusBar("ideal");

    // Register completion provider
    const disposableCompletionProvider = vscode.languages.registerInlineCompletionItemProvider("*", {
      provideInlineCompletionItems: async (document, position, context, cancellationToken) => {
        let promptCode = [];
        // Add file name at top
        promptCode.push(`//FileName:: ${document.fileName}`);

        //  Add previous lines
        if (position.line > 0) {
          const startLine = Math.max(0, position.line - MAX_PREVIOUS_LINE_FOR_PROMPT);
          const endLine = position.line - 1;
          const promptSelection = new vscode.Range(startLine, 0, endLine, 1000);
          promptCode.push(document.getText(promptSelection));
        }

        // Add current line till cursor position
        const currentLineSelectionTillCursor = new vscode.Range(position.line, 0, position.line, position.character);
        const currentLineContentTillCursor = document.getText(currentLineSelectionTillCursor);
        promptCode.push(currentLineContentTillCursor);

        const prompt = promptCode.join("\n");

        // Find stop
        const currentLineSelectionAfterCursor = new vscode.Range(position.line, position.character, position.line, 1000);
        const currentLineContentAfterCursor = document.getText(currentLineSelectionAfterCursor);
        let stop = currentLineContentAfterCursor;

        if (currentLineContentAfterCursor.trim().length === 0 && position.line < document.lineCount - 1) {
          const nextLineSelection = new vscode.Range(position.line + 1, 0, position.line + 1, 1000);
          stop = `\n${document.getText(nextLineSelection)}`;
        }

        // If we don't find stop from content then lets set it ourself
        if (!stop) {
          const isCurrentLineEmpty = currentLineContentTillCursor.trim().length === 0;
          stop = !isCurrentLineEmpty ? "\n" : "\n\n";
        }

        this.showStatusBar("thinking");
        cancellationToken.onCancellationRequested(() => {
          console.log("cancelled");
          this.showStatusBar("ideal");
        });

        const suggestions = this.cache[prompt] || (await getCodeCompletions(prompt, stop, cancellationToken));

        this.cache[prompt] = suggestions;

        this.showStatusBar("ideal");

        return suggestions.map((suggestion) => {
          const endPosition = new vscode.Position(position.line, position.character + suggestion.length);
          return new vscode.InlineCompletionItem(suggestion, new vscode.Range(position, position));
        });
      },
    });

    const disposableEditorSelection = vscode.window.onDidChangeTextEditorSelection(this.debouncedHandleSelectionChange.bind(this));
    this.disposables.push(disposableCompletionProvider, disposableEditorSelection);
  }
  private debouncedHandleSelectionChange = debounce(this.handleSelectionChange, 1000);

  private handleSelectionChange(event: vscode.TextEditorSelectionChangeEvent) {
    if (event.kind === vscode.TextEditorSelectionChangeKind.Keyboard || event.kind === vscode.TextEditorSelectionChangeKind.Mouse) {
      console.log("should inkove");
      this.showSuggestions();
    }
  }

  private showSuggestions() {
    vscode.commands.executeCommand("editor.action.inlineSuggest.trigger");
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
