/**
 * pi-paste-image
 *
 * Fast clipboard image paste using a persistent PowerShell process.
 * Ctrl+Alt+V or /paste-image saves clipboard image and inserts path.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { tmpdir } from "os";
import { join } from "path";
import { existsSync, readFileSync } from "fs";

let psProcess: ChildProcessWithoutNullStreams | null = null;
let psReady = false;
let psInitPromise: Promise<void> | null = null;

/* ── Persistent PowerShell process ──────────────────────────────── */

function initPowerShell(): Promise<void> {
  if (psInitPromise) return psInitPromise;

  psInitPromise = new Promise((resolve, reject) => {
    psProcess = spawn(
      "powershell",
      [
        "-NoProfile",
        "-NoLogo",
        "-NonInteractive",
        "-Command",
        "-",
      ],
      { stdio: ["pipe", "pipe", "pipe"] }
    );

    let buffer = "";

    psProcess.stdout.on("data", (data: Buffer) => {
      buffer += data.toString();
      if (buffer.includes("PS_READY")) {
        psReady = true;
        resolve();
      }
    });

    psProcess.stderr.on("data", (data: Buffer) => {
      console.error("[paste-image] PS stderr:", data.toString());
    });

    psProcess.on("error", (err) => {
      console.error("[paste-image] PS spawn error:", err);
      reject(err);
    });

    // Send initialization script
    const initScript = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Write-Host 'PS_READY'

while ($true) {
  try {
    $line = [Console]::In.ReadLine()
    if (!$line -or $line -eq 'EXIT') { break }

    if ($line -eq 'GET_CLIPBOARD_IMAGE') {
      $img = [System.Windows.Forms.Clipboard]::GetImage()
      if ($img -eq $null) {
        Write-Host 'NO_IMAGE'
      } else {
        $tempFile = Join-Path $env:TEMP ('pi_clipboard_' + [DateTimeOffset]::Now.ToUnixTimeMilliseconds() + '.png')
        $img.Save($tempFile, [System.Drawing.Imaging.ImageFormat]::Png)
        Write-Host $tempFile
      }
    }
  } catch {
    Write-Host "ERROR:$($_.Exception.Message)"
  }
}
`.trim();

    psProcess.stdin.write(initScript + "\n");
  });

  return psInitPromise;
}

async function getClipboardImagePath(): Promise<string | null> {
  if (!psReady) {
    await initPowerShell();
  }

  if (!psProcess) return null;

  return new Promise((resolve) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    }, 5000);

    const onData = (data: Buffer) => {
      const lines = data.toString().split("\n").map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (line === "NO_IMAGE") {
          clearTimeout(timeout);
          psProcess!.stdout.removeListener("data", onData);
          if (!resolved) {
            resolved = true;
            resolve(null);
          }
          return;
        }
        if (line.startsWith("ERROR:")) {
          clearTimeout(timeout);
          psProcess!.stdout.removeListener("data", onData);
          console.error("[paste-image]", line.slice(6));
          if (!resolved) {
            resolved = true;
            resolve(null);
          }
          return;
        }
        // Check if it's a valid file path
        if (line.endsWith(".png") && existsSync(line)) {
          clearTimeout(timeout);
          psProcess!.stdout.removeListener("data", onData);
          if (!resolved) {
            resolved = true;
            resolve(line);
          }
          return;
        }
      }
    };

    psProcess!.stdout.on("data", onData);
    psProcess!.stdin.write("GET_CLIPBOARD_IMAGE\n");
  });
}

/* ── Extension ──────────────────────────────────────────────────── */

export default function (pi: ExtensionAPI) {

  // Pre-initialize PowerShell on session start
  pi.on("session_start", async () => {
    initPowerShell().catch(() => { /* ignore */ });
  });

  // Ctrl+Alt+V shortcut
  pi.registerShortcut("ctrl+alt+v", {
    description: "Paste image from clipboard",
    handler: async (ctx) => {
      ctx.ui.setStatus("paste-image", "Reading clipboard...");

      try {
        const filePath = await getClipboardImagePath();

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

  // /paste-image command
  pi.registerCommand("paste-image", {
    description: "Save clipboard image and insert file path into editor",
    handler: async (_args, ctx) => {
      ctx.ui.setStatus("paste-image", "Reading clipboard...");

      try {
        const filePath = await getClipboardImagePath();

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
