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

Both methods append the image file path to whatever text you already have in the editor, so you can type your question around it:

```
What do you think about this? C:\Users\hugo2\AppData\Local\Temp\pi_clipboard_12345.png
```

> **Why not Ctrl+V?** Terminals intercept Ctrl+V at a level below pi for raw text paste. When the clipboard contains an image, terminals paste nothing or garbled bytes. A TUI app can't override this, so we use Ctrl+Alt+V instead.

## Platform support

- **Windows**: Uses PowerShell + .NET `System.Windows.Forms.Clipboard` (built-in, no dependencies)
- macOS and Linux support can be added — see the source for the hooks.

## How it works

The extension runs a PowerShell script (via `-EncodedCommand` to avoid quoting issues) that:

1. Loads the `.NET` clipboard assemblies (`System.Windows.Forms`, `System.Drawing`)
2. Extracts the image via `[System.Windows.Forms.Clipboard]::GetImage()`
3. Saves it as PNG to `%TEMP%`
4. Returns the file path to Node.js, which inserts it into the pi editor

The temp file persists until Windows cleans it up, giving pi's `read` tool time to open it.
