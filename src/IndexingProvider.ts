import { createEmbedding } from "./api";
import * as vscode from "vscode";
//@ts-expect-error
import similarity from "compute-cosine-similarity";
import { Files, IEmbedding } from "./types";
import { debounce } from "lodash";
import { readFiles } from "./utils";
import { TOP_INDEX } from "./constant";

export class IndexingProvider implements vscode.Disposable {
  disposables: vscode.Disposable[] = [];
  pendingFileChangesToBeIndexed: Files = {};

  constructor(private readonly context: vscode.ExtensionContext) {
    const debouncedUpdateIndex = debounce(this.updateIndexing.bind(this), 1000);
    const fileChangeListener = vscode.workspace.onDidChangeTextDocument(async (changes) => {
      for (const change of changes.contentChanges) {
        const fileName = changes.document.fileName;
        const fileContent = changes.document.getText();
        this.pendingFileChangesToBeIndexed[fileName] = fileContent;
      }
      debouncedUpdateIndex();
    });

    const getTopRelativeFileNamesCommands = vscode.commands.registerCommand(
      "autopilot.getTopRelativeFileNames",
      this.getTopRelativeFileNames.bind(this)
    );

    this.createIndexing();
    this.disposables.push(fileChangeListener, getTopRelativeFileNamesCommands);
  }

  private updateIndexing() {
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
    statusBar.text = "$(search) indexing";
    statusBar.tooltip = "Autopilot AI updating indexing";
    statusBar.show();
    this.disposables.push(statusBar);
    const files = this.pendingFileChangesToBeIndexed;
    this.updateEmbeddings(files).then(() => {
      statusBar.hide();
      this.pendingFileChangesToBeIndexed = {};
    });
  }

  private createIndexing() {
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
    statusBar.text = "$(search) indexing";
    statusBar.tooltip = "Autopilot Indexing files";
    statusBar.show();
    this.disposables.push(statusBar);

    readFiles(this.context.extensionUri.fsPath).then((files) => {
      this.createEmbeddings(files)
        .then((index) => {
          statusBar.hide();
        })
        .catch((err) => {
          console.error(err);
          statusBar.hide();
        });
    });
  }

  private getEmbeddings(): IEmbedding {
    return this.context.workspaceState.get<IEmbedding>("embeddings") ?? {};
  }

  private async setEmbeddings(embeddings: IEmbedding) {
    await this.context.workspaceState.update("embeddings", embeddings);
  }

  private async createEmbeddings(files: Files) {
    let embeddings = this.getEmbeddings();
    if (embeddings) {
      return embeddings;
    }

    embeddings = {};
    await Promise.all(
      Object.entries(files).map(async ([filename, content]) => {
        const embedding = await createEmbedding(filename, content);
        embeddings[filename] = embedding;
      })
    );

    await this.setEmbeddings(embeddings);
    return embeddings;
  }

  private async updateEmbeddings(files: Files) {
    let embeddings = this.getEmbeddings();

    if (!embeddings) {
      console.error("No embeddings found");
      return;
    }

    await Promise.all(
      Object.entries(files).map(async ([filename, newText]) => {
        const newEmbedding = await createEmbedding(filename, newText);
        embeddings[filename] = newEmbedding;
      })
    );

    await this.setEmbeddings(embeddings);
  }

  private async getTopRelativeFileNames(question: string): Promise<string[]> {
    const embeddings = this.getEmbeddings();

    if (!embeddings) {
      console.error("No embeddings found for the given session and controlId");
      return [];
    }

    const questionEmbedding = await createEmbedding(question);
    const similarities: { [filename: string]: number } = {};

    Object.entries(embeddings).forEach(([filename, embedding]) => {
      similarities[filename] = similarity(questionEmbedding, embedding);
    });

    const sortedFilenames = Object.entries(similarities)
      .sort(([, a], [, b]) => b - a)
      .map(([filename]) => filename)
      .slice(0, TOP_INDEX);

    const topRelativeFileNames: string[] = [];
    sortedFilenames.forEach((filename) => {
      topRelativeFileNames.push(filename);
    });
    return topRelativeFileNames;
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
