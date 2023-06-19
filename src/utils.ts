import { createParser } from "eventsource-parser";
import { Configuration, OpenAIApi } from "openai";
import * as vscode from "vscode";
import {
  CHAT_DEFAULT_CONFIGURATION,
  COMPLETION_DEFAULT_CONFIGURATION,
  CONFIGURATION_KEYS,
  MAX_ALLOWED_LINE,
  SELECTED_CODE_MAX_LENGTH,
} from "./constant";
import { ChatConfig, CompletionConfig, Files } from "./types";

export async function readFiles(filePath: any) {
  const files: Files = {};
  const fs = vscode.workspace.fs;
  // if the provider does not support readFile then we cannot do anything
  if (!fs.readFile) {
    return files;
  }

  const fileUrls = await vscode.workspace.findFiles("**/*.{js,jsx,ts,tsx,py,rb,java,cpp,c,h,html,css,scss}", "**/node_modules/**");

  for (const fileUrl of fileUrls) {
    const fileContent = await fs.readFile(fileUrl);
    files[fileUrl.path] = new TextDecoder().decode(fileContent);
  }
  return files;
}

export const modelMaxTokens = {
  //GPT 4
  "gpt-4": 8000,
  // GPT 3.5
  "gpt-3.5-turbo": 4000,
  "text-davinci-003": 4000,
  "text-davinci-002": 4000,
  //GPT 3
  davinci: 2000,
  curie: 2000,
  babbage: 2000,
  ada: 2000,
};

export const openaiBaseURL = "https://api.openai.com";

// export function getChatSystemMessageFromFiles(files: Files) {
// 	const instructionMessage = "INSTRUCTION:You are a helpful assistant, who understand user code and help them to write code, explain code, and debug code. Try to give concise and helpful instructions. Use minimal explanation and give actual code which can help. Don't do any syntax error while giving the code";

// 	const codeMessage = "CODE:\n" + Object.keys(files).reduce((acc, path) => {
// 		return acc + [path, '```', files[path].split('\n').slice(0, 56).join('\n'), '```'].join('\n');
// 	}, '');
// 	return [instructionMessage, codeMessage].join('\n\n');
// }

// export function getCodexSystemMessage() {
// 	return `You are the Codex Open AI model, which returns block of code as per user-provided code in chat. Obey indentations and don't provide text instructions as your chat output will be used directly in the code file without any cleaning or refactoring. Note: If completion is done on the same line don't repeat earlier code.`
// }

export function getWorkspaceBasePath() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders) {
    return workspaceFolders[0].uri.fsPath;
  }
  return "";
}

export function getFilesPromptMessage(files: Files) {
  const codeMessage =
    "CODE:\n" +
    Object.keys(files).reduce((acc, path) => {
      return acc + [path, "```", files[path].split("\n").slice(0, MAX_ALLOWED_LINE).join("\n"), "```"].join("\n");
    }, "");
  return codeMessage;
}

export function getSelectedCode() {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const selection = editor.selection;
    const text = editor.document.getText(selection);
    return text;
  }
  return "";
}

export function getOpenedFiles() {
  const openedFiles: Files = {};
  vscode.workspace.textDocuments.forEach((doc) => {
    const path = doc.uri.path;
    const content = doc.getText();
    openedFiles[path] = content;
  });
  return openedFiles;
}

export function getInstruction(files: Files): string {
  const instructions = [];
  instructions.push("INSTRUCTION:You are a helpful assistant.");

  // fileContext
  instructions.push("Please refer the relative files in context to user query.");
  instructions.push(getFilesPromptMessage(files));

  // Selected code
  const selectedCode = getSelectedCode().slice(0, SELECTED_CODE_MAX_LENGTH);
  if (selectedCode) {
    instructions.push("Selected code:\n```" + selectedCode + "```");
  }

  // Current open filename
  const currentOpenFileName = vscode.window.activeTextEditor?.document.fileName;
  if (currentOpenFileName) {
    instructions.push(`Current open fileName: ${currentOpenFileName}`);
  }

  return instructions.join("\n\n");
}

export async function fetchSSE(url: string, options: any, fetch2 = fetch) {
  const { onMessage, ...fetchOptions } = options;
  const res = await fetch2(url, fetchOptions);
  if (!res.ok) {
    let reason;
    try {
      reason = await res.text();
    } catch (err) {
      reason = res.statusText;
    }
    throw new Error("Failed");
  }
  const parser = createParser((event) => {
    if (event.type === "event") {
      onMessage(event.data);
    }
  });

  //@ts-ignore
  if (!res.body.getReader) {
    const body = res.body;
    //@ts-ignore
    if (!body.on || !body.read) {
      throw new Error('unsupported "fetch" implementation');
    }
    //@ts-ignore
    body.on("readable", () => {
      let chunk;
      //@ts-ignore
      while (null !== (chunk = body.read())) {
        parser.feed(chunk.toString());
      }
    });
  } else {
    //@ts-ignore
    for await (const chunk of streamAsyncIterable(res.body)) {
      const str = new TextDecoder().decode(chunk);
      parser.feed(str);
    }
  }
}

async function* streamAsyncIterable(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

export function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function checkIfFileExists(fileUri: vscode.Uri) {
  return vscode.workspace.fs.stat(fileUri).then(
    () => true,
    () => false
  );
}

export function createFileIfNotExists(fileUri: vscode.Uri, fileContent = "") {
  return checkIfFileExists(fileUri).then((exists) => {
    if (!exists) {
      return vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(fileContent));
    }
  });
}

export function getVscodeControlInstructions() {
  return (
    "Here are the instructions for all the available commands:\n\n**Create a file:**\n\n```\n{\n\tinstruction: 'createFile',\n\targs: [fileName, fileContent]\n}\n```\n\nWhere `fileName` is a string representing the file path, and `fileContent` is a string representing the initial content of the file.\n\n**Open a file:**\n\n```\n{\n\tinstruction: 'openFile',\n\targs: [filePath]\n}\n```\n\nWhere `filePath` is a string representing the path of the file to be opened.\n\n**Delete a file:**\n\n```\n{\n\tinstruction: 'deleteFile',\n\targs: [filePath]\n}\n```\n\nWhere `filePath` is a string representing the path of the file to be deleted.\n\n**Insert text:**\n\n```\n{\n\tinstruction: 'insertText',\n\targs: [filePath, line, col, text]\n}\n```\n\nWhere `filePath` is a string representing the path of the file to be modified, `line` and `col` are numbers representing the position of the insertion, and `text` is the string to be inserted.\n\n**Replace text:**\n\n```\n{\n\tinstruction: 'replaceText',\n\targs: [filePath, line, col, text]\n}\n```\n\nWhere `filePath` is a string" +
    "representing the path of the file to be modified, `line` and `col` are numbers representing the position of the replacement, and `text` is the string to replace the existing text.\n\n**Delete text:**\n\n```\n{\n\tinstruction: 'deleteText',\n\targs: [filePath, line, col, text]\n}\n```\n\nWhere `filePath` is a string representing the path of the file to be modified, `line` and `col` are numbers representing the starting position of the deletion, and `text` is the string to be deleted."
  );
}

export function getCompletionConfig(): CompletionConfig {
  const config = vscode.workspace.getConfiguration(CONFIGURATION_KEYS.name);
  const completionKeys = CONFIGURATION_KEYS.autopilot.completion;
  const defaults = COMPLETION_DEFAULT_CONFIGURATION;

  return {
    model: config.get(completionKeys.model) ?? defaults.model,
    temperature: config.get(completionKeys.temperature) ?? defaults.temperature,
    numberOfCompletions: config.get(completionKeys.numberOfCompletions) ?? defaults.numberOfCompletions,
    maxTokens: config.get(completionKeys.maxTokens) ?? defaults.maxTokens,
  };
}

export function getChatConfig(): ChatConfig {
  const config = vscode.workspace.getConfiguration(CONFIGURATION_KEYS.name);
  const chatKeys = CONFIGURATION_KEYS.autopilot.chat;
  const defaults = CHAT_DEFAULT_CONFIGURATION;

  return {
    model: config.get(chatKeys.model) ?? defaults.model,
    temperature: config.get(chatKeys.temperature) ?? defaults.temperature,
    context: config.get(chatKeys.context) ?? defaults.context,
  };
}

export function getOpenAIKey(): string {
  const config = vscode.workspace.getConfiguration(CONFIGURATION_KEYS.name);
  const openAiKeys = CONFIGURATION_KEYS.autopilot.openaiAPIKey;
  return config.get(openAiKeys) ?? "";
}

export function getOpenApi() {
  const apiKey = getOpenAIKey();
  const configuration = new Configuration({
    apiKey,
  });
  // As we are using openai in frontend Uesr-Agent needs not to be set
  delete configuration.baseOptions.headers["User-Agent"];
  return new OpenAIApi(configuration);
}

export async function getFiles(filePaths: string[]): Promise<Files> {
  const files: Files = {};
  await Promise.all(
    filePaths.map(async (filePath) => {
      try {
        const url = vscode.Uri.file(filePath);
        const file = await vscode.workspace.openTextDocument(url);
        files[file.fileName] = file.getText();
      } catch (error) {
        console.error(error);
      }
    })
  );
  return files;
}
export function cosineSimilarity(arr1: number[], arr2: number[]) {
  var dotProduct = 0;
  var mA = 0;
  var mB = 0;

  for (var i = 0; i < arr1.length; i++) {
    dotProduct += arr1[i] * arr2[i];
    mA += arr1[i] * arr1[i];
    mB += arr2[i] * arr2[i];
  }

  mA = Math.sqrt(mA);
  mB = Math.sqrt(mB);
  var similarity = dotProduct / (mA * mB);

  return similarity;
}

export function readFileInChunks(fileContent: string, chunkSize = 2000) {
  const chunks = [];
  for (let i = 0; i < fileContent.length; i += chunkSize) {
    chunks.push(fileContent.slice(i, i + chunkSize));
  }
  return chunks;
export function createFile({ fileName, fileContent }: { fileName: string; fileContent: string }) {
  const fileUri = vscode.Uri.parse(fileName);
  createFileIfNotExists(fileUri, fileContent);
}

export function getCurrentWorkSpaceFolderPath(): string {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    throw new Error("No workspace folder found");
  }
  return workspaceFolders[0].uri.fsPath;
}

export function insertText({ filepath, line, col, text }: { filepath: string; line: number; col: number; text: string }) {
  const document = vscode.workspace.textDocuments.find((doc) => doc.uri.fsPath.endsWith(filepath));

  const fileUri = document?.uri;
  if (fileUri) {
    vscode.workspace.openTextDocument(fileUri).then((document) => {
      const edit = new vscode.WorkspaceEdit();
      edit.insert(fileUri, new vscode.Position(line, col), text);
      return vscode.workspace.applyEdit(edit);
    });
  }
}

export function openFile({ filepath }: { filepath: string }) {
  const fileUri = vscode.Uri.parse(filepath);
  vscode.workspace.openTextDocument(fileUri).then((document) => {
    vscode.window.showTextDocument(document);
  });
}

export function deleteFile({ filepath }: { filepath: string }) {
  const fileUri = vscode.Uri.parse(filepath);
  vscode.workspace.openTextDocument(fileUri).then((document) => {
    vscode.workspace.fs.delete(fileUri);
  });
}

export function replaceText({ filepath, line, col, text }: { filepath: string; line: number; col: number; text: string }) {
  const fileUri = vscode.Uri.parse(filepath);
  vscode.workspace.openTextDocument(fileUri).then((document) => {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(fileUri, new vscode.Range(line, col, line, col + text.length), text);
    return vscode.workspace.applyEdit(edit);
  });
}

export function deleteText({ filepath, line, col, text }: { filepath: string; line: number; col: number; text: string }) {
  const fileUri = vscode.Uri.parse(filepath);
  vscode.workspace.openTextDocument(fileUri).then((document) => {
    const edit = new vscode.WorkspaceEdit();
    edit.delete(fileUri, new vscode.Range(line, col, line, col + text.length));
    return vscode.workspace.applyEdit(edit);
  });
}

export function runTerminalCommand({
  name,
  path,
  command,
  env,
}: {
  name: string;
  path: string;
  command: string;
  env?: { [key: string]: string };
}) {
  const terminal = vscode.window.createTerminal({
    name: name,
    cwd: vscode.Uri.parse(path),
    env,
  });
  terminal.show();
  terminal.sendText(command);
}

export function runVscodeCommand({ command, ...args }: { command: string }) {
  vscode.commands.executeCommand(command, args);
}

// export function getVscodeControlFunctionsDescriptions() {
//   return [
//     {
//       name: "runTerminal",
//       description: "Create a new terminal and run a command",
//       parameters: {
//         type: "object",
//         properties: {
//           name: {
//             type: "string",
//             description: "The name of the terminal",
//           },
//           path: {
//             type: "string",
//             description: "The path where the command should be run",
//           },
//           command: {
//             type: "string",
//             description: "The command to be run in the terminal",
//           },
//           env: {
//             type: "object",
//             properties: {
//               "${key}": {
//                 type: "string",
//                 description: "The environment variable to be set",
//               },
//             },
//           },
//         },
//         required: ["name", "path", "command"],
//       },
//     },
//     {
//       name: "runVscodeCommand",
//       description: "Execute a Visual Studio Code command to control editor and workbench",
//       parameters: {
//         type: "object",
//         properties: {
//           command: {
//             type: "string",
//             description: "The command to be executed",
//           },
//           args: {
//             type: "object",
//             properties: {
//               "${key}": {
//                 type: "string",
//                 description: "The argument value",
//               },
//             },
//           },
//         },
//         required: ["command"],
//       },
//     },
//   ];
// }


export function getVscodeControlFunctionsDescriptions() {
  return [
    {
      name: "createFile",
      description: "Create a file with the given file name and file content",
      parameters: {
        type: "object",
        properties: {
          fileName: {
            type: "string",
            description: "The name of the file to create",
          },
          fileContent: {
            type: "string",
            description: "The content to be written in the file",
          },
        },
        required: ["fileName", "fileContent"],
      },
    },
    {
      name: "insertText",
      description: "Insert text at a specific line and column in a file",
      parameters: {
        type: "object",
        properties: {
          filepath: {
            type: "string",
            description: "The path of the file where the text will be inserted",
          },
          line: {
            type: "number",
            description: "The line number where the text will be inserted",
          },
          col: {
            type: "number",
            description: "The column number where the text will be inserted",
          },
          text: {
            type: "string",
            description: "The text to be inserted",
          },
        },
        required: ["filepath", "line", "col", "text"],
      },
    },
    {
      name: "openFile",
      description: "Open a file in the Visual Studio Code editor",
      parameters: {
        type: "object",
        properties: {
          filepath: {
            type: "string",
            description: "The path of the file to open",
          },
        },
        required: ["filepath"],
      },
    },
    {
      name: "deleteFile",
      description: "Delete a file from the file system",
      parameters: {
        type: "object",
        properties: {
          filepath: {
            type: "string",
            description: "The path of the file to delete",
          },
        },
        required: ["filepath"],
      },
    },
    {
      name: "replaceText",
      description: "Replace text at a specific line and column in a file",
      parameters: {
        type: "object",
        properties: {
          filepath: {
            type: "string",
            description: "The path of the file where the text will be replaced",
          },
          line: {
            type: "number",
            description: "The line number where the text will be replaced",
          },
          col: {
            type: "number",
            description: "The column number where the text will be replaced",
          },
          text: {
            type: "string",
            description: "The new text to be inserted",
          },
        },
        required: ["filepath", "line", "col", "text"],
      },
    },
    {
      name: "deleteText",
      description: "Delete text at a specific line and column in a file",
      parameters: {
        type: "object",
        properties: {
          filepath: {
            type: "string",
            description: "The path of the file where the text will be deleted",
          },
          line: {
            type: "number",
            description: "The line number where the text will be deleted",
          },
          col: {
            type: "number",
            description: "The column number where the text will be deleted",
          },
          text: {
            type: "string",
            description: "The text to be deleted",
          },
        },
        required: ["filepath", "line", "col", "text"],
      },
    },
    // {
    //   name: "runCommand",
    //   description: "Run a command in the integrated terminal",
    //   parameters: {
    //     type: "object",
    //     properties: {
    //       name: {
    //         type: "string",
    //         description: "The name of the terminal",
    //       },
    //       path: {
    //         type: "string",
    //         description: "The working directory of the terminal",
    //       },
    //       command: {
    //         type: "string",
    //         description: "The command to be executed",
    //       },
    //       env: {
    //         type: "object",
    //         description: "Optional. Environment variables to be set for the terminal process",
    //         additionalProperties: {
    //           type: "string",
    //         },
    //       },
    //     },
    //     required: ["name", "path", "command"],
    //   },
    // },
  ];
}

export function getVscodeControlFunctionDecelerations() {
  return {
    createFile,
    insertText,
    openFile,
    deleteFile,
    replaceText,
    deleteText,
    runCommand: runTerminalCommand,
  };
}