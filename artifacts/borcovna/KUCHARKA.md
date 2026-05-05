# Borcovna (roberton.cz) — kuchařka pro laika

Tento dokument popisuje, **z čeho web skládá**, **kde co leží v repu** a **jak to spolu mluví**. Až se k tomu vrátíš za půl roku, začni tady.

---

## Přehled návazností (kdo za co ručí)

Jednoduchý řetězec od domény po schránku — každá část dělá něco jiného:

| Kus | Role |
|-----|------|
| **Wedos** | Typicky **registrace domény** (např. `roberton.cz`) a někdy i základní DNS. Často se jen nastaví **nameservery na Cloudflare** — pak už „směrování“ domény řeší spíš Cloudflare než Wedos. |
| **Cloudflare** | **DNS** (kam míří `roberton.cz`, `www`, případně subdoména pro obrázky), **Pages** = běh samotného webu Borcovna (HTML/JS z buildu), **Workers** = malé programy pro formulář a fotky, **R2** = úložiště souborů fotek. To je hlavní provozní „stroj“ kolem webu. |
| **Resend** | Samostatná služba **jen na odesílání e-mailů**. Cloudflare Worker (contact-form) ji zavolá přes API; Resend doručí zprávu do schránky **borcovna@roberton.cz** (nebo kam máš v workeru nastaveno). Web s Resendem přímo nemluví — mluví jen Worker. |
| **GitHub** | **Úložiště zdrojového kódu** a **automatický deploy**: po pushi na větev (např. `main`) GitHub Actions sestaví Borcovnu a nahraje výstup na Cloudflare Pages. Bez GitHubu by šlo nahrát build ručně, ale zvyk je řídit verze tady. |
| **Borcovna** | **Konkrétní webová aplikace** v tomto repu (`artifacts/borcovna`) — to, co uživatel vidí (galerie, zápatí, formulář, `/foto`). Je to jen „front-end“; sama o sobě neumí držet fotky ani posílat poštu — spoléhá na Workery výše. |

**Tok v jedné větě:** návštěvník otevře **doménu** (Wedos → DNS často **Cloudflare**) → načte se stránka z **Cloudflare Pages** (**Borcovna**) → galerie a formulář volají **Cloudflare Workers** → fotky z/ do **R2**, dotazy z formuláře přes Worker dál na **Resend** → e-mail u tebe v poště. Nová verze stránky přichází z **GitHubu** po buildu v CI.

---

## 1. Co vlastně „Borcovna“ je

- **Jedna React aplikace** v monorepu `Web-roberton`, balíček `@workspace/borcovna`, složka `artifacts/borcovna/`.
- **Nasazuje se jako statické soubory** na **Cloudflare Pages** (projekt typicky `roberton`). Žádný Node server u hostingu neběží — prohlížeči stačí HTML + JS + CSS.
- **Dynamické věci** (e-mail z formuláře, seznam fotek, nahrání, smazání) dělají **Cloudflare Workery** a úložiště **R2** (objekty jako soubory ve „skříni“ v cloudu).
- **E-mail z kontaktu neposílá prohlížeč přímo** — pošle jen JSON na **contact-form** Worker; ten přes službu **Resend** (API klíč v secretu workeru) odešle skutečný e-mail typicky na **borcovna@roberton.cz** (stejná adresa jako v zápatí webu). Bez Workeru + Resend by se z čistého statického webu pošta neodeslala.

Laicky: stránka je „obal“, data a akce jdou přes malé programy na Cloudflare; pošta jde přes Resend jako „poštovní službu v cloudu“.

---

## 2. Kde v repozitáři hledat co

| Co | Soubor / složka |
|----|------------------|
| Hlavní stránka (galerie, zápatí, kontaktní sheet) | `src/App.tsx` |
| Administrace fotek (nahrát / smazat) | `src/pages/upload.tsx` |
| 404 | `src/pages/not-found.tsx` |
| Routy (`/` a `/foto`) | `src/App.tsx` → funkce `Router` |
| Styly, Tailwind | `src/index.css`, `tailwind.config.*` |
| Build / dev server | `vite.config.ts`, `package.json` |
| SPA fallback na produkci (aby `/foto` fungovalo po refreshi) | `public/_redirects` |
| Lokální adresy API (necommitovat do gitu) | `.env.local` (šablona chování níž) |
| Automatický deploy z GitHubu | `Web-roberton/.github/workflows/deploy-borcovna-pages.yml` |
| Krátké provozní poznámky | `Web-roberton/scripts/notes.md` |

**Workery** (get-photos, upload-photo, delete-photo, contact-form) **nejsou** v tomto repu — žijí v Cloudflare Dashboard jako samostatné projekty / soubory, které tam nasazuješ ty (nebo máš jinde).

---

## 3. Jak se aplikace spustí lokálně

Z kořene monorepu `Web-roberton`:

```bash
pnpm install
pnpm --filter @workspace/borcovna run dev
```

V prohlížeči obvykle `http://localhost:5173` (Vite vypíše přesnou URL).

Build (stejné jako v CI):

```bash
pnpm --filter @workspace/borcovna run build
```

Výstup: `artifacts/borcovna/dist/public/` — **tohle** se nahrává na Pages.

---

## 4. Závislosti (co to je, laicky)

- **React** — rozhraní, komponenty.
- **Vite** — sestavení a vývojový server.
- **TypeScript** — kód s typy, méně hloupých chyb.
- **Tailwind CSS** — styly přes třídy v HTML/JSX.
- **Wouter** — jednoduché routování (`/` = domovská stránka, `/foto` = upload).
- **Framer Motion** — jemné animace (galerie).
- **Radix / shadcn-style UI** — dialogy, sheet (kontaktní formulář), tooltip atd. (většina je v `src/components/ui/`).
- **Lucide** — ikony.
- **TanStack Query** — připraveno pro dotazy na API (u Borcovny minimálně; aplikace ho obaluje v `App`).

Balíčky jsou v `package.json`; celý monorep používá **pnpm** a workspace.

---

## 5. Routy a co uživatel vidí

- **`/`** — veřejná stránka: logo, záložky galerií (Kuchyně, Předsíně, …), mřížka fotek, zápatí s e-mailem a telefonem, červené tlačítko **Napište nám** (otevře formulář).
- **`/foto`** — jednoduchá **„administrace“ fotek**: heslo, výběr galerie, nahrání více souborů, po zadání hesla i seznam fotek v galerii a **Smazat**.

Na produkci musí fungovat přímý odkaz a refresh na `/foto` — proto je v `public/_redirects` pravidlo, které pošle požadavky na `index.html` (SPA).

---

## 6. Napojení na Cloudflare (env proměnné)

Vite proměnné musí začínat **`VITE_`**, aby je prohlížeč viděl.

Typicky v **`.env.local`** (jen u tebe na počítači):

```env
VITE_CONTACT_ENDPOINT=https://…contact…/
VITE_GET_PHOTOS_ENDPOINT=https://…get-photos…/
VITE_UPLOAD_PHOTO_ENDPOINT=https://…upload-photo…/
VITE_DELETE_PHOTO_ENDPOINT=https://…delete-photo…/
```

V **kódu** jsou výchozí URL jako záloha, ale na produkci je lepší mít vše v env u **buildu** Pages (Environment variables), aby šlo endpointy měnit bez změny kódu.

### `VITE_*` URL v `App.tsx` (kontakt + get-photos)

U **`VITE_CONTACT_ENDPOINT`** a **`VITE_GET_PHOTOS_ENDPOINT`** platí v `App.tsx` toto:

- Hodnota z env se použije **jen pokud je neprázdný řetězec po `trim()`**.
- Kdyby v Cloudflare Pages byla u buildu nastavená **prázdná** proměnná (`""`), operátor `??` by výchozí URL **nepoužil** — ve výsledném JS by byl prázdný řetězec a `fetch` by mířil špatně (např. na origin webu). Proto je v kódu ošetření mimo čisté `??`.

Ostatní endpointy fotek (`VITE_UPLOAD_*`, `VITE_DELETE_*`) řeší jiné soubory; u nich případně stejný princip doplníš při úpravách.

### Co kde musí být nastavené (mimo tento repozitář)

| Worker / služba | Účel |
|-----------------|------|
| **get-photos** | GET `?gallery=kuchyne` → JSON se seznamem fotek (klíče + URL na CDN). |
| **upload-photo** | POST JSON (heslo, galerie, jméno souboru, typ, base64) → uloží do R2. |
| **delete-photo** | POST JSON (heslo, galerie, key) → smaže objekt v R2. |
| **contact-form** | Prohlížeč pošle **POST** `application/json`. V `App.tsx` se posílají **oba názvy polí** najednou: česky `jmeno`, `telefon`, `email`, `dotaz` a anglicky `name`, `phone`, `message` (stejné hodnoty) — kvůli kompatibilitě s workerem i s případnou Netlify funkcí `netlify/functions/contact.ts` v repu (ta čte jen české klíče). Worker zavolá **Resend API** (secret např. `RESEND_API_KEY`) a nechá doručit zprávu na **borcovna@roberton.cz** (příjemce nastavíš v kódu / env workeru — musí sedět s provozem schránky Borcovna). |

Společné pro fotky (podle tvých poznámek):

- **R2 binding** v workeru např. `BORCOVNA_PHOTOS` (název musí sedět s kódem workeru).
- **`UPLOAD_PASSWORD`** — secret; stejné heslo používá stránka `/foto`.
- **`ALLOWED_ORIGINS`** — CORS: domény, ze kterých smí prohlížeč volat API (např. `https://roberton.cz`, `https://www.roberton.cz`, …).
- **`IMAGES_BASE_URL`** — základ URL pro veřejné odkazy na obrázky (např. `https://images.roberton.cz`).
- U **contact-form** workeru navíc typicky **API klíč Resend** a v kódu workeru nastavený **příjemce** (Borcovna) a **ověřená odesílací doména** v Resend — bez toho Resend zprávu nepřijme nebo spadne na 401/403.

**Galerie** mají v kódu webu i ve workerech **stejné identifikátory** (např. `kuchyne`, `predsine`, … včetně novějších jako `loznice`, `obyvaci`, `recepce`, `satny`). Přidáš-li novou sekci, musíš ji přidat **na třech místech**: `App.tsx` (`sections`), `upload.tsx` (`GALLERIES`) a **allowlist ve všech příslušných workerech**.

### Kódy u fotek (co znamenají a kdy přijdou z API)

- Na webu se u každé fotky zobrazí **identifikátor odvozený z klíče v R2** (typicky `KU-1735123456789` z klíče `kuchyne/1735123456789-nazev.jpg`), pokud worker ještě neposílá pole `code`.
- **Varianta 2 (doporučená):** upload worker při uložení přidělí stabilní kód (např. `KU-104`) a **get-photos** ho vrátí v JSON (`code`). Pak se na webu zobrazí přesně toto číslo — vhodné pro telefonické poptávky.
- **Existující fotky:** nemusíš je kvůli číslu hromadně mazat a nahrávat znovu; do doby úpravy workeru stačí odvozený kód z času v názvu souboru. Po nasazení workeru s `code` se začnou ukazovat „pravá“ čísla u nově nahraných (a případně po migraci i u starých).

---

## 7. Jak proudí data (zjednodušeně)

### Galerie na hlavní stránce

1. Po načtení stránky `App.tsx` pro každou sekci zavolá **GET** na get-photos worker s `gallery=…`.
2. Worker vypíše objekty v R2 s prefixem `kuchyne/` atd. a vrátí veřejné **URL**.
3. React vykreslí mřížku fotek a pod každou fotkou **štítek s kódem** (viz výše). Při přepnutí galerie a návratu se stránka posune k **naposledy prohlížené** fotce (jen v rámci relace v prohlížeči). Když se obrázek nenačte, URL se uloží do množiny chyb a položka se skryje.

### Kontaktní formulář („Napište nám“)

1. Uživatel vyplní sheet na webu a klikne **Odeslat** — z prohlížeče **neodchází SMTP**, jen **HTTPS POST** s JSON tělem na adresu `VITE_CONTACT_ENDPOINT` (contact-form Worker).
2. JSON obsahuje pole **`jmeno`, `telefon`, `email`, `dotaz`** a zároveň **`name`, `phone`, `message`** (stejné hodnoty), aby fungoval worker bez ohledu na to, kterou sadu klíčů v těle očekává.
3. V `App.tsx` je navíc **honeypot** (skryté pole pro boty) a kontrola, že **telefon** má smysluplný počet číslic; to je jen na klientovi — důležitá validace patří i do workeru. Pokud honeypot vyplní bot (nebo výjimečně prohlížeč), stránka ukáže úspěch **bez** odeslání na server.
4. **contact-form** Worker přijme JSON, zpracuje ho a přes **Resend** odešle e-mail na schránku **Borcovny** (cílová adresa je v workeru / jeho env — na webu v zápatí je zobrazená **borcovna@roberton.cz**, kam má dotaz fyzicky dojít).
5. Worker vrátí JSON (úspěch / chyba); stránka zobrazí potvrzení nebo hlášku o chybě.

**Shrnutí:** formulář = jen rozhraní; **odeslání pošty = Worker + Resend → borcovna@roberton.cz** (ne přímé „odeslání z formuláře“ bez backendu). **Doručenka** `borcovna@` je na **Wedosu** (MX domény), ne v Cloudflare.

### Nahrání fotky (`/foto`)

1. Výběr až **20 platných obrázků** najednou (větší počet se usekne, zobrazí se hláška).
2. Každý soubor: kontrola typu `image/*`, max. velikost (v kódu např. 15 MB před resize), zmenšení na JPEG v prohlížeči, pak POST na upload worker s **heslem**.
3. Worker ověří heslo, galerii, typ, velikost, uloží do R2 pod klíčem např. `kuchyne/1735123456789-nazev.jpg` (prefix = id galerie).

**Poznámka:** limit 20 je **jen v UI**. Kdo by volal API ručně po jednom souboru, limit obejde — pro běžné použití to stačí.

### Smazání fotky

1. Po načtení seznamu má každá položka `key` a `url`.
2. Smazat = POST na delete worker s heslem, galerií a **key**, který musí začínat na stejný prefix jako galerie (např. `kuchyne/…` při výběru Kuchyně).

---

## 8. Deploy (GitHub → Cloudflare Pages)

Workflow **`deploy-borcovna-pages.yml`** při pushi na `main` (nebo ručně *workflow_dispatch*):

1. `pnpm install --frozen-lockfile`
2. `pnpm --filter @workspace/borcovna run build`
3. `wrangler pages deploy artifacts/borcovna/dist/public --project-name roberton`

Na GitHubu musí být secrets **`CLOUDFLARE_API_TOKEN`** a **`CLOUDFLARE_ACCOUNT_ID`**.

Proměnné `VITE_*` pro produkční build nastav v **Cloudflare Pages → projekt → Settings → Environment variables** (build time), aby se správné URL dostaly do bundle.

---

## 9. Bezpečnost — laický přehled

- **Formulář a text na stránce** — React běžně nevpisuje HTML z polí „naslepo“; hlavní rizika řeší worker (spam, délky polí, …).
- **Fotky** — veřejné čtení je přes get-photos (galerie z allowlistu). Zápis/smazání jen s **heslem** v workeru.
- **Volitelná vylepšení do budoucna** (není nutné hned): Content-Security-Policy na Pages, přísnější kontrola URL z API na frontendu, u uploadu kontrola „magických bajtů“ souboru, rate limit na workerech.

---

## 10. Rychlá kontrola po změnách

- [ ] `/` — galerie, zápatí, tlačítko kontaktu (mobil i desktop).
- [ ] `/foto` — nahrání, mazání, špatné heslo hlásí chybu.
- [ ] Formulář odešle zprávu (Worker + Resend) a e-mail dorazí na **borcovna@roberton.cz** (v DevTools → Network ověř POST na worker URL a stav odpovědi).
- [ ] Zkus z jiné schránky poslat běžný mail na **borcovna@roberton.cz** — když ani ten nedorazí, problém není ve formuláři, ale v **MX / Wedosu** (viz §11).
- [ ] V konzoli prohlížeče žádný CORS error.
- [ ] Po deployi refresh na `https://roberton.cz/foto` funguje (díky `_redirects`).

---

## 11. Když něco „nejde“

1. **CORS** — chybí nebo špatně je `ALLOWED_ORIGINS` na workeru vs. adresa, z které stránku otevíráš (`www` vs bez `www`).
2. **404 na `/foto`** po deployi — chybí nebo je špatně `_redirects` v `public/` (musí být ve výstupu `dist/public`).
3. **Prázdná galerie** — špatný `VITE_GET_PHOTOS_ENDPOINT`, nebo v R2 pod jiným prefixem, nebo worker nevidí bucket.
4. **Build v CI padá** — Node/pnpm verze jako ve workflow; lokálně `pnpm install` a znovu build.
5. **Formulář v UI úspěch, ale v schránce nic** — postupuj od **prohlížeče ven**, ať nehádáš naslepo:
   - **Network** (F12): je požadavek na správnou URL workeru? Stav **200** a tělo např. `{"ok":true}`? Při chybě čti tělo odpovědi.
   - **Resend** (dashboard): je zpráva v logu? Stav **Delivered** znamená, že Resend předal zprávu na **mailový server určený MX záznamy** pro `roberton.cz` (typicky Wedos). To už **není chyba Cloudflare Workeru ani front-endu**.
   - **Cloudflare → DNS → MX** pro **jméno `roberton.cz`** (root / `@`): měly by být záznamy na **`wes1-mx1.wedos.net`**, **`wes1-mx2.wedos.net`**, případně backup Wedosu. Záznamy typu MX jen u subdomény **`send`** (např. Amazon SES) se týkají **odesílání z `send.roberton.cz`**, ne příjmu na **`něco@roberton.cz`**.
   - **Wedos administrace domény** může hlásit, že doména **nepoužívá wedosovské DNS** — to je v pořádku, když nameservery jsou u **Cloudflare**; důležité je, že **MX pro příjem** jsou v **Cloudflare DNS** správně nastavené na Wedos (viz výše).
   - **Wedos webhosting → schránka `borcovna`**: bez přesměrování, oprávnění příjem zapnuté. Ve **webmailu** zkontroluj i složku **Spam** (u schránky může být zapnutá **samostatná spam složka**; přes **POP3** ji některé klienty nevidí).
   - Když **Resend ukazuje Delivered** a zároveň **běžný mail z osobní schránky na borcovna@ také nedorazí** ani do Spam, je na řadě **Wedos podpora** s časem odeslání a případně **Message-ID** z Resend — ať dohledají SMTP log na jejich MX.
6. **Resend API / worker** — platnost API klíče, ověřená doména odesílatele v Resend, v kódu workeru správná adresa **`to`** a že při chybě Resend worker nevrací falešné `ok: true`.

---

*Tento soubor můžeš kdykoliv doplnit vlastními poznámkami (např. přesné názvy Workers, ID domény v Resend).*
