import { useState, useEffect, useCallback } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
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

function Home() {
  const [activeSection, setActiveSection] = useState(sections[0].id);
  const [photos, setPhotos] = useState<Record<string, string[]>>({});

useEffect(() => {
  sections.forEach(async (section) => {
    const res = await fetch(`/.netlify/functions/get-photos?gallery=${section.id}`);
    const data = await res.json();
    setPhotos(prev => ({ ...prev, [section.id]: data.photos ?? [] }));
  });
}, []);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [formData, setFormData] = useState<FormData>({ jmeno: "", telefon: "", email: "", dotaz: "" });
  const [formStatus, setFormStatus] = useState<FormStatus>("idle");
  const isMobile = useIsMobile();

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.telefon.trim()) return;
    setFormStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setFormStatus("sent");
        setFormData({ jmeno: "", telefon: "", email: "", dotaz: "" });
      } else {
        setFormStatus("error");
      }
    } catch {
      setFormStatus("error");
    }
  }, [formData]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center pb-32 md:pb-24">
      <header className="w-full flex flex-col items-center pt-12 pb-4 px-6 gap-6">
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
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 border border-primary opacity-50"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <Icon size={22} strokeWidth={1.5} className="md:w-7 md:h-7" />
              <span className={`text-[10px] md:text-xs uppercase tracking-tight md:tracking-widest font-semibold transition-colors duration-300 leading-tight text-center ${isActive ? "text-primary" : "text-muted-foreground"}`}>
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
            {photos[activeSection as keyof typeof photos].length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                {photos[activeSection as keyof typeof photos].map((photo, i) => (
                  <div key={i} className="group relative overflow-hidden bg-muted aspect-square">
                    <img
                      src={photo}
                      alt={`Furniture gallery ${i}`}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-500" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="w-full py-32 flex justify-center items-center">
                <p className="text-muted-foreground tracking-widest uppercase text-sm">Fotky přibývají</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-40 w-full bg-background/85 backdrop-blur-sm border-t border-border/50 py-3 md:py-4 flex items-center justify-center gap-2 md:gap-6 px-2 md:px-6">
        <div className="flex items-center justify-end flex-1 min-w-0">
          <img src={logoSingle} alt="Borcovna panáček" className="w-10 h-10 md:w-12 md:h-12 object-contain brightness-110 contrast-125 sm:scale-x-[-1]" />
        </div>
        <a
          href="mailto:borcovna@roberton.cz"
          data-testid="link-email"
          className="text-white hover:text-primary transition-colors tracking-widest text-[10px] md:text-sm text-center truncate"
        >
          borcovna@roberton.cz
        </a>
        <a
          href="tel:+420606836630"
          data-testid="link-phone"
          className="flex items-center gap-1 md:gap-2 text-white hover:text-primary transition-colors tracking-widest text-[10px] md:text-sm text-center truncate"
        >
          <Phone size={12} className="md:w-[14px] md:h-[14px]" strokeWidth={1.5} />
          606 836 630
        </a>
        <div className="flex items-center justify-start flex-1 min-w-0">
          <img src={logoSingle} alt="Borcovna panáček" className="w-10 h-10 md:w-12 md:h-12 object-contain brightness-110 contrast-125" />
        </div>
      </footer>

      <button
        onClick={() => { setIsContactOpen(true); setFormStatus("idle"); }}
        data-testid="button-contact-open"
        className="fixed bottom-20 md:bottom-24 right-6 z-50 flex items-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-full shadow-xl hover:brightness-110 active:scale-95 transition-all duration-200"
      >
        <MessageSquare size={18} strokeWidth={1.5} />
        <span className="text-sm font-semibold tracking-widest uppercase hidden sm:block">Napište nám</span>
      </button>

      <Sheet open={isContactOpen} onOpenChange={setIsContactOpen}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className="bg-background border-border/30 flex flex-col gap-6 max-h-[92dvh] overflow-y-auto"
        >
          <SheetHeader className="text-left">
            <SheetTitle className="text-white text-base font-bold tracking-widest uppercase">
              Máte nějaké dotazy?
            </SheetTitle>
            <SheetDescription className="text-white text-sm">
              Napište nám
            </SheetDescription>
          </SheetHeader>

          {formStatus === "sent" ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center py-12">
              <p className="text-primary tracking-widest uppercase text-sm font-semibold">Zpráva odeslána!</p>
              <p className="text-white text-xs">Ozveme se vám co nejdříve.</p>
              <button
                onClick={() => setFormStatus("idle")}
                className="text-xs text-white hover:text-foreground underline mt-4 transition-colors"
              >
                Odeslat další dotaz
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-white">
              <Input
                placeholder="Jméno"
                value={formData.jmeno}
                onChange={e => setFormData(p => ({ ...p, jmeno: e.target.value }))}
                className="bg-muted/30 border-border/40 placeholder:text-white/50 text-white"
                data-testid="input-jmeno"
              />
              <Input
                placeholder="Telefon (povinný údaj)"
                required
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
                <p className="text-destructive text-xs">Nepodařilo se odeslat zprávu. Zkuste to prosím znovu.</p>
              )}
              <button
                type="submit"
                disabled={formStatus === "sending" || !formData.telefon.trim()}
                data-testid="button-contact-submit"
                className="mt-1 bg-primary text-primary-foreground px-6 py-3 text-sm uppercase tracking-widest font-semibold disabled:opacity-50 hover:brightness-110 active:scale-95 transition-all duration-200"
              >
                {formStatus === "sending" ? "Odesílám..." : "Odeslat"}
              </button>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
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
