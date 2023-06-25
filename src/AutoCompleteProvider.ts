import { debounce } from "lodash";
import * as vscode from "vscode";
import { getCodeCompletions } from "./api";
import { AUTOCOMPLETION_DEBOUNCE_TIMER, AUTOSUGGESTION_TRIGGER_DEBOUNCE_TIME, MAX_PREVIOUS_LINE_FOR_PROMPT } from "./constant";

export class AutoCompleteProvider implements vscode.Disposable {
  disposables: vscode.Disposable[] = [];
  timeout: NodeJS.Timeout | null = null;
  statusBarItem: vscode.StatusBarItem;
  cache: { [key: string]: string[] } = {};
  suggestionTimer: NodeJS.Timeout | null = null;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.command = "autopilot.completion.toggle";

    this.showStatusBar("ideal");
    const disposableCompletionProvider = vscode.languages.registerInlineCompletionItemProvider("*", {
      provideInlineCompletionItems: async (document, position, context, cancellationToken) => {
        if (!this.isEnabled) {
          return [];
        }

        let promptCode = [];
        // Add file name at top

        //  Add previous lines
        if (position.line > 0) {
          const startLine = Math.max(0, position.line - MAX_PREVIOUS_LINE_FOR_PROMPT);
          const endLine = position.line - 1;
          const promptSelection = new vscode.Range(startLine, 0, endLine, 1000);
          promptCode.push(document.getText(promptSelection));
        } else {
          promptCode.push(`//FileName:: ${document.fileName}`);
        }

        // Add current line till cursor position
        const currentLineSelectionTillCursor = new vscode.Range(position.line, 0, position.line, position.character);
        const currentLineContentTillCursor = document.getText(currentLineSelectionTillCursor);
        promptCode.push(currentLineContentTillCursor);

        const prompt = promptCode.join("\n");
        const isCurrentLineEmpty = currentLineContentTillCursor.trim().length === 0;

        // Find stop
        const currentLineSelectionAfterCursor = new vscode.Range(position.line, position.character, position.line, 1000);
        const currentLineContentAfterCursor = document.getText(currentLineSelectionAfterCursor);
        let stop = currentLineContentAfterCursor;

        if (isCurrentLineEmpty && currentLineContentAfterCursor.trim().length === 0 && position.line < document.lineCount - 1) {
          const nextLineSelection = new vscode.Range(position.line + 1, 0, position.line + 1, 1000);
          stop = `\n${document.getText(nextLineSelection)}`;
        }

        if (!stop) {
          stop = isCurrentLineEmpty ? "\n\n" : "\n";
        }
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

    const disposableEditorSelection = vscode.window.onDidChangeTextEditorSelection(this.debouncedHandleSelectionChange.bind(this));

    const completionToggleCommand = vscode.commands.registerCommand("autopilot.completion.toggle", this.toggleAutocompletion.bind(this));
    this.disposables.push(disposableCompletionProvider, disposableEditorSelection, completionToggleCommand);
  }
  // Keeping small debounce here as we already have debounce after we trigger inline suggestion
  private debouncedHandleSelectionChange = debounce(this.handleSelectionChange, AUTOSUGGESTION_TRIGGER_DEBOUNCE_TIME);

  private handleSelectionChange(event: vscode.TextEditorSelectionChangeEvent) {
    if (event.kind === vscode.TextEditorSelectionChangeKind.Mouse) {
      vscode.commands.executeCommand("editor.action.inlineSuggest.trigger");
    }
  }

  private toggleAutocompletion() {
    const config = vscode.workspace.getConfiguration("autopilot");
    const configKey = "completion.enabled";

    config.update(configKey, !this.isEnabled, true).then(() => {
      this.showStatusBar("ideal");
    });
  }

  private get isEnabled() {
    const config = vscode.workspace.getConfiguration("autopilot");
    const configKey = "completion.enabled";
    return config.get(configKey);
  }

  private getDebouncedCodeCompletion(prompt: string, stop: string, cancellationToken: vscode.CancellationToken): Promise<string[]> {
    return new Promise((resolve, reject) => {
      if (this.suggestionTimer) {
        clearTimeout(this.suggestionTimer);
      }
      this.suggestionTimer = setTimeout(() => {
        getCodeCompletions(prompt, stop, cancellationToken).then(resolve, reject);
      }, AUTOCOMPLETION_DEBOUNCE_TIMER);
    });
  }

  private showStatusBar(state: "thinking" | "ideal") {
    if (this.isEnabled) {
      this.statusBarItem.color = "";
      this.statusBarItem.tooltip = "Disable Autopilot Autocompletion";
    } else {
      this.statusBarItem.color = "#FF0000";
      this.statusBarItem.tooltip = "Enable Autopilot Autocompletion";
    }

    switch (state) {
      case "ideal":
        this.statusBarItem.text = "$(hubot)";
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
