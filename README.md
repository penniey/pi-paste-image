# pi-paste-image

Paste clipboard images into your [pi](https://github.com/badlogic/pi) conversations.

## What it does

When you copy an image to your clipboard (screenshot, copied image, etc.), this extension:

1. Saves it to a temp file (`%TEMP%\pi_clipboard_<timestamp>.png`)
2. Inserts the file path into your editor
3. You send the message → pi's `read` tool opens the image so the LLM can see it

## Installation

```bash
pi install git:github.com/penniey/pi-paste-image
```

Or install from a local path:

```bash
pi install ./pi-paste-image
```

## Usage

- **Keyboard shortcut**: `Ctrl+Alt+V` (uses Alt instead of Shift to avoid terminal paste conflict)
- **Command**: `/paste-image`

Both methods are **near-instant** after the first use (~50ms) — the clipboard reader runs as a persistent background process, so `.NET` assemblies load only once on startup.

Both methods append the image file path to whatever text you already have in the editor, so you can type your question around it:

```
What do you think about this? C:\Users\hugo2\AppData\Local\Temp\pi_clipboard_12345.png
```

> **Why not Ctrl+V?** Terminals intercept Ctrl+V at a level below pi for raw text paste. When the clipboard contains an image, terminals paste nothing or garbled bytes. A TUI app can't override this, so we use Ctrl+Alt+V instead.

## Platform support

- **Windows**: Uses PowerShell + .NET `System.Windows.Forms.Clipboard` (built-in, no dependencies)
- macOS and Linux support can be added — see the source for the hooks.

## How it works

The extension spawns a **persistent PowerShell process** on `session_start` that:

1. Loads `.NET` clipboard assemblies once (the slow part — done only at startup)
2. Listens on stdin for `GET_CLIPBOARD_IMAGE` commands
3. Extracts the image via `[System.Windows.Forms.Clipboard]::GetImage()`
4. Saves it as PNG to `%TEMP%` and writes the file path to stdout

Because the process stays alive, every paste after the first is ~instant — just a single stdin/stdout round-trip with no assembly loading overhead.

The temp file persists until Windows cleans it up, giving pi's `read` tool time to open it.
