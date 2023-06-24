import { createEmbedding } from "./api";
import * as vscode from "vscode";
import { Files, IEmbedding } from "./types";
import { debounce } from "lodash";
import { readFiles, cosineSimilarity, readFileInChunks, getFiles, getOpenedFiles } from "./utils";
import { CHAT_CONTEXT, CHUNK_SIZE, EMBEDDING_DEBOUNCE_TIMER, TOP_INDEX } from "./constant";
import { ChatContext } from "./types";

export class IndexingProvider implements vscode.Disposable {
  disposables: vscode.Disposable[] = [];
  pendingFileChangesToBeIndexed: Files = {};
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
  numberOfFilesLeftToIndex: number = 0;

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

    //on file open
    vscode.workspace.onDidOpenTextDocument(async (document) => {
      const fileName = document.fileName;
      const fileContent = document.getText();
      await this.createEmbeddings({ [fileName]: fileContent });
    });

    const getTopRelativeFileNamesCommands = vscode.commands.registerCommand("autopilot.getContext", this.getContext.bind(this));

    // start indexing
    this.createIndexing();

    // status bar
    this.statusBar.text = "$(search) indexing";
    this.statusBar.tooltip = "Autopilot Indexing files";
    this.disposables.push(fileChangeListener, getTopRelativeFileNamesCommands, this.statusBar);
  }

  get isEnabled(): boolean {
    return vscode.workspace.getConfiguration("autopilot").get("enableFileIndexing") as boolean;
  }

  private updateIndexing() {
    this.statusBar.show();

    const files = this.pendingFileChangesToBeIndexed;
    this.createEmbeddings(files, true).then(() => {
      this.statusBar.hide();
      this.pendingFileChangesToBeIndexed = {};
    });
  }

  private async createIndexing() {
    const isFileIndexingEnabled = vscode.workspace.getConfiguration("autopilot").get("enableFileIndexing");
    const chatContext = vscode.workspace.getConfiguration("autopilot").get<ChatContext>("chatContext");
    if (!isFileIndexingEnabled || !chatContext) {
      return;
    }

    let files: Files = {};
    switch (chatContext) {
      case CHAT_CONTEXT.allFiles: {
        files = await readFiles(this.context.extensionUri.fsPath);
        break;
      }
      case CHAT_CONTEXT.openedFiles: {
        files = getOpenedFiles();
        break;
      }
      case CHAT_CONTEXT.currentFile: {
        const openedFile = vscode.window.activeTextEditor?.document;
        if (openedFile) {
          files[openedFile.fileName] = openedFile?.getText();
        }
        break;
      }
      case CHAT_CONTEXT.None:
      default:
        break;
    }
    await this.createEmbeddings(files);
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
    this.statusBar.show();
    let embeddings = this.getEmbeddings();
    await Promise.all(
      Object.entries(files).map(async ([filename, content]) => {
        const chunks = readFileInChunks(content, CHUNK_SIZE);
        await Promise.all(
          chunks.map(async (chunk, index) => {
            const embeddingKey = `${filename}$${index}`;

            if (isUpdate || !embeddings[embeddingKey]) {
              const embedding = await createEmbedding(filename, chunk);
              embeddings[embeddingKey] = embedding;
            }
          })
        );
      })
    );

    await this.setEmbeddings(embeddings);
    this.statusBar.hide();
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
    console.log("Query" + query);
    if (!this.isEnabled || !query) {
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
