import { useState, useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { motion, AnimatePresence } from "framer-motion";
import { CookingPot, DoorOpen, Baby, Package, Droplets } from "lucide-react";

import logoGroup from "@assets/IMG-20260410-WA0002_1775846111566.jpg";
import logoSingle from "@assets/IMG-20260410-WA0001_1775846111605.jpg";
import furn1 from "@assets/IMG-20251015-WA0006_1775846111618.jpg";
import furn2 from "@assets/IMG-20251015-WA0005_1775846111635.jpg";
import furn3 from "@assets/IMG-20251015-WA0004_1775846111652.jpg";
import furn4 from "@assets/IMG-20251015-WA0002_1775846111664.jpg";
import furn5 from "@assets/IMG-20251015-WA0003_1775846111675.jpg";
import furn6 from "@assets/IMG-20251015-WA0001_1775846111686.jpg";
import furn7 from "@assets/IMG-20251015-WA0000_1775846111696.jpg";

const queryClient = new QueryClient();

const sections = [
  { id: "kuchyne", label: "Kuchyně", icon: CookingPot },
  { id: "predsine", label: "Předsíně", icon: DoorOpen },
  { id: "detske", label: "Dětské pokoje", icon: Baby },
  { id: "skrine", label: "Skříně", icon: Package },
  { id: "koupelny", label: "Koupelny", icon: Droplets },
];

const photos = {
  kuchyne: [furn2, furn5, furn6, furn3, furn4],
  predsine: [furn1, furn7, furn4, furn2, furn6],
  detske: [furn3, furn6, furn1, furn5, furn7],
  skrine: [furn5, furn6, furn1, furn7, furn2],
  koupelny: [furn4, furn3, furn7, furn6, furn1],
};

function Home() {
  const [activeSection, setActiveSection] = useState(sections[0].id);

  // Force dark mode class on html
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <div className="min-h-screen w-full flex flex-col items-center">
      {/* Hero / Header */}
      <header className="w-full flex flex-col items-center pt-16 pb-12 px-6 gap-8">
        <div className="flex flex-col md:flex-row items-center justify-center gap-6">
          <img 
            src={logoGroup} 
            alt="Borcovna Logo" 
            className="w-48 md:w-64 object-contain brightness-110 contrast-125" 
          />
          <img 
            src={logoSingle} 
            alt="Borcovna Logo Mark" 
            className="w-32 md:w-40 object-contain brightness-110 contrast-125 hidden md:block" 
          />
        </div>
      </header>

      {/* Navigation – sticky */}
      <nav className="sticky top-0 z-50 w-full px-6 py-4 flex justify-center gap-8 md:gap-16 bg-background/90 backdrop-blur-sm border-b border-border/30">
        {sections.map((section) => {
          const isActive = activeSection === section.id;
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              data-testid={`nav-${section.id}`}
              className={`flex flex-col items-center gap-2 transition-colors duration-300 ${
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="relative">
                <Icon size={28} strokeWidth={1.5} />
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute -inset-3 border border-primary opacity-50"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </div>
              <span className={`text-xs uppercase tracking-widest font-semibold transition-opacity duration-300 ${isActive ? "opacity-100" : "opacity-0 h-0 overflow-hidden"}`}>
                {section.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Gallery */}
      <main className="w-full max-w-6xl px-6 pt-10 pb-24 flex-grow flex flex-col items-center">
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

      {/* Footer */}
      <footer className="w-full py-12 flex flex-col sm:flex-row justify-center items-center gap-6 sm:gap-12 border-t border-border/50">
        <a
          href="mailto:borcovna@roberton.cz"
          data-testid="link-email"
          className="text-muted-foreground hover:text-primary transition-colors tracking-widest text-sm"
        >
          borcovna@roberton.cz
        </a>
        <span className="hidden sm:block text-border/60">|</span>
        <a
          href="tel:+420606836630"
          data-testid="link-phone"
          className="text-muted-foreground hover:text-primary transition-colors tracking-widest text-sm"
        >
          606 836 630
        </a>
      </footer>
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
