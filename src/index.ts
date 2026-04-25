/**
 * pi-paste-image
 *
 * Ctrl+Alt+V — saves clipboard image to a temp file and inserts
 * the file path into the editor. The LLM reads it via the `read` tool.
 * Also available as the `/paste-image` command.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { exec } from "child_process";
import { promisify } from "util";
import { tmpdir } from "os";
import { join } from "path";
import { existsSync } from "fs";

const execAsync = promisify(exec);

/* ── Clipboard reading ──────────────────────────────────────────── */

async function readClipboardImage(): Promise<string | null> {
  const timestamp = Date.now();
  const tempFile = join(tmpdir(), `pi_clipboard_${timestamp}.png`);
  const psTempFile = tempFile.replace(/\\/g, "\\\\");

  const psScript = `
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
    Add-Type -AssemblyName System.Drawing -ErrorAction Stop
    $img = [System.Windows.Forms.Clipboard]::GetImage()
    if ($img -eq $null) { exit 1 }
    $img.Save("${psTempFile}", [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output "${tempFile}"
  `;

  const encodedCommand = Buffer.from(psScript, "utf16le").toString("base64");

  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -EncodedCommand ${encodedCommand}`,
      { timeout: 10000 }
    );

    const p = stdout.trim();
    if (p && existsSync(p)) return p;
    return null;
  } catch {
    return null;
  }
}

/* ── Extension ──────────────────────────────────────────────────── */

export default function (pi: ExtensionAPI) {

  pi.registerShortcut("ctrl+alt+v", {
    description: "Paste image from clipboard",
    handler: async (ctx) => {
      ctx.ui.setStatus("paste-image", "Reading clipboard...");

      try {
        const filePath = await readClipboardImage();

        if (!filePath) {
          ctx.ui.setStatus("paste-image", undefined);
          ctx.ui.notify("No image found in clipboard", "warning");
          return;
        }

        const existingText = ctx.ui.getEditorText();
        const newText = existingText
          ? `${existingText} ${filePath}`
          : filePath;
        ctx.ui.setEditorText(newText);

        ctx.ui.setStatus("paste-image", undefined);
        ctx.ui.notify("Image saved! File path inserted.", "success");
      } catch (error: any) {
        ctx.ui.setStatus("paste-image", undefined);
        ctx.ui.notify(`Failed: ${error.message}`, "error");
      }
    },
  });

  pi.registerCommand("paste-image", {
    description: "Save clipboard image and insert file path into editor",
    handler: async (_args, ctx) => {
      ctx.ui.setStatus("paste-image", "Reading clipboard...");

      try {
        const filePath = await readClipboardImage();

        if (!filePath) {
          ctx.ui.setStatus("paste-image", undefined);
          ctx.ui.notify("No image found in clipboard", "warning");
          return;
        }

        const existingText = ctx.ui.getEditorText();
        const newText = existingText
          ? `${existingText} ${filePath}`
          : filePath;
        ctx.ui.setEditorText(newText);

        ctx.ui.setStatus("paste-image", undefined);
        ctx.ui.notify("Image saved! File path inserted.", "success");
      } catch (error: any) {
        ctx.ui.setStatus("paste-image", undefined);
        ctx.ui.notify(`Failed: ${error.message}`, "error");
      }
    },
  });
}
