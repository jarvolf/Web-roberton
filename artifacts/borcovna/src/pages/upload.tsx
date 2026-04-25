import { useState, useRef, useEffect, useCallback } from "react";

const GALLERIES = [
  { id: "kuchyne", label: "Kuchyně" },
  { id: "predsine", label: "Předsíně" },
  { id: "detske", label: "Dětské pokoje" },
  { id: "skrine", label: "Skříně" },
  { id: "koupelny", label: "Koupelny" },
];

async function resizeImage(file: File, maxPx = 1920, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width > height) { height = Math.round((height * maxPx) / width); width = maxPx; }
        else { width = Math.round((width * maxPx) / height); height = maxPx; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Canvas toBlob failed")), "image/jpeg", quality);
    };
    img.onerror = reject;
    img.src = url;
  });
}

type FileStatus = "pending" | "resizing" | "uploading" | "done" | "error";

interface FileEntry {
  file: File;
  status: FileStatus;
  error?: string;
}

/** Položka z get-photos (nový worker vrací key + url; starší API jen URL řetězec). */
interface GalleryPhoto {
  key: string;
  url: string;
}

function photoFromApiItem(item: unknown): GalleryPhoto | null {
  if (typeof item === "string") {
    try {
      const u = new URL(item);
      const key = decodeURIComponent(u.pathname.replace(/^\//, ""));
      return key ? { key, url: item } : null;
    } catch {
      return null;
    }
  }
  if (item && typeof item === "object") {
    const o = item as { url?: unknown; key?: unknown };
    if (typeof o.url !== "string" || !o.url.trim()) return null;
    if (typeof o.key === "string" && o.key.trim()) {
      return { key: o.key.trim(), url: o.url.trim() };
    }
    try {
      const u = new URL(o.url.trim());
      const key = decodeURIComponent(u.pathname.replace(/^\//, ""));
      return key ? { key, url: o.url.trim() } : null;
    } catch {
      return null;
    }
  }
  return null;
}

const GET_PHOTOS_ENDPOINT = import.meta.env.VITE_GET_PHOTOS_ENDPOINT ?? "https://get-photos.jarvolf93.workers.dev/";
const UPLOAD_PHOTO_ENDPOINT = import.meta.env.VITE_UPLOAD_PHOTO_ENDPOINT ?? "https://upload-photo.jarvolf93.workers.dev/";
const DELETE_PHOTO_ENDPOINT = import.meta.env.VITE_DELETE_PHOTO_ENDPOINT ?? "https://delete-photo.jarvolf93.workers.dev/";
const MAX_FILES_PER_UPLOAD = 20;
const MAX_FILE_MB = 15;

export default function Upload() {
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [gallery, setGallery] = useState(GALLERIES[0].id);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [loadedPhotos, setLoadedPhotos] = useState<GalleryPhoto[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pageMessage, setPageMessage] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchPhotos = useCallback(async () => {
    const res = await fetch(`${GET_PHOTOS_ENDPOINT}?gallery=${encodeURIComponent(gallery)}`);
    if (!res.ok) {
      throw new Error("Nepodařilo se načíst seznam fotek.");
    }

    const data = await res.json();
    const rawPhotos = Array.isArray(data?.photos) ? data.photos : [];
    const photos = rawPhotos.map(photoFromApiItem).filter((p): p is GalleryPhoto => p !== null);

    setLoadedPhotos(photos);
  }, [gallery]);

  useEffect(() => {
    fetchPhotos().catch((err) => {
      const message = err instanceof Error ? err.message : "Nepodařilo se načíst fotky.";
      setPageMessage(message);
    });
  }, [fetchPhotos]);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    const validFiles = selected.filter((file) => file.type.startsWith("image/") && file.size <= MAX_FILE_MB * 1024 * 1024);
    const cappedFiles = validFiles.slice(0, MAX_FILES_PER_UPLOAD);
    const skipped = selected.length - cappedFiles.length;

    setFiles(cappedFiles.map((file) => ({ file, status: "pending" })));

    if (skipped > 0) {
      setPageMessage(`Některé soubory byly přeskočeny (max ${MAX_FILES_PER_UPLOAD} fotek, pouze obrázky do ${MAX_FILE_MB} MB).`);
    } else {
      setPageMessage("");
    }

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const updateStatus = (index: number, status: FileStatus, error?: string) => {
    setFiles(prev => prev.map((f, i) => i === index ? { ...f, status, error } : f));
  };

  const handleUpload = async () => {
    if (!password || files.length === 0) return;
    setPageMessage("");
    setRunning(true);
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      const { file } = files[i];
      try {
        if (!file.type.startsWith("image/")) {
          updateStatus(i, "error", "Nepodporovaný typ souboru");
          continue;
        }
        if (file.size > MAX_FILE_MB * 1024 * 1024) {
          updateStatus(i, "error", `Soubor je větší než ${MAX_FILE_MB} MB`);
          continue;
        }

        updateStatus(i, "resizing");
        const blob = await resizeImage(file);
        const filename = file.name.replace(/\.[^.]+$/, "") + ".jpg";

        updateStatus(i, "uploading");
        
        // Convert blob to base64
        const base64Data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.readAsDataURL(blob);
        });

        const res = await fetch(UPLOAD_PHOTO_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            password, 
            gallery, 
            filename, 
            contentType: "image/jpeg",
            fileData: base64Data 
          }),
        });

        if (!res.ok) {
          let errorMessage = "Chyba serveru";
          try {
            const data = await res.json();
            if (typeof data?.error === "string" && data.error.trim()) {
              errorMessage = data.error;
            }
          } catch {
            // Keep fallback for non-JSON responses.
          }
          updateStatus(i, "error", errorMessage);
          continue;
        }

        updateStatus(i, "done");
        successCount += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Neznámá chyba";
        updateStatus(i, "error", message);
      }
    }

    setRunning(false);

    if (successCount > 0) {
      setPageMessage(`Nahráno ${successCount} souborů.`);
    }

    await fetchPhotos().catch((err) => {
      const message = err instanceof Error ? err.message : "Nepodařilo se načíst aktualizovaný seznam fotek.";
      setPageMessage(message);
    });
  };

  const handleDelete = async (photo: GalleryPhoto) => {
    if (!photo.key || !password) return;

    setDeleting(photo.key);
    setPageMessage("");
    try {
      const res = await fetch(DELETE_PHOTO_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, gallery, key: photo.key }),
      });
      
      if (res.ok) {
        setLoadedPhotos(prev => prev.filter(p => p.key !== photo.key));
        setPageMessage("Fotka byla smazána.");
      } else {
        let errorMessage = "Chyba při mazání";
        try {
          const data = await res.json();
          if (typeof data?.error === "string" && data.error.trim()) {
            errorMessage = data.error;
          }
        } catch {
          // Keep fallback for non-JSON responses.
        }
        setPageMessage(errorMessage);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Neznámá chyba při mazání.";
      setPageMessage(`Chyba při mazání: ${message}`);
    }
    setDeleting(null);
  };

  const statusLabel: Record<FileStatus, string> = {
    pending: "⏳ Čeká",
    resizing: "🔄 Zmenšuji...",
    uploading: "📤 Nahrávám...",
    done: "✅ Hotovo",
    error: "❌ Chyba",
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center px-6 py-12 bg-background text-white">
      <h1 className="text-2xl font-black tracking-widest uppercase mb-8">Nahrát fotky</h1>

      <div className="w-full max-w-md flex flex-col gap-4">
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Heslo"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full bg-muted/30 border border-border/40 px-4 py-3 text-white placeholder:text-white/50 outline-none pr-12"
          />
          <button
            type="button"
            onClick={() => setShowPassword(p => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
          >
            {showPassword ? "🙈" : "👁️"}
          </button>
        </div>

        <select
          value={gallery}
          onChange={e => setGallery(e.target.value)}
          className="bg-muted/30 border border-border/40 px-4 py-3 text-white outline-none"
        >
          {GALLERIES.map(g => (
            <option key={g.id} value={g.id}>{g.label}</option>
          ))}
        </select>

        <button
          onClick={() => inputRef.current?.click()}
          className="border border-border/40 px-4 py-3 text-white/70 hover:text-white transition-colors text-left"
        >
          {files.length > 0 ? `${files.length} fotek vybráno` : "Vybrat fotky"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFiles}
        />

        {files.length > 0 && (
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto text-sm">
            {files.map((f, i) => (
              <div key={i} className="flex justify-between gap-2">
                <span className="truncate text-white/70">{f.file.name}</span>
                <span className="shrink-0">{f.error ? `❌ ${f.error}` : statusLabel[f.status]}</span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={running || !password || files.length === 0}
          className="bg-primary text-primary-foreground px-6 py-3 text-sm uppercase tracking-widest font-semibold disabled:opacity-50 hover:brightness-110 active:scale-95 transition-all duration-200"
        >
          {running ? "Nahrávám..." : "Nahrát"}
        </button>
        {pageMessage && <p className="text-xs text-white/80">{pageMessage}</p>}

        {password && loadedPhotos.length > 0 && (
          <div className="mt-8 w-full">
            <h2 className="text-lg font-bold tracking-widest uppercase mb-4">Fotky v galerii</h2>
            <div className="grid grid-cols-2 gap-4">
              {loadedPhotos.map((photo) => (
                <div key={photo.key} className="relative group">
                  <img src={photo.url} alt={photo.key} className="w-full aspect-square object-cover" />
                  <button
                    type="button"
                    onClick={() => handleDelete(photo)}
                    disabled={deleting !== null}
                    className="absolute top-2 right-2 bg-red-600 text-white px-3 py-1 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                  >
                    {deleting === photo.key ? "..." : "Smazat"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}