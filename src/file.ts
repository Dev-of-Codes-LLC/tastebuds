// Open a file from disk and save one back. The file is the store: there is
// no account and no backend.
//
// Browsers with the File System Access API save back to the same file. Other
// browsers open through a file input and save as a download.

export interface OpenFile {
  name: string;
  text: string;
  // Set when the browser can write back to the same file.
  handle?: any;
}

const jsonTypes = [{ description: "Taste profile", accept: { "application/json": [".json"] } }];

export const canSaveInPlace = () => "showOpenFilePicker" in window;

export async function openFile(): Promise<OpenFile | null> {
  if (canSaveInPlace()) {
    try {
      const [handle] = await (window as any).showOpenFilePicker({ types: jsonTypes });
      const file: File = await handle.getFile();
      return { name: file.name, text: await file.text(), handle };
    } catch (err) {
      if ((err as DOMException).name === "AbortError") return null;
      throw err;
    }
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      resolve(file ? { name: file.name, text: await file.text() } : null);
    });
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}

// Save the text. Returns the handle and name it was saved under, or null when
// the person cancelled.
export async function saveFile(
  text: string,
  name: string,
  handle?: any,
): Promise<{ name: string; handle?: any } | null> {
  if (canSaveInPlace()) {
    try {
      const target =
        handle ?? (await (window as any).showSaveFilePicker({ suggestedName: name, types: jsonTypes }));
      const writable = await target.createWritable();
      await writable.write(text);
      await writable.close();
      return { name: target.name, handle: target };
    } catch (err) {
      if ((err as DOMException).name === "AbortError") return null;
      throw err;
    }
  }
  download(text, name, "application/json");
  return { name };
}

export function download(text: string, name: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
