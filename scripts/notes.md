# Poznámky k webu Roberton

## Aktuální stav
- Web běží na Cloudflare (`roberton.cz`, `www.roberton.cz`)
- Formulář odesílá e-maily přes `contact-form` worker + Resend
- Galerie: `get-photos`, `upload-photo`, `delete-photo` napojené na R2 (`roberton-photos`)
- Upload/mazání přes `/foto` funguje

## Důležité nastavení
- `ALLOWED_ORIGINS`:
  - https://roberton.cz
  - https://www.roberton.cz
  - https://roberton.pages.dev
  - http://localhost:5173
- `UPLOAD_PASSWORD`: jen jako Secret (nikdy ne v kódu)
- R2 binding: `BORCOVNA_PHOTOS`

## Jak nasadit novou verzi (stručně)
1. Upravit kód lokálně
2. Otestovat na localhost
3. Build: `pnpm --filter @workspace/borcovna run build`
4. Deploy do Cloudflare Pages (upload `artifacts/borcovna/dist/public`) nebo přes Git CI
5. Ověřit `roberton.cz` + `/foto` + formulář

## Kontrolní test po deployi
- [ ] Web se načte na mobilu i desktopu
- [ ] Formulář odešle e-mail
- [ ] Upload fotky funguje
- [ ] Mazání fotky funguje
- [ ] Žádný CORS error v konzoli

## Co doladit příště
- [ ] Plně přejít na Git-based deployment (auto deploy po pushi)
- [ ] Sjednotit CORS a env mezi všemi workery
- [ ] Přidat jednoduchý anti-spam/rate limit u uploadu/formuláře

Opravy: 1. formulář v desktopu je přilepen napravo, vystředit