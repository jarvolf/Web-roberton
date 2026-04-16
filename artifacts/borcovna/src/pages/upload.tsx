import { useState, useRef, useEffect } from "react";

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

export default function Upload() {
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [gallery, setGallery] = useState(GALLERIES[0].id);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [loadedPhotos, setLoadedPhotos] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchPhotos = async () => {
      const res = await fetch(`/.netlify/functions/get-photos?gallery=${gallery}`);
      const data = await res.json();
      setLoadedPhotos(data.photos ?? []);
    };
    fetchPhotos();
  }, [gallery]);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    setFiles(selected.map(file => ({ file, status: "pending" })));
  };

  const updateStatus = (index: number, status: FileStatus, error?: string) => {
    setFiles(prev => prev.map((f, i) => i === index ? { ...f, status, error } : f));
  };

  const handleUpload = async () => {
    if (!password || files.length === 0) return;
    setRunning(true);

    for (let i = 0; i < files.length; i++) {
      const { file } = files[i];
      try {
        updateStatus(i, "resizing");
        const blob = await resizeImage(file);
        const filename = file.name.replace(/\.[^.]+$/, "") + ".jpg";

        updateStatus(i, "uploading");
        const res = await fetch("/.netlify/functions/upload-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password, gallery, filename, contentType: "image/jpeg" }),
        });

        if (!res.ok) {
          const data = await res.json();
          updateStatus(i, "error", data.error ?? "Chyba serveru");
          continue;
        }

        const { uploadUrl } = await res.json();
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": "image/jpeg" },
          body: blob,
        });

        if (!uploadRes.ok) {
          updateStatus(i, "error", "Upload do R2 selhal");
        } else {
          updateStatus(i, "done");
        }
      } catch (err) {
        updateStatus(i, "error", String(err));
      }
    }

    setRunning(false);
    
    // Reload photos after upload
    const res = await fetch(`/.netlify/functions/get-photos?gallery=${gallery}`);
    const data = await res.json();
    setLoadedPhotos(data.photos ?? []);
  };

  const handleDelete = async (photoUrl: string) => {
    const filename = photoUrl.split("/").pop();
    if (!filename || !password) return;
    
    setDeleting(filename);
    try {
      const res = await fetch("/.netlify/functions/delete-photo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, filename }),
      });
      
      if (res.ok) {
        setLoadedPhotos(prev => prev.filter(p => p !== photoUrl));
      } else {
        const data = await res.json();
        alert(data.error ?? "Chyba při mazání");
      }
    } catch (err) {
      alert("Chyba při mazání: " + err);
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

        {password && loadedPhotos.length > 0 && (
          <div className="mt-8 w-full">
            <h2 className="text-lg font-bold tracking-widest uppercase mb-4">Fotky v galerii</h2>
            <div className="grid grid-cols-2 gap-4">
              {loadedPhotos.map((photo, i) => (
                <div key={i} className="relative group">
                  <img src={photo} alt={`Photo ${i}`} className="w-full aspect-square object-cover" />
                  <button
                    onClick={() => handleDelete(photo)}
                    disabled={deleting !== null}
                    className="absolute top-2 right-2 bg-red-600 text-white px-3 py-1 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                  >
                    {deleting === photo.split("/").pop() ? "..." : "Smazat"}
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
