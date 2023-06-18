# Autopilot

## Overview

Autopilot is a Visual Studio Code extension that builds on top of the powerful GPT-3 and GPT-4 API to give you an edge in coding. With Autopilot, you can chat with an AI assistant, search for code snippets, and get AI code completion suggestions.

## Features

### AI Chat

Autopilot's AI chat feature you chat with an intelligent assistant powered by GPT-3/4. You can choose the GPT model to use, set the temperature for the model, and even choose the context for the chat (e.g., none, current file, opened files, all files). You can also choose to restrict the chat to exclude code snippets, if desired.

### Google Search

Google search feature allows you to search for any query right in your vscode editor.

### AI Code Completion

Autopilot's AI code completion feature allows you to get AI-generated code suggestions as you type. You can choose the GPT model to use, and set the number of code suggestions to display (up to 5).

## Configuration

Autopilot's configuration options can be accessed by going to File > Preferences > Settings and searching for "Autopilot". The following configuration options are available:

- `autopilot.chatModel` : Choose the GPT model to use for chat (default: gpt-3.5-turbo).
  - `gpt-4`: Most expensive, Slower, but best model.
  - `gpt-3.5-turbo`: Less costly, Faster, but not as good as GPT-4.
- `autopilot.chatContext` : Choose the context (Add user code with prompt) to give for the chat.

  - `None`: No context / extra code will be sent apart from selected code.
  - `Current File`: Current focused file in editor will be the part of prompt (Good for large projects. consumes less tokens)
  - `Opened Files`: Context is all files opened in the editor. (Good for medium projects consumes a lot of tokens)
  - `All Files`: Context is all files in the project. (Good for small projects. also consumes a lot of tokens)

```
NOTE: If you have selected code then it will be the part of prompt. Irrespective of the context you have selected.
```

- `autopilot.chatTemperature` : Set the temperature for the GPT model (default: 0.5).
- `autopilot.chatRestriction` : Choose the restriction for the chat (default: None).
  - `None`: No restriction.
  - `No Code`: Restrict the chat to exclude code snippets.
- `autopilot.autoCompletionModel` : Choose the GPT model to use for AI code completion (default: text-davinci-002).

  - `text-davinci-003`: Most expensive, Slower but best model.
  - `text-davinci-002`: Less costly, Faster.
  - `text-curie-001`: Less costly, Faster.
  - `text-babbage-001`
  - `text-ada-001`
  - `davinci`
  - `curie`
  - `babbage`
  - `ada`

- `autopilot.numberOfCodeSuggestions` : Set the number of code suggestions (1 to 5) to display (default: 1).
- `autopilot.enableChat` : Enable or disable the chat feature (default: true).
- `autopilot.enableSearch` : Enable or disable the code search feature (default: true).
- `autopilot.enableAutoComplete` : Enable or disable the AI code completion feature (default: true).

## Usage

To use Autopilot, simply open Visual Studio Code and start a new project. You can then access the chat, code search, and AI code completion features by clicking on the Autopilot icon in the activity bar.
for posterity, here’s how to install an extension from a .vsix file:

## Installation

1. Download .vsix file from root of this repo
2. from VSCode’s main menu, select “Extensions”
   ![Install](https://global.discourse-cdn.com/business7/uploads/particle/original/3X/d/b/db4de268a3c2e19e5fd53e82bb12437272da2868.png)
3. click to open the three-dot menu at the top of the middle panel (see screenshot above)
4. select “Install from VSIX…” and follow the prompts.

## Credits

Autopilot was developed by HackerRank.

# autopilot-vscode-ext
