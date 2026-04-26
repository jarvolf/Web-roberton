import Upload from "@/pages/upload";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import NotFound from "@/pages/not-found";
import { motion, AnimatePresence } from "framer-motion";
import { CookingPot, DoorOpen, Baby, Package, Droplets, Phone, MessageSquare } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

import logoGroup from "@assets/IMG-20260410-WA0002_1775846111566.jpg";
import logoSingle from "@assets/IMG-20260410-WA0001_1775846111605.jpg";

const queryClient = new QueryClient();

const sections = [
  { id: "kuchyne", label: "Kuchyně", icon: CookingPot },
  { id: "predsine", label: "Předsíně", icon: DoorOpen },
  { id: "detske", label: "Dětské pokoje", icon: Baby },
  { id: "skrine", label: "Skříně", icon: Package },
  { id: "koupelny", label: "Koupelny", icon: Droplets },
];

type FormData = { jmeno: string; telefon: string; email: string; dotaz: string };
type FormStatus = "idle" | "sending" | "sent" | "error";
const CONTACT_FORM_ENDPOINT = import.meta.env.VITE_CONTACT_ENDPOINT ?? "https://contact-form.jarvolf93.workers.dev/";
const GET_PHOTOS_ENDPOINT = import.meta.env.VITE_GET_PHOTOS_ENDPOINT ?? "https://get-photos.jarvolf93.workers.dev/";

/** URL pro zobrazení — get-photos může vracet string nebo objekt { url, key }. */
function photoUrlFromApiItem(item: unknown): string | null {
  if (typeof item === "string" && item.trim()) return item.trim();
  if (item && typeof item === "object" && typeof (item as { url?: unknown }).url === "string") {
    const u = (item as { url: string }).url.trim();
    return u || null;
  }
  return null;
}

function Home() {
  const [activeSection, setActiveSection] = useState(sections[0].id);
  const [photos, setPhotos] = useState<Record<string, string[]>>({});
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [formData, setFormData] = useState<FormData>({ jmeno: "", telefon: "", email: "", dotaz: "" });
  const [honeypot, setHoneypot] = useState("");
  const [formStatus, setFormStatus] = useState<FormStatus>("idle");
  const [formError, setFormError] = useState("");
  /** URL fotek, které se nepodařilo načíst — úplně je skryjeme (žádný broken icon / rámeček). */
  const [failedGalleryUrls, setFailedGalleryUrls] = useState<Set<string>>(() => new Set());
  const isMobile = useIsMobile();

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
      const urls = raw.map(photoUrlFromApiItem).filter((u): u is string => u !== null);
      setPhotos(prev => ({ ...prev, [section.id]: urls }));
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
  const visibleGalleryPhotos = useMemo(
    () => currentPhotos.filter((url) => !failedGalleryUrls.has(url)),
    [currentPhotos, failedGalleryUrls],
  );

  return (
    <div className="min-h-screen w-full flex flex-col items-center pb-32 md:pb-24">
      <header className="w-full flex flex-col items-center pt-2 pb-4 px-6 gap-4 md:gap-6 md:pt-12">
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-5xl md:text-7xl font-black tracking-tight text-white leading-none">
            ROBERTON.CZ
          </h1>
          <p className="text-xs md:text-sm tracking-[0.3em] uppercase text-white font-medium">
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

      <nav className="sticky top-0 z-50 w-full px-2 md:px-6 py-3 flex justify-between bg-background/50 backdrop-blur-sm border-b border-border/30">
        {sections.map((section) => {
          const isActive = activeSection === section.id;
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              data-testid={`nav-${section.id}`}
              className={`relative flex flex-col items-center gap-1.5 px-1.5 py-2 md:px-3 flex-1 transition-colors duration-300 ${
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
              style={isActive ? { color: "hsl(0, 100%, 50%)" } : undefined}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 border border-primary opacity-50"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <Icon
                size={22}
                strokeWidth={1.5}
                className={`md:w-7 md:h-7 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                style={isActive ? { color: "hsl(0, 100%, 50%)" } : undefined}
              />
              <span
                className={`text-[10px] md:text-xs uppercase tracking-tight md:tracking-widest font-semibold transition-colors duration-300 leading-tight text-center ${isActive ? "!text-primary" : "text-muted-foreground"}`}
                style={isActive ? { color: "hsl(0, 100%, 50%)" } : undefined}
              >
                {section.label}
              </span>
            </button>
          );
        })}
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
            {visibleGalleryPhotos.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                {visibleGalleryPhotos.map((photo) => (
                  <div key={photo} className="group relative overflow-hidden bg-muted aspect-square">
                    <img
                      src={photo}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      onError={() => markGalleryPhotoFailed(photo)}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-500" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-white/50 py-12">
                Žádné fotky v této galerii
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-40 h-[112px] md:h-[132px] w-full bg-background/85 backdrop-blur-sm border-t border-border/50 flex items-stretch justify-center gap-2 md:gap-6 px-2 md:px-6">
        <div className="flex h-full flex-1 min-w-0 items-stretch justify-end py-1 md:py-1.5">
          <img
            src={logoSingle}
            alt="Borcovna panáček"
            className="h-full max-h-full w-auto object-contain brightness-110 contrast-125 scale-x-[-1]"
          />
        </div>
        <div className="flex h-full flex-col items-center justify-center gap-2 py-3 md:py-4 shrink-0">
          <a
            href="mailto:borcovna@roberton.cz"
            data-testid="link-email"
            className="text-white hover:text-primary transition-colors tracking-widest text-base md:text-xl text-center [paint-order:stroke_fill] [-webkit-text-stroke:1px_#000]"
          >
            borcovna@roberton.cz
          </a>
          <a
            href="tel:+420606836630"
            data-testid="link-phone"
            className="flex items-center gap-2 text-white hover:text-primary transition-colors tracking-widest text-base md:text-xl text-center [paint-order:stroke_fill] [-webkit-text-stroke:1px_#000]"
          >
            <Phone
              size={18}
              className="shrink-0 drop-shadow-[0_0_1px_#000,0_0_1px_#000,1px_0_0_#000,-1px_0_0_#000,0_1px_0_#000,0_-1px_0_#000] md:w-[22px] md:h-[22px]"
              strokeWidth={1.5}
            />
            606 836 630
          </a>
        </div>
        <div className="flex h-full flex-1 min-w-0 items-stretch justify-start py-1 md:py-1.5">
          <img
            src={logoSingle}
            alt="Borcovna panáček"
            className="h-full max-h-full w-auto object-contain brightness-110 contrast-125"
          />
        </div>
      </footer>

      <button
        onClick={() => setIsContactOpen(true)}
        className="fixed right-2 md:right-6 bottom-[5.5rem] md:bottom-6 z-40 px-3 py-2 md:px-6 md:py-3 rounded-lg hover:brightness-110 transition-all duration-200 flex items-start md:items-center gap-2 md:gap-3 shadow-lg text-left"
        style={{ backgroundColor: 'hsl(0, 100%, 50%)', color: 'white' }}
        data-testid="button-contact-open"
      >
        <MessageSquare className="w-5 h-5 shrink-0" />
        <span className="flex flex-col leading-tight md:hidden text-[10px] uppercase tracking-wide font-semibold">
          <span>Napište</span>
          <span>nám</span>
        </span>
        <span className="hidden md:inline text-sm uppercase tracking-widest font-semibold">
          Napište nám
        </span>
      </button>

      <Sheet open={isContactOpen} onOpenChange={setIsContactOpen}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className="bg-black/95 border-border/30 flex flex-col items-center justify-center gap-6 max-h-[92dvh] overflow-y-auto w-full max-w-md mx-auto md:left-1/2 md:right-auto md:top-1/2 md:bottom-auto md:h-auto md:max-h-[90vh] md:w-[min(100vw-2rem,28rem)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg md:border md:shadow-2xl"
        >
          <div className="w-full max-w-sm">
            <SheetHeader className="text-left mb-6">
              <SheetTitle className="text-white text-base font-bold tracking-widest uppercase">
                Napište nám
              </SheetTitle>           
            </SheetHeader>

            {formStatus === "sent" ? (
              <div className="flex flex-col items-center justify-center gap-4 text-center py-12">
                <p className="text-primary tracking-widest uppercase text-sm font-semibold">Zpráva odeslána!</p>
                <p className="text-white text-xs">Ozveme se vám co nejdříve.</p>
                <button
                  onClick={() => {
                    setFormStatus("idle");
                    setFormError("");
                  }}
                  className="text-xs text-white hover:text-foreground underline mt-4 transition-colors"
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
                  className="bg-muted/30 border-border/40 placeholder:text-white/50 text-white"
                  data-testid="input-jmeno"
                />
                <Input
                  placeholder="Telefon (povinný údaj)"
                  value={formData.telefon}
                  onChange={e => setFormData(p => ({ ...p, telefon: e.target.value }))}
                  className="bg-muted/30 border-border/40 placeholder:text-white/50 text-white"
                  data-testid="input-telefon"
                />
                <Input
                  placeholder="E-mail"
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                  className="bg-muted/30 border-border/40 placeholder:text-white/50 text-white"
                  data-testid="input-email"
                />
                <Textarea
                  placeholder="Váš dotaz"
                  value={formData.dotaz}
                  onChange={e => setFormData(p => ({ ...p, dotaz: e.target.value }))}
                  className="bg-muted/30 border-border/40 placeholder:text-white/50 min-h-28 resize-none text-white"
                  data-testid="input-dotaz"
                />
                {formStatus === "error" && (
                  <p className="text-red-500 text-sm">{formError || "Nepodařilo se odeslat zprávu. Zkuste to prosím znovu."}</p>
                )}
                <button
                  type="submit"
                  disabled={formStatus === "sending"}
                  data-testid="button-contact-submit"
                  className="mt-1 bg-primary text-primary-foreground px-6 py-3 text-sm uppercase tracking-widest font-semibold disabled:opacity-50 hover:brightness-110 active:scale-95 transition-all duration-200"
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