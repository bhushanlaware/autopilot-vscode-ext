import { createEmbedding } from "./api";
import * as vscode from "vscode";
import { Files, IEmbedding } from "./types";
import { debounce } from "lodash";
import { readFiles, cosineSimilarity, readFileInChunks, getFiles } from "./utils";
import { CHUNK_SIZE, EMBEDDING_DEBOUNCE_TIMER, TOP_INDEX } from "./constant";

export class IndexingProvider implements vscode.Disposable {
  disposables: vscode.Disposable[] = [];
  pendingFileChangesToBeIndexed: Files = {};

  constructor(private readonly context: vscode.ExtensionContext) {
    const debouncedUpdateIndex = debounce(this.updateIndexing.bind(this), EMBEDDING_DEBOUNCE_TIMER);
    const fileChangeListener = vscode.workspace.onDidChangeTextDocument(async (changes) => {
      for (const change of changes.contentChanges) {
        const fileName = changes.document.fileName;
        const fileContent = changes.document.getText();
        this.pendingFileChangesToBeIndexed[fileName] = fileContent;
      }
      debouncedUpdateIndex();
    });

    const getTopRelativeFileNamesCommands = vscode.commands.registerCommand("autopilot.getContext", this.getContext.bind(this));

    this.createIndexing();
    this.disposables.push(fileChangeListener, getTopRelativeFileNamesCommands);
  }

  get isEnabled(): boolean {
    return vscode.workspace.getConfiguration("autopilot").get("enableFileIndexing") as boolean;
  }

  private updateIndexing() {
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
    statusBar.text = "$(search) indexing";
    statusBar.tooltip = "Autopilot AI updating indexing";
    statusBar.show();
    this.disposables.push(statusBar);
    const files = this.pendingFileChangesToBeIndexed;
    this.createEmbeddings(files, true).then(() => {
      statusBar.hide();
      statusBar.dispose();
      this.pendingFileChangesToBeIndexed = {};
    });
  }

  private createIndexing() {
    const isFileIndexingEnabled = vscode.workspace.getConfiguration("autopilot").get("enableFileIndexing");
    if (!isFileIndexingEnabled) {
      return;
    }
    console.log("started indexing");
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
    statusBar.text = "$(search) indexing";
    statusBar.tooltip = "Autopilot Indexing files";
    statusBar.show();
    this.disposables.push(statusBar);

    readFiles(this.context.extensionUri.fsPath).then((files) => {
      console.log(files);
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

  private async createEmbeddings(files: Files, isUpdate = false) {
    if (!this.isEnabled) {
      return;
    }
    let embeddings = this.getEmbeddings();
    await Promise.all(
      Object.entries(files).map(async ([filename, content]) => {
        if (isUpdate || !embeddings[filename]) {
          const chunks = readFileInChunks(content, CHUNK_SIZE);
          await Promise.all(
            chunks.map(async (chunk, index) => {
              const embedding = await createEmbedding(filename, chunk);
              embeddings[`${filename}$${index}`] = embedding;
            })
          );
        }
      })
    );

    await this.setEmbeddings(embeddings);
    return embeddings;
  }

  private async getTopRelativeFileNames(question: string): Promise<string[]> {
    const embeddings = this.getEmbeddings();

    if (!embeddings) {
      console.error("No embeddings found for the given session and controlId");
      return [];
    }

    const questionEmbedding = await createEmbedding(question);
    const similarities: { [filename: string]: number } = {};

    console.time("Calculating similarities");
    Object.entries(embeddings).forEach(([filename, embedding]) => {
      similarities[filename] = cosineSimilarity(questionEmbedding, embedding);
    });
    console.timeEnd("Calculating similarities");

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

  private async getContext(query: string): Promise<Files> {
    if (!this.isEnabled) {
      return {};
    }
    const relativeFileNamesWithChunks = await this.getTopRelativeFileNames(query);

    const fileNames = relativeFileNamesWithChunks.map((name) => name.split("$")[0]);
    const relativeFiles = await getFiles(fileNames);

    const requiredContext: Files = {};
    relativeFileNamesWithChunks.forEach((name) => {
      const [fileName, chunkNumberStr] = name.split("$");
      const chunkNumber = parseInt(chunkNumberStr);
      const fileContent = relativeFiles[fileName];

      if (fileContent) {
        const start = chunkNumber * CHUNK_SIZE;
        const end = start + CHUNK_SIZE;
        requiredContext[fileName] = fileContent.slice(start, end);
      }
    });

    return requiredContext;
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
