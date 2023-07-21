import * as vscode from "vscode";
import { writeCodeForPrompt } from "./api";
import { AUTOWRITE_CONTEXT_WINDOW } from "./constant";

export class AutoCodeProvider implements vscode.Disposable {
  disposables: vscode.Disposable[] = [];
  chunks: string[] = [];
  isApplyingCode = false;

  constructor(private readonly _context: vscode.ExtensionContext) {
    this.disposables.push(
      vscode.commands.registerCommand("autopilot.writeCode", () => {
        vscode.window
          .showInputBox({
            title: "What you want to code?",
            placeHolder: "Create the todo app in react.",
          })
          .then((value) => {
            if (value) {
              this.writeCodeForPrompt(value);
            }
          });
      })
    );
  }

  async writeCodeForPrompt(prompt: string) {
    this.chunks = [];
    let activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      let selection = activeEditor.selection;
      let selectedText = activeEditor.document.getText(selection);
      const position = selection.active;
      const startLine = Math.max(0, position.line - AUTOWRITE_CONTEXT_WINDOW);
      const endLine = Math.min(activeEditor.document.lineCount - 1, position.line + AUTOWRITE_CONTEXT_WINDOW);
      const promptSelection = new vscode.Range(startLine, 0, endLine, 1000);
      const windowCode = activeEditor.document.getText(promptSelection);

      // Remove selected code
      activeEditor.edit((editBuilder) => {
        editBuilder.delete(selection);
      });

      const fileName = activeEditor.document.fileName;
      // Asking AI

      writeCodeForPrompt(prompt, windowCode, selectedText, fileName, (code) => {
        this.chunks.push(code);
        this.applyCode();
      });
    }
  }

  async applyCode() {
    if (this.isApplyingCode) {
      return;
    }
    this.isApplyingCode = true;
    let activeEditor = vscode.window.activeTextEditor;

    while (this.chunks.length) {
      const code = this.chunks.join("");
      this.chunks = [];
      if (activeEditor) {
        let workspaceEdit = new vscode.WorkspaceEdit();
        // Assuming "codeChunks" is your array of code strings
        workspaceEdit.insert(activeEditor.document.uri, activeEditor.selection.start, code);
        await vscode.workspace.applyEdit(workspaceEdit);
      }
    }
    this.isApplyingCode = false;
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
