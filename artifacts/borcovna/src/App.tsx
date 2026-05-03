import Upload from "@/pages/upload";
import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import NotFound from "@/pages/not-found";
import { motion, AnimatePresence } from "framer-motion";
import {
  CookingPot,
  DoorOpen,
  Baby,
  Package,
  Droplets,
  BedDouble,
  Sofa,
  ConciergeBell,
  Shirt,
  Phone,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

import logoGroup from "@assets/IMG-20260410-WA0002_1775846111566.jpg";
import logoSingle from "@assets/IMG-20260410-WA0001_1775846111605.jpg";

const queryClient = new QueryClient();

type Section = {
  id: string;
  label: string;
  code: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; style?: React.CSSProperties }>;
};

const sections = [
  { id: "kuchyne", label: "Kuchyně", code: "KU", icon: CookingPot },
  { id: "predsine", label: "Předsíně", code: "PR", icon: DoorOpen },
  { id: "detske", label: "Dětské pokoje", code: "DP", icon: Baby },
  { id: "skrine", label: "Skříně", code: "SK", icon: Package },
  { id: "koupelny", label: "Koupelny", code: "KO", icon: Droplets },
  { id: "loznice", label: "Ložnice", code: "LO", icon: BedDouble },
  { id: "obyvaci", label: "Obývací pokoje", code: "OP", icon: Sofa },
  { id: "recepce", label: "Recepce", code: "RE", icon: ConciergeBell },
  { id: "satny", label: "Šatny", code: "SA", icon: Shirt },
] satisfies Section[];

type FormData = { jmeno: string; telefon: string; email: string; dotaz: string };
type FormStatus = "idle" | "sending" | "sent" | "error";
const CONTACT_FORM_ENDPOINT = import.meta.env.VITE_CONTACT_ENDPOINT ?? "https://contact-form.jarvolf93.workers.dev/";
const GET_PHOTOS_ENDPOINT = import.meta.env.VITE_GET_PHOTOS_ENDPOINT ?? "https://get-photos.jarvolf93.workers.dev/";

type GalleryPhoto = { url: string; key?: string; code?: string };
const CODE_BY_GALLERY = Object.fromEntries(sections.map((s) => [s.id, s.code])) as Record<string, string>;

function parseKeyFromUrl(url: string): string | undefined {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
  } catch {
    return undefined;
  }
}

/** Čas z R2 klíče `galerie/1736123456789-soubor.jpg` — řazení a stabilní čísla (nejstarší = 1). */
function extractUploadTimeFromKey(photo: GalleryPhoto, indexFallback: number): number {
  const key = (photo.key?.trim() || parseKeyFromUrl(photo.url) || "").trim();
  const m = key.match(/\/(\d{10,})-/);
  if (m) {
    const t = parseInt(m[1], 10);
    if (!Number.isNaN(t)) return t;
  }
  return indexFallback;
}

function inferPhotoCode(source: string | undefined, galleryId: string): string | undefined {
  if (!source) return undefined;
  const pref = CODE_BY_GALLERY[galleryId];
  if (!pref) return undefined;
  const escapedPref = pref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(${escapedPref}-\\d{1,6})`, "i");
  const match = source.match(re);
  return match?.[1]?.toUpperCase();
}

/** Příprava pro variantu 2: get-photos může vracet url/key/code. */
function photoFromApiItem(item: unknown, galleryId: string): GalleryPhoto | null {
  if (typeof item === "string" && item.trim()) {
    const url = item.trim();
    const key = parseKeyFromUrl(url);
    return { url, key, code: inferPhotoCode(key ?? url, galleryId) };
  }
  if (item && typeof item === "object") {
    const o = item as { url?: unknown; key?: unknown; code?: unknown };
    if (typeof o.url !== "string" || !o.url.trim()) return null;
    const url = o.url.trim();
    const key = typeof o.key === "string" && o.key.trim() ? o.key.trim() : parseKeyFromUrl(url);
    const code = typeof o.code === "string" && o.code.trim()
      ? o.code.trim().toUpperCase()
      : inferPhotoCode(key ?? url, galleryId);
    return { url, key, code };
  }
  return null;
}

function Home() {
  const [activeSection, setActiveSection] = useState(sections[0].id);
  const [photos, setPhotos] = useState<Record<string, GalleryPhoto[]>>({});
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [formData, setFormData] = useState<FormData>({ jmeno: "", telefon: "", email: "", dotaz: "" });
  const [honeypot, setHoneypot] = useState("");
  const [formStatus, setFormStatus] = useState<FormStatus>("idle");
  const [formError, setFormError] = useState("");
  /** URL fotek, které se nepodařilo načíst — úplně je skryjeme (žádný broken icon / rámeček). */
  const [failedGalleryUrls, setFailedGalleryUrls] = useState<Set<string>>(() => new Set());
  const isMobile = useIsMobile();
  const mobileNavScrollRef = useRef<HTMLDivElement>(null);
  const mobileNavLoopJumping = useRef(false);
  const [mobileNavOverflow, setMobileNavOverflow] = useState(false);
  const photoCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lastViewedPhotoBySectionRef = useRef<Record<string, string>>({});
  /** Výška bloku e-mail + telefon + tlačítko — panáčci mají max. tuto výšku (flex + img jinak roztahuje řádek). */
  const footerContactRef = useRef<HTMLDivElement>(null);
  const [footerBandPx, setFooterBandPx] = useState(0);
  /** Pouze desktop: zvětšená fotka; zavře se kliknutím kamkoliv (bez přepínání mezi snímky). */
  const [desktopLightboxUrl, setDesktopLightboxUrl] = useState<string | null>(null);

  const mobileNavStrip = useMemo(
    () =>
      ([0, 1, 2] as const).flatMap((strip) =>
        sections.map((section, indexInStrip) => ({
          section,
          stripKey: `${section.id}-${strip}-${indexInStrip}`,
        })),
      ),
    [],
  );

  useLayoutEffect(() => {
    const el = mobileNavScrollRef.current;
    if (!el) return;

    const updateOverflow = () => {
      setMobileNavOverflow(el.scrollWidth > el.clientWidth + 2);
    };

    const centerOnce = () => {
      const setW = el.scrollWidth / 3;
      if (setW > 0) {
        el.scrollLeft = setW;
      }
    };

    updateOverflow();
    centerOnce();
    requestAnimationFrame(() => {
      updateOverflow();
      centerOnce();
    });

    const ro = new ResizeObserver(() => {
      updateOverflow();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleMobileNavScroll = useCallback(() => {
    if (mobileNavLoopJumping.current) return;
    const el = mobileNavScrollRef.current;
    if (!el) return;
    if (el.scrollWidth <= el.clientWidth + 4) return;
    const setW = el.scrollWidth / 3;
    if (setW <= 0) return;
    const maxScrollLeft = el.scrollWidth - el.clientWidth;
    const edgeTolerancePx = 2;

    // Jakmile dorazíme na fyzický kraj, přeskočíme o jednu sadu.
    if (el.scrollLeft <= edgeTolerancePx) {
      mobileNavLoopJumping.current = true;
      el.scrollLeft += setW;
      requestAnimationFrame(() => {
        mobileNavLoopJumping.current = false;
      });
    } else if (el.scrollLeft >= maxScrollLeft - edgeTolerancePx) {
      mobileNavLoopJumping.current = true;
      el.scrollLeft -= setW;
      requestAnimationFrame(() => {
        mobileNavLoopJumping.current = false;
      });
    }
  }, []);

  const markGalleryPhotoFailed = useCallback((url: string) => {
    setFailedGalleryUrls((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  useEffect(() => {
    sections.forEach(async (section) => {
      const res = await fetch(`${GET_PHOTOS_ENDPOINT}?gallery=${encodeURIComponent(section.id)}`);
      const data = await res.json();
      const raw = Array.isArray(data?.photos) ? data.photos : [];
      const preparedPhotos = raw.map((item) => photoFromApiItem(item, section.id)).filter((p): p is GalleryPhoto => p !== null);
      setPhotos(prev => ({ ...prev, [section.id]: preparedPhotos }));
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Spam bots often fill hidden fields; silently pretend success.
    if (honeypot.trim()) {
      setFormStatus("sent");
      return;
    }

    const trimmedName = formData.jmeno.trim();
    const trimmedPhone = formData.telefon.trim();
    const trimmedEmail = formData.email.trim();
    const trimmedMessage = formData.dotaz.trim();

    // Upozornění na prázdný formulář.
    if (!trimmedName && !trimmedPhone && !trimmedEmail && !trimmedMessage) {
      setFormError("Formulář je prázdný. Vyplňte prosím alespoň telefon.");
      setFormStatus("error");
      return;
    }

    // Telefon je povinný údaj.
    const phoneDigits = trimmedPhone.replace(/\D/g, "");
    if (phoneDigits.length === 0) {
      setFormError("Telefon je povinný údaj.");
      setFormStatus("error");
      return;
    }

    if (phoneDigits.length < 9) {
      setFormError("Telefonní číslo je neúplné (minimálně 9 číslic).");
      setFormStatus("error");
      return;
    }

    setFormError("");
    setFormStatus("sending");

    try {
      const res = await fetch(CONTACT_FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          phone: trimmedPhone,
          email: trimmedEmail,
          message: trimmedMessage,
        }),
      });

      if (res.ok) {
        setFormStatus("sent");
        setFormData({ jmeno: "", telefon: "", email: "", dotaz: "" });
        setHoneypot("");
      } else {
        let errorMessage = "Chyba při odesílání";
        try {
          const data = await res.json();
          if (typeof data?.error === "string" && data.error.trim()) {
            errorMessage = data.error;
          }
        } catch {
          // Keep fallback message when response is not JSON.
        }
        setFormError(errorMessage);
        setFormStatus("error");
      }
    } catch (err) {
      const fallback = err instanceof Error ? err.message : "Neznámá chyba připojení";
      setFormError(`Chyba: ${fallback}`);
      setFormStatus("error");
    }
  };

  const currentPhotos = photos[activeSection] ?? [];
  /** Nejnovější nahoře; `stableNum` = trvalé číslo (nejstarší v albu = 1). */
  const galleryDisplayRows = useMemo(() => {
    const rows = currentPhotos
      .map((photo, originalIdx) => ({
        photo,
        ts: extractUploadTimeFromKey(photo, originalIdx),
        originalIdx,
      }))
      .filter((row) => !failedGalleryUrls.has(row.photo.url));
    if (rows.length === 0) return [];
    const asc = [...rows].sort((a, b) => a.ts - b.ts || a.originalIdx - b.originalIdx);
    const stableNumByUrl = new Map<string, number>();
    asc.forEach((row, i) => {
      stableNumByUrl.set(row.photo.url, Math.min(i + 1, 999));
    });
    const desc = [...rows].sort((a, b) => b.ts - a.ts || b.originalIdx - a.originalIdx);
    return desc.map(({ photo }) => ({
      photo,
      stableNum: stableNumByUrl.get(photo.url) ?? 1,
    }));
  }, [currentPhotos, failedGalleryUrls]);

  const setPhotoCardRef = useCallback((url: string, el: HTMLDivElement | null) => {
    photoCardRefs.current[url] = el;
  }, []);

  useEffect(() => {
    if (galleryDisplayRows.length === 0) return;
    const cards = galleryDisplayRows
      .map(({ photo }) => photoCardRefs.current[photo.url])
      .filter((el): el is HTMLDivElement => !!el);
    if (cards.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let bestUrl: string | undefined;
        let bestRatio = 0;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (entry.intersectionRatio <= bestRatio) continue;
          const url = (entry.target as HTMLElement).dataset.photoUrl;
          if (!url) continue;
          bestRatio = entry.intersectionRatio;
          bestUrl = url;
        }
        if (bestUrl) {
          lastViewedPhotoBySectionRef.current[activeSection] = bestUrl;
        }
      },
      {
        threshold: [0, 0.05, 0.1, 0.2, 0.35, 0.5, 0.75, 1],
        rootMargin: "0px 0px -10% 0px",
      },
    );

    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [activeSection, galleryDisplayRows]);

  useLayoutEffect(() => {
    if (galleryDisplayRows.length === 0) return;
    const rememberedUrl = lastViewedPhotoBySectionRef.current[activeSection];
    if (!rememberedUrl) return;
    if (!galleryDisplayRows.some(({ photo }) => photo.url === rememberedUrl)) return;

    let cancelled = false;
    let tries = 0;
    const tryScroll = () => {
      if (cancelled) return;
      tries += 1;
      const target = photoCardRefs.current[rememberedUrl];
      if (target) {
        target.scrollIntoView({ block: "start", inline: "nearest", behavior: "auto" });
        return;
      }
      if (tries < 12) {
        requestAnimationFrame(tryScroll);
      }
    };
    requestAnimationFrame(tryScroll);
    return () => {
      cancelled = true;
    };
  }, [activeSection, galleryDisplayRows]);

  useEffect(() => {
    setDesktopLightboxUrl(null);
  }, [activeSection]);

  useEffect(() => {
    if (isMobile) {
      setDesktopLightboxUrl(null);
      return;
    }
    if (!desktopLightboxUrl) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setDesktopLightboxUrl(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [desktopLightboxUrl, isMobile]);

  useLayoutEffect(() => {
    const el = footerContactRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const apply = () => {
      requestAnimationFrame(() => {
        const h = el.getBoundingClientRect().height;
        if (h > 0) setFooterBandPx(Math.round(h * 100) / 100);
      });
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    window.addEventListener("resize", apply);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, []);

  /** Jen `max-height` bez výšky rodiče rozbije `%` u `<img>` → přetékání a ořez při `overflow-hidden`. */
  const footerMascotBoxStyle: React.CSSProperties | undefined =
    footerBandPx > 0
      ? { height: `${footerBandPx}px`, boxSizing: "border-box", flexShrink: 0 }
      : undefined;

  return (
    <div className="min-h-screen w-full flex flex-col items-center pb-28 md:pb-24">
      <header className="w-full flex flex-col items-center bg-transparent pt-2 pb-4 px-6 gap-4 md:gap-6 md:pt-12">
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-5xl md:text-7xl font-black tracking-tight text-white leading-none">
            ROBERTON.CZ
          </h1>
          <p className="text-[14px] tracking-[0.3em] uppercase text-white font-medium">
            Truhlářská výroba na míru
          </p>
        </div>
        <div className="flex flex-col md:flex-row items-center justify-center gap-6">
          <img
            src={logoGroup}
            alt="Borcovna Logo"
            className="w-[72vw] max-w-2xl md:w-[42vw] md:max-w-4xl object-cover brightness-110 contrast-125 aspect-[1.15] overflow-hidden"
          />
        </div>
      </header>

      <nav className="sticky top-0 z-50 w-full border-b border-white/15 bg-transparent px-2 py-3 md:px-6">
        {/* Mobilní řada: trojitá stopa + skok okrajů = nekonečné otáčení; rámeček aktivní vždy červený (ne theme primary). */}
        <div className="relative md:hidden">
          <div
            ref={mobileNavScrollRef}
            onScroll={handleMobileNavScroll}
            className="flex w-full flex-nowrap items-stretch gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain px-3 py-2 [-webkit-overflow-scrolling:touch] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory scroll-px-3 touch-pan-x"
          >
            {mobileNavStrip.map(({ section, stripKey }) => {
              const isActive = activeSection === section.id;
              const Icon = section.icon;
              return (
                <button
                  key={stripKey}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  data-testid={`nav-${section.id}`}
                  className={`relative shrink-0 snap-start snap-always box-border flex flex-col items-center justify-center gap-2 px-2 py-3 min-h-[86px] w-[30vw] min-w-[96px] max-w-[150px] transition-colors duration-300 outline-none focus:outline-none focus-visible:outline-none ring-0 focus-visible:ring-0 ${
                    isActive
                      ? "border-2 border-[hsl(0,100%,50%)] text-[hsl(0,100%,50%)]"
                      : "border border-white/30 text-muted-foreground hover:text-foreground hover:border-white/50"
                  }`}
                >
                  <Icon
                    size={22}
                    strokeWidth={1.5}
                    className={`shrink-0 drop-shadow-[0_0_1px_#000,0_0_1px_#000,1px_0_0_#000,-1px_0_0_#000,0_1px_0_#000,0_-1px_0_#000] ${
                      isActive ? "text-[hsl(0,100%,50%)]" : "text-muted-foreground"
                    }`}
                  />
                  <span
                    className={`text-[15px] uppercase tracking-wide font-semibold leading-tight text-center [paint-order:stroke_fill] [-webkit-text-stroke:1px_#000] ${
                      isActive ? "text-[hsl(0,100%,50%)]" : "text-muted-foreground"
                    }`}
                  >
                    {section.label}
                  </span>
                </button>
              );
            })}
          </div>
          {mobileNavOverflow && (
            <>
              <div
                className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-black/55 to-transparent"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-black/55 to-transparent"
                aria-hidden
              />
              <ChevronLeft
                className="pointer-events-none absolute left-0.5 top-1/2 h-9 w-9 -translate-y-1/2 text-white/55 motion-safe:animate-pulse drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
                strokeWidth={2.75}
                aria-hidden
              />
              <ChevronRight
                className="pointer-events-none absolute right-0.5 top-1/2 h-9 w-9 -translate-y-1/2 text-white/55 motion-safe:animate-pulse drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
                strokeWidth={2.75}
                aria-hidden
              />
            </>
          )}
        </div>
        <div className="hidden md:flex w-full justify-between gap-2">
          {sections.map((section) => {
            const isActive = activeSection === section.id;
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                data-testid={`nav-${section.id}`}
                className={`relative box-border flex flex-col items-center justify-center gap-2 px-2 py-3 flex-1 min-h-[92px] transition-colors duration-300 outline-none focus:outline-none focus-visible:outline-none ring-0 focus-visible:ring-0 ${
                  isActive ? "text-[hsl(0,100%,50%)]" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 border-2 border-[hsl(0,100%,50%)] opacity-70"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <Icon
                  size={22}
                  strokeWidth={1.5}
                  className={`shrink-0 drop-shadow-[0_0_1px_#000,0_0_1px_#000,1px_0_0_#000,-1px_0_0_#000,0_1px_0_#000,0_-1px_0_#000] ${
                    isActive ? "text-[hsl(0,100%,50%)]" : "text-muted-foreground"
                  }`}
                />
                <span
                  className={`text-[15px] md:text-lg uppercase tracking-wide font-semibold transition-colors duration-300 leading-tight text-center [paint-order:stroke_fill] [-webkit-text-stroke:1px_#000] ${
                    isActive ? "text-[hsl(0,100%,50%)]" : "text-muted-foreground"
                  }`}
                >
                  {section.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <main className="w-full max-w-6xl px-6 pt-2 pb-24 flex-grow flex flex-col items-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="w-full"
          >
            {galleryDisplayRows.length > 0 ? (
              <div className="grid w-full grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
                {galleryDisplayRows.map(({ photo, stableNum }) => {
                  const cat = CODE_BY_GALLERY[activeSection] ?? "XX";
                  const photoLabel = `${cat}-${stableNum}`;
                  return (
                  <div
                    key={photo.url}
                    ref={(el) => setPhotoCardRef(photo.url, el)}
                    data-photo-url={photo.url}
                    className="flex flex-col gap-0 scroll-mt-28 md:scroll-mt-32"
                  >
                    <div
                      className={`w-full bg-black leading-[0] ${!isMobile ? "cursor-zoom-in" : ""}`}
                      role={!isMobile ? "button" : undefined}
                      tabIndex={!isMobile ? 0 : undefined}
                      aria-label={!isMobile ? "Zvětšit fotku" : undefined}
                      onClick={
                        !isMobile
                          ? () => {
                              setDesktopLightboxUrl(photo.url);
                            }
                          : undefined
                      }
                      onKeyDown={
                        !isMobile
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setDesktopLightboxUrl(photo.url);
                              }
                            }
                          : undefined
                      }
                    >
                      <img
                        src={photo.url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        onError={() => markGalleryPhotoFailed(photo.url)}
                        className="mx-auto block h-auto max-h-[min(88vh,920px)] w-auto max-w-full align-top object-contain"
                      />
                    </div>
                    <div className="mt-px flex w-full justify-center">
                      <span className="inline-flex min-h-[1.75rem] min-w-[2.25rem] items-center justify-center rounded-b-sm border-b border-l border-r border-white border-t-0 bg-black px-2.5 py-1 text-xs font-semibold tabular-nums tracking-wide text-white md:text-sm">
                        {photoLabel}
                      </span>
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-white/50 py-12">
                Žádné fotky v této galerii
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {!isMobile && desktopLightboxUrl && (
        <div
          className="fixed inset-0 z-[100] flex cursor-zoom-out items-center justify-center bg-black/90 p-4 md:p-8"
          role="presentation"
          onClick={() => setDesktopLightboxUrl(null)}
        >
          <img
            src={desktopLightboxUrl}
            alt=""
            className="pointer-events-none max-h-[min(92vh,920px)] max-w-[min(96vw,1400px)] object-contain"
          />
        </div>
      )}

      <footer className="fixed bottom-0 left-0 right-0 z-40 w-full border-t border-white/15 bg-transparent px-2 py-1 md:bg-black md:px-6 md:py-2">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-center gap-2 md:gap-3">
          <div
            className="flex min-h-0 shrink-0 items-center justify-center overflow-hidden rounded-md bg-black p-0.5 shadow-[0_2px_8px_rgba(0,0,0,0.4)] md:rounded-lg md:p-1 max-w-[min(30vw,7.5rem)] md:max-w-[8.5rem]"
            style={footerMascotBoxStyle}
          >
            <img
              src={logoSingle}
              alt="Borcovna panáček"
              className={
                footerBandPx > 0
                  ? "h-full w-full max-h-full max-w-full min-h-0 min-w-0 object-contain brightness-110 contrast-125 scale-x-[-1]"
                  : "h-auto max-h-32 w-auto max-w-full object-contain brightness-110 contrast-125 scale-x-[-1] md:max-h-36"
              }
            />
          </div>
          <div
            ref={footerContactRef}
            className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-start gap-0.5 text-center leading-tight"
          >
            <a
              href="mailto:borcovna@roberton.cz"
              data-testid="link-email"
              className="w-full text-white hover:text-primary transition-colors tracking-widest text-xs md:text-base [paint-order:stroke_fill] [-webkit-text-stroke:1px_#000]"
            >
              borcovna@roberton.cz
            </a>
            <a
              href="tel:+420606836630"
              data-testid="link-phone"
              className="flex w-full items-center justify-center gap-1.5 text-white hover:text-primary transition-colors tracking-widest text-xs md:text-base [paint-order:stroke_fill] [-webkit-text-stroke:1px_#000]"
            >
              <Phone
                size={16}
                className="shrink-0 drop-shadow-[0_0_1px_#000,0_0_1px_#000,1px_0_0_#000,-1px_0_0_#000,0_1px_0_#000,0_-1px_0_#000] md:h-[18px] md:w-[18px]"
                strokeWidth={1.5}
              />
              606 836 630
            </a>
            <button
              type="button"
              onClick={() => setIsContactOpen(true)}
              className="mt-0.5 flex w-full min-w-0 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow-md transition-all hover:brightness-110 active:scale-[0.99] md:rounded-lg md:py-2 md:text-sm"
              style={{ backgroundColor: "hsl(0, 100%, 50%)" }}
              data-testid="button-contact-open"
            >
              <MessageSquare className="h-4 w-4 shrink-0 md:h-5 md:w-5" strokeWidth={2.25} />
              Napište nám
            </button>
          </div>
          <div
            className="flex min-h-0 shrink-0 items-center justify-center overflow-hidden rounded-md bg-black p-0.5 shadow-[0_2px_8px_rgba(0,0,0,0.4)] md:rounded-lg md:p-1 max-w-[min(30vw,7.5rem)] md:max-w-[8.5rem]"
            style={footerMascotBoxStyle}
          >
            <img
              src={logoSingle}
              alt="Borcovna panáček"
              className={
                footerBandPx > 0
                  ? "max-h-full max-w-full min-h-0 min-w-0 h-auto w-auto object-contain brightness-110 contrast-125"
                  : "h-auto max-h-32 w-auto max-w-full object-contain brightness-110 contrast-125 md:max-h-36"
              }
            />
          </div>
        </div>
      </footer>

      <Sheet open={isContactOpen} onOpenChange={setIsContactOpen}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className="bg-black/95 border-border/30 flex flex-col items-center justify-center gap-6 max-h-[92dvh] overflow-y-auto w-full max-w-md mx-auto md:left-1/2 md:right-auto md:top-1/2 md:bottom-auto md:h-auto md:max-h-[90vh] md:w-[min(100vw-2rem,28rem)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg md:border md:shadow-2xl"
        >
          <div className="w-full max-w-sm">
            <SheetHeader className="text-left mb-6">
              <SheetTitle className="text-white text-[15px] md:text-lg font-bold tracking-wide uppercase">
                Napište nám
              </SheetTitle>           
            </SheetHeader>

            {formStatus === "sent" ? (
              <div className="flex flex-col items-center justify-center gap-4 text-center py-12">
                <p className="text-primary tracking-wide uppercase text-[15px] md:text-lg font-semibold">Zpráva odeslána!</p>
                <p className="text-white text-[15px] md:text-lg">Ozveme se vám co nejdříve.</p>
                <button
                  onClick={() => {
                    setFormStatus("idle");
                    setFormError("");
                  }}
                  className="text-[15px] md:text-lg text-white hover:text-foreground underline mt-4 transition-colors"
                >
                  Odeslat další dotaz
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 text-white">
                <Input
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  placeholder="Nechte prázdné"
                  value={honeypot}
                  onChange={e => setHoneypot(e.target.value)}
                  className="hidden"
                />
                <Input
                  placeholder="Jméno"
                  value={formData.jmeno}
                  onChange={e => setFormData(p => ({ ...p, jmeno: e.target.value }))}
                  className="bg-muted/30 border-border/40 placeholder:text-white/50 text-white text-[15px] md:text-lg"
                  data-testid="input-jmeno"
                />
                <Input
                  placeholder="Telefon (povinný údaj)"
                  value={formData.telefon}
                  onChange={e => setFormData(p => ({ ...p, telefon: e.target.value }))}
                  className="bg-muted/30 border-border/40 placeholder:text-white/50 text-white text-[15px] md:text-lg"
                  data-testid="input-telefon"
                />
                <Input
                  placeholder="E-mail"
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                  className="bg-muted/30 border-border/40 placeholder:text-white/50 text-white text-[15px] md:text-lg"
                  data-testid="input-email"
                />
                <Textarea
                  placeholder="Váš dotaz"
                  value={formData.dotaz}
                  onChange={e => setFormData(p => ({ ...p, dotaz: e.target.value }))}
                  className="bg-muted/30 border-border/40 placeholder:text-white/50 min-h-28 resize-none text-white text-[15px] md:text-lg"
                  data-testid="input-dotaz"
                />
                {formStatus === "error" && (
                  <p className="text-red-500 text-[15px] md:text-lg">{formError || "Nepodařilo se odeslat zprávu. Zkuste to prosím znovu."}</p>
                )}
                <button
                  type="submit"
                  disabled={formStatus === "sending"}
                  data-testid="button-contact-submit"
                  className="mt-1 bg-primary text-primary-foreground px-6 py-3 text-[15px] md:text-lg uppercase tracking-wide font-semibold disabled:opacity-50 hover:brightness-110 active:scale-95 transition-all duration-200"
                >
                  {formStatus === "sending" ? "Odesílám..." : "Odeslat"}
                </button>
              </form>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/foto" component={Upload} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;