# ORA — pubblicare online il prototipo (gratis, solo browser)

Non serve installare nulla sul computer: si fa tutto da GitHub e Vercel, via browser.

## Passo 1 — Carica il progetto su GitHub

1. Vai su **github.com** e crea un account gratuito (se non ce l'hai già)
2. In alto a destra tocca **+** → **New repository**
3. Dai un nome, es. `ora-app` → **Create repository**
4. Nella pagina del repository appena creato, cerca il link **"uploading an existing file"**
5. Trascina dentro **tutti e 6 i file** di questo progetto: `index.html`, `main.jsx`, `App.jsx`, `package.json`, `vite.config.js`, `README.md` — tutti insieme, senza cartelle (devono finire tutti nella stessa cartella principale del repository)
6. In basso scrivi un messaggio a piacere (es. "Prima versione") → **Commit changes**

## Passo 2 — Collega Vercel

1. Vai su **vercel.com** e registrati usando lo stesso account GitHub ("Continue with GitHub")
2. Tocca **Add New... → Project**
3. Seleziona il repository `ora-app` che hai appena caricato → **Import**
4. Vercel riconosce da solo che è un progetto Vite: lascia le impostazioni come sono
5. Tocca **Deploy** e aspetta 1-2 minuti

Al termine ti dà un link pubblico tipo `ora-app-tuonome.vercel.app` — quello è l'app vera, live, che puoi aprire da qualsiasi telefono o computer e anche mostrare al Comune.

## Passo 3 — Verifica il backend

Una volta online, apri il link, crea una segnalazione di prova e controlla in **Profilo**: se dice "Dati: Segnalazioni salvate in modo permanente", il collegamento a Supabase funziona davvero (fuori dall'anteprima di Claude non ci sono i blocchi che probabilmente hai incontrato finora).

## Aggiornamenti futuri

Ogni volta che vorrai aggiornare l'app, basterà ripetere il passo 1 (carichi i file nuovi su GitHub) — Vercel ripubblica automaticamente da solo in un paio di minuti, senza bisogno di rifare nulla su Vercel.
