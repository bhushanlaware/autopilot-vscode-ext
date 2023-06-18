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

        // show loading status barStyle = 'light-content'
        // this.statusBarItem.show();
        // this.statusBarItem.text = '$(sync~spin)';
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
          return new vscode.InlineCompletionItem(suggestion, new vscode.Range(position, endPosition));
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
