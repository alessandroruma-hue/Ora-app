import React, { useState, useEffect, useRef } from "react";
import {
  AlertTriangle,
  CloudRain,
  Construction,
  Droplets,
  Zap,
  ChevronLeft,
  Phone,
  MapPin,
  Map as MapIcon,
  Settings,
  Plus,
  Navigation,
  CheckCircle2,
  Bell,
  Flag,
  FileText,
} from "lucide-react";

/* ---------------------------------------------------------
   Design tokens — tema scuro, mappa a schermo intero
   asfalto       #14171A   sfondo schermate
   superficie    #1E2226   card / fogli sopra l'asfalto
   carta         #F1EEE6   testo primario
   grafite       #9DA3A8   testo secondario
   fumo          #6B7278   testo terziario / muto
   linea         #2A2F34   separatori
   rosso         #D9534F   emergenza / CTA
   arancio       #E8792A   allerta media
   giallo        #E8B23C   allerta lieve / segnalata
   verde         #3C8B5C   fonte ufficiale
   blu           #4E8BC4   verificata / servizi (più chiaro per contrasto su scuro)
--------------------------------------------------------- */

const PILOT_CITY = "Ravenna";

const CONTACTS = [
  {
    group: "Emergenze",
    items: [
      { label: "Emergenza unica europea", number: "112", note: "Qualsiasi emergenza" },
      { label: "Vigili del Fuoco", number: "115", note: "Incendi, fughe di gas gravi" },
      { label: "Emergenza sanitaria", number: "118", note: "Persone ferite o in pericolo di vita" },
      { label: "Polizia di Stato", number: "113", note: "Emergenza generale, ordine pubblico" },
    ],
  },
  {
    group: "Sicurezza locale",
    items: [
      {
        label: "Polizia Locale Ravenna",
        number: "0544 219219",
        note: "Urgenze ed emergenze, attivo 24/7 (in alternativa 0544 482999, opzione 1)",
      },
      { label: "Guardia Costiera", number: "1530", note: "Emergenze in mare e sulla costa" },
    ],
  },
  {
    group: "Servizi e guasti",
    items: [
      {
        label: "Pronto intervento acqua",
        number: "800 713 900",
        note: "Hera — guasti, rotture, fognature. Gratuito 24/7",
      },
      {
        label: "Pronto intervento elettrico",
        number: "803 500",
        note: "e-distribuzione — guasti e interruzioni. Gratuito 24/7",
      },
      {
        label: "Pronto intervento gas",
        number: "vedi contatore/bolletta",
        note: "Numero del distributore locale (a Ravenna: Inrete, gruppo Hera)",
      },
    ],
  },
  {
    group: "Informazioni e supporto",
    items: [
      {
        label: "Bollettino Protezione Civile",
        number: "allertameteo.regione.emilia-romagna.it",
        note: "Allerte meteo ufficiali per l'Emilia-Romagna",
      },
      {
        label: "Antiviolenza e stalking",
        number: "1522",
        note: "Numero nazionale gratuito, attivo 24/7",
      },
    ],
  },
];

const RAVENNA_CENTER = [44.4184, 12.2035];
const RAVENNA_CENTER_OBJ = { lat: RAVENNA_CENTER[0], lng: RAVENNA_CENTER[1] };

/* Formatta un intervallo di tempo in modo relativo e leggibile, es. "12s fa" */
function formatAgo(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 5) return "adesso";
  if (s < 60) return `${s}s fa`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min fa`;
  const h = Math.floor(m / 60);
  return `${h} h fa`;
}

/* Distanza approssimativa in km tra due coordinate (formula di Haversine) */
function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/* Etichetta di distanza dal centro di Ravenna, usata per le segnalazioni utente
   (sia quelle appena inviate sia quelle ricaricate dal backend) */
function distanceLabelFrom(lat, lng) {
  const dist = distanceKm(RAVENNA_CENTER[0], RAVENNA_CENTER[1], lat, lng);
  return dist < 0.1 ? "in centro" : `${dist.toFixed(1)} km`;
}

/* Segnaposto per il bollettino meteo: al caricamento viene sostituito dai dati
   reali della Protezione Civile Emilia-Romagna (vedi meteoReal in OraApp).
   Finché i dati reali non arrivano, questo evento non viene mostrato: niente
   più contenuti finti spacciati per informazioni ufficiali. */
const INITIAL_ALERTS = [
  {
    id: "meteo",
    type: "meteo",
    level: "verde",
    trust: "Ufficiale",
    label: "METEO",
    title: "Bollettino meteo",
    detail: "Protezione Civile Emilia-Romagna",
    distance: "bollettino regionale",
    Icon: CloudRain,
    emoji: "🌤️",
    lat: RAVENNA_CENTER[0],
    lng: RAVENNA_CENTER[1],
    addedAt: Date.now(),
  },
];

/* Tipi di segnalazione: usati sia per i filtri sulla mappa sia per la scelta
   della categoria quando un utente crea una nuova segnalazione. */
const REPORT_TYPES = [
  { id: "incidente", label: "Incidente", Icon: AlertTriangle, emoji: "⚠️", level: "giallo" },
  { id: "meteo", label: "Meteo", Icon: CloudRain, emoji: "🌧️", level: "arancio" },
  { id: "viabilita", label: "Viabilità", Icon: Construction, emoji: "🚧", level: "blu" },
  { id: "servizi", label: "Servizi", Icon: Droplets, emoji: "💧", level: "verde" },
];

/* Ogni quanto l'app ricontrolla se ci sono nuove segnalazioni (simulato) */
const POLL_INTERVAL_MS = 25000;

/* ---------------------------------------------------------
   Configurazione backend — persistenza reale delle segnalazioni
   ---------------------------------------------------------
   Senza queste chiavi, le segnalazioni vivono solo nella sessione
   del browser e spariscono alla chiusura dell'app.

   Per attivare la persistenza reale (gratis, senza server da gestire):
   1. Crea un progetto gratuito su https://supabase.com
   2. Apri l'Editor SQL del progetto ed esegui lo schema fornito
      (file ORA-schema-supabase.sql) per creare la tabella "segnalazioni"
   3. In Project Settings → API, copia "Project URL" e la chiave "anon public"
   4. Incollale qui sotto: l'app le userà automaticamente per salvare
      e ricaricare le segnalazioni degli utenti a ogni apertura
--------------------------------------------------------- */
const SUPABASE_URL = "https://gdfqyafpzyzdajyrvtln.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkZnF5YWZwenl6ZGFqeXJ2dGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2OTg1MzgsImV4cCI6MjEwNTI3NDUzOH0.B7XcDIUZgRoMmc4hP863dN1kQAmbd0BaNq4zZf7bQuU";
const BACKEND_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/* Carica il client Supabase da cdn solo se il backend è configurato */
let supabaseLoading = null;
function loadSupabase() {
  if (!BACKEND_ENABLED) return Promise.resolve(null);
  if (window.supabase && window.supabase.__oraClient) return Promise.resolve(window.supabase.__oraClient);
  if (supabaseLoading) return supabaseLoading;
  supabaseLoading = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";
    script.onload = () => {
      const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      window.supabase.__oraClient = client;
      resolve(client);
    };
    script.onerror = () => resolve(null);
    document.body.appendChild(script);
  });
  return supabaseLoading;
}

/* ---------------------------------------------------------
   Configurazione mappa — passaggio da server di test a produzione
   ---------------------------------------------------------
   Il server tile.openstreetmap.org usato di default è pensato solo
   per test/sviluppo: la loro policy vieta l'uso intensivo (un'app
   pubblicata) senza permesso preventivo.

   Per passare a un servizio pensato per la produzione:
   1. Registrati gratis su https://stadiamaps.com (nessuna carta richiesta,
      200.000 crediti/mese inclusi — ampi per un pilota su una città)
   2. Copia la tua chiave API e incollala qui sotto in STADIA_API_KEY
   3. Nient'altro da cambiare: l'app userà automaticamente le tile vere
--------------------------------------------------------- */
const STADIA_API_KEY = "2a7b48fb-6bed-4e5f-96c8-19885404a3ac";

const TILE_CONFIG = STADIA_API_KEY
  ? {
      url: `https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key=${STADIA_API_KEY}`,
      attribution: "© Stadia Maps © OpenMapTiles © OpenStreetMap contributors",
      isProduction: true,
    }
  : {
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: "© OpenStreetMap contributors",
      isProduction: false,
    };

/* Moderazione: dopo quante segnalazioni della community un contenuto non ufficiale
   viene nascosto automaticamente dalla mappa e dall'elenco */
const FLAG_THRESHOLD = 3;

/* Limite di frequenza per le nuove segnalazioni utente, per contenere lo spam */
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minuti

/* Webservice pubblico reale della Protezione Civile Emilia-Romagna (nessuna chiave richiesta).
   Vedi: https://allertameteo.regione.emilia-romagna.it/sviluppatori */
const PROTEZIONE_CIVILE_URL = "https://allertameteo.regione.emilia-romagna.it/o/get-stato-allerta";

const COLOR_TO_LEVEL = { green: "verde", yellow: "giallo", orange: "arancio", red: "rosso" };
const EMOJI_FOR_LEVEL = { verde: "🌤️", giallo: "🌦️", arancio: "🌧️", rosso: "⛈️" };

/* Tra tutti i colori di rischio delle zone del bollettino, individua il più grave
   (per mostrare un'unica sintesi regionale, finché non si integra la zona precisa di Ravenna) */
function worstColor(colors) {
  const order = { green: 0, yellow: 1, orange: 2, red: 3 };
  let worst = null;
  colors.forEach((c) => {
    if (c && (worst === null || order[c] > order[worst])) worst = c;
  });
  return worst;
}

const LEVEL_COLOR = {
  rosso: "#D9534F",
  arancio: "#E8792A",
  giallo: "#E8B23C",
  blu: "#4E8BC4",
  verde: "#4CA372",
};

const TRUST_COLOR = {
  Ufficiale: "#4CA372",
  Verificata: "#4E8BC4",
  Segnalata: "#E8B23C",
};

/* Carica Leaflet da cdnjs una sola volta e la riusa tra le schermate. */
let leafletLoading = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletLoading) return leafletLoading;
  leafletLoading = new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    script.onload = () => resolve(window.L);
    document.body.appendChild(script);
  });
  return leafletLoading;
}

/* Aggiunge lo strato di base scelto in TILE_CONFIG; se le tile a pagamento
   non si caricano (chiave non ancora autorizzata, dominio non abilitato,
   rete che le blocca...) torna automaticamente a quelle di OpenStreetMap,
   così la mappa si vede comunque. */
function addBaseTileLayer(map, L) {
  let errorCount = 0;
  let fellBack = false;
  const primary = L.tileLayer(TILE_CONFIG.url, {
    maxZoom: 19,
    attribution: TILE_CONFIG.attribution,
  });
  if (TILE_CONFIG.isProduction) {
    primary.on("tileerror", () => {
      errorCount++;
      if (errorCount >= 3 && !fellBack) {
        fellBack = true;
        map.removeLayer(primary);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap contributors",
        }).addTo(map);
      }
    });
  }
  primary.addTo(map);
}

function LiveMap({ alerts, onSelect, height = 200, className = "" }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: true,
      }).setView(RAVENNA_CENTER, 13);
      addBaseTileLayer(map, L);
      mapRef.current = map;
      // forza un resize: l'artifact monta il div prima che abbia dimensioni finali
      setTimeout(() => map.invalidateSize(), 200);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = alerts.map((a) => {
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:34px;height:34px;border-radius:50%;background:${LEVEL_COLOR[a.level]};border:2px solid #FFFFFF;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:16px;line-height:1">${a.emoji}</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      const marker = L.marker([a.lat, a.lng], { icon }).addTo(map);
      marker.on("click", () => onSelect && onSelect(a));
      return marker;
    });
  }, [ready, alerts, onSelect]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height, background: "#E7E5DE" }}
    />
  );
}

function EventDetailSheet({ alert, onClose, onFlag, alreadyFlagged = false }) {
  if (!alert) return null;
  const color = LEVEL_COLOR[alert.level];
  const flaggable = alert.trust === "Segnalata" && onFlag;
  return (
    <div
      className="absolute inset-0 flex flex-col justify-end"
      style={{ zIndex: 1000 }}
    >
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.5)" }}
        onClick={onClose}
      />
      <div
        className="relative px-5 pt-4 pb-6"
        style={{
          background: "#1E2226",
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
          boxShadow: "0 -8px 24px rgba(0,0,0,0.4)",
        }}
      >
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: "#2A2F34",
            margin: "0 auto 16px",
          }}
        />
        <div className="flex items-start gap-3">
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: 40, height: 40, borderRadius: 8, background: `${color}26` }}
          >
            <alert.Icon size={20} color={color} />
          </div>
          <div className="flex-1">
            <div
              className="text-[11px] font-semibold mb-0.5"
              style={{ color, letterSpacing: "0.06em" }}
            >
              {alert.label}
            </div>
            <div className="text-[17px] font-semibold" style={{ color: "#F1EEE6" }}>
              {alert.title}
            </div>
          </div>
          <button onClick={onClose} aria-label="Chiudi" className="text-xl leading-none px-1" style={{ color: "#9DA3A8" }}>
            ×
          </button>
        </div>

        <div className="text-[14px] mt-3 leading-relaxed" style={{ color: "#9DA3A8" }}>
          {alert.detail}
        </div>

        <div className="flex items-center gap-4 mt-4">
          <span className="text-[12px]" style={{ color: "#6B7278" }}>
            {alert.distance} · {alert.time}
          </span>
          <div className="flex items-center gap-1.5">
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: TRUST_COLOR[alert.trust],
                display: "inline-block",
              }}
            />
            <span className="text-[12px] font-medium" style={{ color: "#9DA3A8" }}>
              {alert.trust}
            </span>
          </div>
        </div>

        {flaggable && (
          <button
            onClick={() => onFlag(alert.id)}
            disabled={alreadyFlagged}
            className="flex items-center gap-1.5 mt-4 px-3 py-2"
            style={{
              border: "1px solid #2A2F34",
              borderRadius: 6,
              background: "transparent",
              opacity: alreadyFlagged ? 0.6 : 1,
            }}
          >
            <Flag size={13} color="#E8B23C" />
            <span className="text-[12px] font-medium" style={{ color: "#E8B23C" }}>
              {alreadyFlagged ? "Segnalata per revisione — grazie" : "Segnala come inappropriata o falsa"}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

function FilterChips({ active, onToggle }) {
  return (
    <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
      {REPORT_TYPES.map((t) => {
        const on = active.has(t.id);
        return (
          <button
            key={t.id}
            onClick={() => onToggle(t.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 flex-shrink-0"
            style={{
              borderRadius: 20,
              border: `1px solid ${on ? LEVEL_COLOR[t.level] : "#2A2F34"}`,
              background: on ? `${LEVEL_COLOR[t.level]}26` : "transparent",
            }}
          >
            <span style={{ fontSize: 13, lineHeight: 1 }}>{t.emoji}</span>
            <span
              className="text-[12px] font-medium"
              style={{ color: on ? "#F1EEE6" : "#6B7278" }}
            >
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function EventRow({ a, onClick }) {
  return (
    <div
      className="py-4"
      style={{ borderBottom: "1px solid #2A2F34", cursor: onClick ? "pointer" : "default" }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: 34,
              height: 34,
              borderRadius: 3,
              background: `${LEVEL_COLOR[a.level]}26`,
            }}
          >
            <a.Icon size={17} color={LEVEL_COLOR[a.level]} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <div className="text-[15px] font-semibold" style={{ color: "#F1EEE6" }}>
                {a.title} — {a.distance}
              </div>
              {a.isNew && (
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5"
                  style={{ background: "#D9534F", color: "#FFFFFF", borderRadius: 3, letterSpacing: "0.04em" }}
                >
                  NUOVO
                </span>
              )}
            </div>
            <div className="text-[13px] mt-0.5" style={{ color: "#9DA3A8" }}>
              {a.detail}
            </div>
            <div className="text-[11px] mt-1" style={{ color: "#6B7278" }}>
              {a.time}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 mt-1">
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: TRUST_COLOR[a.trust],
              display: "inline-block",
            }}
          />
          <span className="text-[12px] font-medium" style={{ color: "#9DA3A8" }}>
            {a.trust}
          </span>
        </div>
      </div>
    </div>
  );
}

function UsefulNumbersButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-4 flex items-center justify-center gap-2"
      style={{
        background: "#D9534F",
        color: "#FFFFFF",
        borderRadius: 999,
        boxShadow: "0 4px 16px rgba(217,83,79,0.35)",
      }}
    >
      <Phone size={18} />
      <span className="text-base font-semibold">NUMERI UTILI</span>
    </button>
  );
}

function MapScreen({ alerts, lastUpdatedLabel, activeFilters, onToggleFilter, onOpenNumeri, onSeeAll, onProfile, onNewReport, onOpenNotifications, unreadCount, onFlag, flaggedIds }) {
  const [selected, setSelected] = useState(null);
  const filtered = alerts.filter((a) => activeFilters.has(a.type));
  return (
    <div className="h-full relative" style={{ background: "#14171A" }}>
      <LiveMap alerts={filtered} onSelect={setSelected} height="100%" className="absolute inset-0" />

      {/* header in overlay */}
      <div className="absolute left-0 right-0 top-0 px-4 pt-4" style={{ zIndex: 500 }}>
        <div className="flex items-center justify-between mb-3">
          <div
            className="flex items-center gap-1.5 px-3 py-2"
            style={{ background: "#1E2226", borderRadius: 20, border: "1px solid #2A2F34" }}
          >
            <MapPin size={14} color="#D9534F" />
            <span className="text-[13px] font-semibold" style={{ color: "#F1EEE6" }}>
              {PILOT_CITY} · pilota
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenNotifications}
              className="flex items-center justify-center relative"
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "#1E2226",
                border: "1px solid #2A2F34",
              }}
              aria-label="Notifiche"
            >
              <Bell size={16} color="#9DA3A8" />
              {unreadCount > 0 && (
                <span
                  className="absolute flex items-center justify-center text-[10px] font-semibold"
                  style={{
                    top: -3,
                    right: -3,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    background: "#D9534F",
                    color: "#FFFFFF",
                    padding: "0 3px",
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={onProfile}
              className="flex items-center justify-center"
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "#1E2226",
                border: "1px solid #2A2F34",
              }}
            >
              <Settings size={16} color="#9DA3A8" />
            </button>
          </div>
        </div>
        <FilterChips active={activeFilters} onToggle={onToggleFilter} />
      </div>

      {/* pulsante nuova segnalazione, sopra la scheda inferiore */}
      <button
        onClick={onNewReport}
        className="absolute flex items-center justify-center"
        style={{
          right: 16,
          bottom: 168,
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "#1E2226",
          border: "1px solid #2A2F34",
          zIndex: 500,
          boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
        }}
        aria-label="Nuova segnalazione"
      >
        <Plus size={20} color="#F1EEE6" />
      </button>

      {/* scheda inferiore in overlay */}
      <div
        className="absolute left-0 right-0 bottom-0 px-4 pb-4 pt-4"
        style={{
          zIndex: 500,
          background: "linear-gradient(to top, #14171A 55%, rgba(20,23,26,0))",
        }}
      >
        <button
          onClick={onSeeAll}
          className="w-full text-left px-4 py-3 mb-3"
          style={{ background: "#1E2226", border: "1px solid #2A2F34", borderRadius: 10 }}
        >
          <div className="flex items-center justify-between">
            <div className="text-[15px] font-semibold" style={{ color: "#F1EEE6" }}>
              {PILOT_CITY}
            </div>
            <div className="flex items-center gap-1.5">
              <span
                style={{ width: 6, height: 6, borderRadius: "50%", background: "#4CA372", display: "inline-block" }}
              />
              <span className="text-[11px]" style={{ color: "#9DA3A8" }}>
                Aggiornato {lastUpdatedLabel}
              </span>
            </div>
          </div>
          <div className="text-[12px] mt-0.5" style={{ color: "#9DA3A8" }}>
            {filtered.length} segnalazioni visibili · tocca per vederle
          </div>
        </button>
        <UsefulNumbersButton onClick={onOpenNumeri} />
      </div>

      <EventDetailSheet
        key={selected?.id}
        alert={selected}
        onClose={() => setSelected(null)}
        onFlag={onFlag}
        alreadyFlagged={selected ? flaggedIds.has(selected.id) : false}
      />
    </div>
  );
}

function EventsScreen({ alerts, activeFilters, onToggleFilter, onNewReport, onFlag, flaggedIds }) {
  const [selected, setSelected] = useState(null);
  const filtered = alerts.filter((a) => activeFilters.has(a.type));
  return (
    <div className="flex flex-col h-full relative" style={{ background: "#14171A" }}>
      <div className="px-5 pt-6 pb-3 flex items-center justify-between">
        <span className="text-lg font-semibold" style={{ color: "#F1EEE6" }}>
          Eventi · {PILOT_CITY}
        </span>
        <button
          onClick={onNewReport}
          className="flex items-center justify-center"
          style={{ width: 32, height: 32, borderRadius: "50%", background: "#1E2226", border: "1px solid #2A2F34" }}
          aria-label="Nuova segnalazione"
        >
          <Plus size={16} color="#F1EEE6" />
        </button>
      </div>
      <div className="px-5 pb-3">
        <FilterChips active={activeFilters} onToggle={onToggleFilter} />
      </div>
      <div className="flex-1 overflow-y-auto px-5">
        {filtered.length === 0 ? (
          alerts.length === 0 ? (
            <div className="flex flex-col items-center text-center pt-16 px-6">
              <div
                className="flex items-center justify-center mb-4"
                style={{ width: 56, height: 56, borderRadius: "50%", background: "#4CA37226" }}
              >
                <CheckCircle2 size={26} color="#4CA372" />
              </div>
              <div className="text-[15px] font-medium mb-1.5" style={{ color: "#F1EEE6" }}>
                Nessuna segnalazione al momento
              </div>
              <div className="text-[13px]" style={{ color: "#9DA3A8" }}>
                A {PILOT_CITY} sembra tutto tranquillo. Torna a controllare più tardi o invia tu la prima
                segnalazione.
              </div>
            </div>
          ) : (
            <div className="text-[13px] pt-6" style={{ color: "#6B7278" }}>
              Nessuna segnalazione con i filtri selezionati.
            </div>
          )
        ) : (
          filtered.map((a) => <EventRow key={a.id} a={a} onClick={() => setSelected(a)} />)
        )}
      </div>
      <EventDetailSheet
        key={selected?.id}
        alert={selected}
        onClose={() => setSelected(null)}
        onFlag={onFlag}
        alreadyFlagged={selected ? flaggedIds.has(selected.id) : false}
      />
    </div>
  );
}

function Header({ title, onBack }) {
  return (
    <div className="flex items-center gap-3 px-5 py-5" style={{ borderBottom: "1px solid #2A2F34" }}>
      {onBack && (
        <button onClick={onBack} aria-label="Indietro">
          <ChevronLeft size={20} color="#9DA3A8" />
        </button>
      )}
      <span className="text-lg font-semibold" style={{ color: "#F1EEE6" }}>
        {title}
      </span>
    </div>
  );
}

/* Piccola mappa interattiva per scegliere la posizione a tocco/trascinamento,
   senza dipendere da servizi esterni di geocodifica (che potrebbero non essere
   raggiungibili in anteprima). Usa lo stesso Leaflet già caricato per la mappa principale. */
function MiniLocationPicker({ lat, lng, onChange }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, { zoomControl: false }).setView([lat, lng], 14);
      addBaseTileLayer(map, L);
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:#D9534F;border:2px solid #fff;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 22],
      });
      const marker = L.marker([lat, lng], { icon, draggable: true }).addTo(map);
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        onChange(p.lat, p.lng);
      });
      map.on("click", (e) => {
        marker.setLatLng(e.latlng);
        onChange(e.latlng.lat, e.latlng.lng);
      });
      mapRef.current = map;
      markerRef.current = marker;
      setTimeout(() => map.invalidateSize(), 200);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // se lat/lng cambiano dall'esterno (es. dopo il GPS), riposiziona il marker
  // senza distruggere e ricreare la mappa
  useEffect(() => {
    if (ready && markerRef.current && mapRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      mapRef.current.setView([lat, lng], mapRef.current.getZoom());
    }
  }, [lat, lng, ready]);

  return <div ref={containerRef} style={{ height: 160, background: "#1E2226" }} />;
}

function ReportScreen({ onBack, onSubmit, rateLimited = false, rateLimitRetryMs = 0 }) {
  const [typeId, setTypeId] = useState(null);
  const [description, setDescription] = useState("");
  const [streetLabel, setStreetLabel] = useState("");
  const [location, setLocation] = useState({ ...RAVENNA_CENTER_OBJ, source: "Centro di Ravenna" });
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [sent, setSent] = useState(false);

  const useMyLocation = () => {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError("Il GPS non è disponibile in questa anteprima — tocca la mappa per indicare il punto.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          source: "La tua posizione",
        });
        setLocating(false);
      },
      () => {
        setLocationError("GPS non disponibile o permesso negato in questa anteprima — tocca la mappa per indicare il punto.");
        setLocating(false);
      },
      { timeout: 8000 }
    );
  };

  const canSubmit = typeId && description.trim().length > 0 && !rateLimited;
  const type = REPORT_TYPES.find((t) => t.id === typeId);

  if (sent) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-8 text-center" style={{ background: "#14171A" }}>
        <div
          className="flex items-center justify-center mb-4"
          style={{ width: 56, height: 56, borderRadius: "50%", background: "#4CA37226" }}
        >
          <CheckCircle2 size={28} color="#4CA372" />
        </div>
        <div className="text-[17px] font-semibold mb-2" style={{ color: "#F1EEE6" }}>
          Segnalazione inviata
        </div>
        <div className="text-[14px] mb-8" style={{ color: "#9DA3A8" }}>
          È ora visibile sulla mappa per chi si trova nella zona.
        </div>
        <button
          onClick={onBack}
          className="w-full py-4 text-base font-semibold"
          style={{ background: "#D9534F", color: "#FFFFFF", borderRadius: 999 }}
        >
          Vai alla mappa
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: "#14171A" }}>
      <Header title="Nuova segnalazione" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="text-[12px] font-semibold uppercase mb-2" style={{ color: "#6B7278", letterSpacing: "0.06em" }}>
          Tipo di segnalazione
        </div>
        <div className="grid grid-cols-2 gap-2 mb-6">
          {REPORT_TYPES.map((t) => {
            const on = typeId === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTypeId(t.id)}
                className="flex items-center gap-2 px-3 py-3"
                style={{
                  borderRadius: 8,
                  border: `1px solid ${on ? LEVEL_COLOR[t.level] : "#2A2F34"}`,
                  background: on ? `${LEVEL_COLOR[t.level]}26` : "transparent",
                }}
              >
                <span style={{ fontSize: 16 }}>{t.emoji}</span>
                <span className="text-[14px] font-medium" style={{ color: "#F1EEE6" }}>
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="text-[12px] font-semibold uppercase mb-2" style={{ color: "#6B7278", letterSpacing: "0.06em" }}>
          Cosa sta succedendo?
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descrivi brevemente la situazione..."
          rows={3}
          className="w-full px-3 py-3 mb-6 text-[14px]"
          style={{
            background: "#1E2226",
            border: "1px solid #2A2F34",
            borderRadius: 8,
            color: "#F1EEE6",
            resize: "none",
          }}
        />

        <div className="text-[12px] font-semibold uppercase mb-2" style={{ color: "#6B7278", letterSpacing: "0.06em" }}>
          Via (facoltativo)
        </div>
        <input
          type="text"
          value={streetLabel}
          onChange={(e) => setStreetLabel(e.target.value)}
          placeholder="Es. Via Cavour 12"
          className="w-full px-3 py-3 mb-6 text-[14px]"
          style={{
            background: "#1E2226",
            border: "1px solid #2A2F34",
            borderRadius: 8,
            color: "#F1EEE6",
          }}
        />

        <div className="text-[12px] font-semibold uppercase mb-2" style={{ color: "#6B7278", letterSpacing: "0.06em" }}>
          Posizione sulla mappa
        </div>
        <div className="text-[12px] mb-2" style={{ color: "#9DA3A8" }}>
          Tocca il punto esatto, oppure trascina il segnaposto.
        </div>
        <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid #2A2F34" }} className="mb-2">
          <MiniLocationPicker
            lat={location.lat}
            lng={location.lng}
            onChange={(lat, lng) => setLocation({ lat, lng, source: "Punto indicato sulla mappa" })}
          />
        </div>

        <div
          className="flex items-center justify-between px-3 py-3 mb-2"
          style={{ background: "#1E2226", border: "1px solid #2A2F34", borderRadius: 8 }}
        >
          <span className="text-[14px]" style={{ color: "#F1EEE6" }}>
            {location.source}
          </span>
          <button
            onClick={useMyLocation}
            className="flex items-center gap-1.5 px-2.5 py-1.5"
            style={{ border: "1px solid #3A4046", borderRadius: 6 }}
          >
            <Navigation size={13} color="#4E8BC4" />
            <span className="text-[12px] font-medium" style={{ color: "#4E8BC4" }}>
              {locating ? "Rilevo..." : "Usa GPS"}
            </span>
          </button>
        </div>
        {locationError && (
          <div className="text-[12px] mb-4" style={{ color: "#E8B23C" }}>
            {locationError}
          </div>
        )}

        <div className="text-[11px] mt-2" style={{ color: "#6B7278" }}>
          Segnalazioni false o offensive possono essere rimosse dalla community. Non condividere dati personali nella descrizione.
        </div>
        <div className="text-[11px] mt-2 font-medium" style={{ color: "#E8792A" }}>
          Questa non è una segnalazione di emergenza. Per un pericolo reale in corso chiama sempre il 112.
        </div>
      </div>

      <div className="px-5 pb-8 pt-3">
        {rateLimited && (
          <div className="text-[12px] mb-3 text-center" style={{ color: "#E8B23C" }}>
            Hai raggiunto il limite di {RATE_LIMIT_MAX} segnalazioni ogni 10 minuti. Riprova tra {Math.ceil(rateLimitRetryMs / 60000)} min.
          </div>
        )}
        <button
          disabled={!canSubmit}
          onClick={() => {
            onSubmit({
              typeId,
              type,
              description: streetLabel.trim() ? `${streetLabel.trim()} — ${description.trim()}` : description.trim(),
              lat: location.lat,
              lng: location.lng,
            });
            setSent(true);
          }}
          className="w-full py-4 text-base font-semibold"
          style={{
            background: canSubmit ? "#D9534F" : "#2A2F34",
            color: canSubmit ? "#FFFFFF" : "#6B7278",
            borderRadius: 999,
          }}
        >
          Invia segnalazione
        </button>
      </div>
    </div>
  );
}

/* Codice ISTAT del Comune di Ravenna, usato dal badge ufficiale della Protezione Civile */
const RAVENNA_ISTAT = "039014";

/* Incorpora il badge ufficiale della Protezione Civile Emilia-Romagna per il singolo Comune.
   Usiamo un iframe con un mini-documento a sé: lo script del badge cerca il suo elemento
   al caricamento della pagina, quindi un iframe "fresco" garantisce che lo trovi sempre,
   a differenza di iniettarlo direttamente nel DOM di una SPA. */
function OfficialMeteoBadge() {
  const html = `<!doctype html><html><head><meta charset="utf-8" />
    <style>
      body { margin:0; padding:0; background:transparent; font-family: sans-serif; }
      .allerta-meteo { color-scheme: light; }
    </style>
  </head><body>
    <div class="allerta-meteo" tipo="fenomeni" comune="${RAVENNA_ISTAT}"></div>
    <script src="https://allertameteo.regione.emilia-romagna.it/o/badge.js"><\/script>
  </body></html>`;
  return (
    <iframe
      title="Bollettino ufficiale Protezione Civile — Ravenna"
      srcDoc={html}
      style={{ width: "100%", height: 130, border: "none", borderRadius: 8, background: "#FFFFFF" }}
      sandbox="allow-scripts allow-same-origin"
    />
  );
}

function NotificationsScreen({ notifications, onBack, onOpen, onMarkAllRead }) {
  return (
    <div className="flex flex-col h-full" style={{ background: "#14171A" }}>
      <Header title="Notifiche" onBack={onBack} />
      {notifications.length > 0 && (
        <div className="px-5 pt-3">
          <button onClick={onMarkAllRead} className="text-[12px] font-medium" style={{ color: "#4E8BC4" }}>
            Segna tutte come lette
          </button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-5 pt-3">
        {notifications.length === 0 ? (
          <div className="text-[13px] pt-6" style={{ color: "#6B7278" }}>
            Nessuna notifica per ora.
          </div>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => onOpen(n)}
              className="w-full text-left flex items-start gap-3 py-4"
              style={{ borderBottom: "1px solid #2A2F34" }}
            >
              <div
                className="flex items-center justify-center flex-shrink-0"
                style={{ width: 34, height: 34, borderRadius: "50%", background: `${LEVEL_COLOR[n.level]}26`, fontSize: 15 }}
              >
                {n.emoji}
              </div>
              <div className="flex-1">
                <div className="text-[14px] font-semibold" style={{ color: "#F1EEE6" }}>
                  {n.title}
                </div>
                <div className="text-[13px] mt-0.5" style={{ color: "#9DA3A8" }}>
                  {n.detail}
                </div>
                <div className="text-[11px] mt-1" style={{ color: "#6B7278" }}>
                  {formatAgo(Date.now() - n.time)}
                </div>
              </div>
              {!n.read && (
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#D9534F", marginTop: 6, flexShrink: 0 }} />
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function NotificationToast({ notif, onDismiss, onOpen }) {
  if (!notif) return null;
  return (
    <div
      className="absolute left-3 right-3 top-4"
      style={{ zIndex: 2000 }}
      role="alert"
    >
      <button
        onClick={onOpen}
        className="w-full text-left flex items-start gap-3 px-4 py-3"
        style={{
          background: "#1E2226",
          border: "1px solid #2A2F34",
          borderRadius: 12,
          boxShadow: "0 8px 20px rgba(0,0,0,0.5)",
        }}
      >
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: 32, height: 32, borderRadius: "50%", background: `${LEVEL_COLOR[notif.level]}26`, fontSize: 15 }}
        >
          {notif.emoji}
        </div>
        <div className="flex-1">
          <div className="text-[11px] font-semibold mb-0.5" style={{ color: "#9DA3A8" }}>
            NUOVA SEGNALAZIONE
          </div>
          <div className="text-[14px] font-semibold" style={{ color: "#F1EEE6" }}>
            {notif.title}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="text-lg leading-none px-1"
          style={{ color: "#6B7278" }}
          aria-label="Chiudi notifica"
        >
          ×
        </button>
      </button>
    </div>
  );
}

function ProfileScreen({
  onBack,
  meteoSource,
  onOpenNumeri,
  onOpenInfoLegali,
  hiddenCount = 0,
  backendStatus = "locale",
  session,
  authEmail,
  onAuthEmailChange,
  authStatus,
  onSendLink,
  onSignOut,
}) {
  const sourceLabel =
    meteoSource === "reale"
      ? "Dati reali — Protezione Civile Emilia-Romagna"
      : meteoSource === "errore"
      ? "Non raggiungibile ora — riprova più tardi"
      : "Caricamento in corso...";
  const sourceColor = meteoSource === "reale" ? "#4CA372" : "#E8B23C";

  const backendLabel =
    backendStatus === "connesso"
      ? "Segnalazioni salvate in modo permanente"
      : backendStatus === "connessione"
      ? "Connessione al backend..."
      : backendStatus === "errore"
      ? "Backend configurato ma non raggiungibile — salvo solo in locale"
      : "Solo in locale — le segnalazioni si perdono alla chiusura";
  const backendColor = backendStatus === "connesso" ? "#4CA372" : backendStatus === "locale" ? "#E8B23C" : "#E8792A";

  return (
    <div className="flex flex-col h-full" style={{ background: "#14171A" }}>
      <Header title="Profilo" onBack={onBack} />
      <div className="px-5 pt-4 pb-1">
        <div className="text-[13px]" style={{ color: "#9DA3A8" }}>
          {PILOT_CITY} — progetto pilota
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pt-3">
        <div className="flex items-center gap-2 px-3 py-2.5 mb-2" style={{ background: "#1E2226", border: "1px solid #2A2F34", borderRadius: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: sourceColor, display: "inline-block", flexShrink: 0 }} />
          <span className="text-[12px]" style={{ color: "#F1EEE6" }}>
            Meteo: {sourceLabel}
          </span>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-2.5 mb-2"
          style={{ background: "#1E2226", border: "1px solid #2A2F34", borderRadius: 8 }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: backendColor, display: "inline-block", flexShrink: 0 }} />
          <span className="text-[12px]" style={{ color: "#F1EEE6" }}>
            Dati: {backendLabel}
          </span>
        </div>

        {BACKEND_ENABLED && (
          <>
            <div className="text-[11px] font-semibold uppercase mb-2 mt-1" style={{ color: "#6B7278", letterSpacing: "0.06em" }}>
              Account
            </div>
            {session ? (
              <div
                className="flex items-center justify-between px-3 py-3 mb-2"
                style={{ background: "#1E2226", border: "1px solid #2A2F34", borderRadius: 8 }}
              >
                <span className="text-[13px]" style={{ color: "#F1EEE6" }}>
                  {session.user.email}
                </span>
                <button onClick={onSignOut} className="text-[12px] font-semibold" style={{ color: "#D9534F" }}>
                  Esci
                </button>
              </div>
            ) : (
              <div className="px-3 py-3 mb-2" style={{ background: "#1E2226", border: "1px solid #2A2F34", borderRadius: 8 }}>
                {authStatus === "sent" ? (
                  <div className="text-[13px]" style={{ color: "#4CA372" }}>
                    Controlla la tua email: ti abbiamo inviato un link di accesso.
                  </div>
                ) : (
                  <>
                    <input
                      type="email"
                      value={authEmail}
                      onChange={(e) => onAuthEmailChange(e.target.value)}
                      placeholder="La tua email"
                      className="w-full px-2.5 py-2 mb-2 text-[13px]"
                      style={{ background: "#14171A", border: "1px solid #2A2F34", borderRadius: 6, color: "#F1EEE6" }}
                    />
                    <button
                      onClick={() => onSendLink(authEmail)}
                      disabled={!authEmail.trim() || authStatus === "sending"}
                      className="w-full py-2.5 text-[13px] font-semibold"
                      style={{
                        background: authEmail.trim() ? "#4E8BC4" : "#2A2F34",
                        color: "#FFFFFF",
                        borderRadius: 6,
                      }}
                    >
                      {authStatus === "sending" ? "Invio..." : "Accedi con la tua email"}
                    </button>
                    {authStatus === "errore" && (
                      <div className="text-[12px] mt-2" style={{ color: "#E8792A" }}>
                        Invio non riuscito, riprova.
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            <div className="text-[11px] mb-5" style={{ color: "#6B7278" }}>
              Accedere è facoltativo: puoi continuare a segnalare in modo anonimo. Con l'accesso, le tue segnalazioni
              restano collegate al tuo account.
            </div>
          </>
        )}
        <div
          className="flex items-center gap-2 px-3 py-2.5 mb-3"
          style={{ background: "#1E2226", border: "1px solid #2A2F34", borderRadius: 8 }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: TILE_CONFIG.isProduction ? "#4CA372" : "#E8B23C",
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          <span className="text-[12px]" style={{ color: "#F1EEE6" }}>
            Mappa: {TILE_CONFIG.isProduction ? "Stadia Maps (produzione)" : "Server di test — non idoneo al lancio pubblico"}
          </span>
        </div>
        <div className="text-[11px] font-semibold uppercase mb-2" style={{ color: "#6B7278", letterSpacing: "0.06em" }}>
          Bollettino ufficiale — Comune di Ravenna
        </div>
        <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid #2A2F34" }} className="mb-2">
          <OfficialMeteoBadge />
        </div>
        <div className="text-[11px] mb-5" style={{ color: "#6B7278" }}>
          Widget ufficiale della Protezione Civile Emilia-Romagna, specifico per il Comune di Ravenna.
        </div>

        <button
          onClick={onOpenNumeri}
          className="w-full flex items-center justify-between px-3 py-3 mb-2"
          style={{ background: "#1E2226", border: "1px solid #2A2F34", borderRadius: 8 }}
        >
          <span className="text-[14px] font-medium" style={{ color: "#F1EEE6" }}>
            Numeri utili
          </span>
          <Phone size={15} color="#4E8BC4" />
        </button>

        <button
          onClick={onOpenInfoLegali}
          className="w-full flex items-center justify-between px-3 py-3 mb-2"
          style={{ background: "#1E2226", border: "1px solid #2A2F34", borderRadius: 8 }}
        >
          <span className="text-[14px] font-medium" style={{ color: "#F1EEE6" }}>
            Privacy e termini
          </span>
          <FileText size={15} color="#4E8BC4" />
        </button>

        <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: "#1E2226", border: "1px solid #2A2F34", borderRadius: 8 }}>
          <Flag size={13} color="#6B7278" />
          <span className="text-[12px]" style={{ color: "#9DA3A8" }}>
            {hiddenCount === 0
              ? "Nessun contenuto rimosso per moderazione"
              : `${hiddenCount} contenut${hiddenCount === 1 ? "o" : "i"} rimoss${hiddenCount === 1 ? "o" : "i"} per moderazione`}
          </span>
        </div>
      </div>
    </div>
  );
}

function InfoLegaliScreen({ onBack }) {
  const Section = ({ title, children }) => (
    <div className="mb-6">
      <div className="text-[11px] font-semibold uppercase mb-2" style={{ color: "#6B7278", letterSpacing: "0.06em" }}>
        {title}
      </div>
      <div className="text-[13px] leading-relaxed" style={{ color: "#C9CDD1" }}>
        {children}
      </div>
    </div>
  );
  return (
    <div className="flex flex-col h-full" style={{ background: "#14171A" }}>
      <Header title="Privacy e termini" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <Section title="Disclaimer">
          <p className="mb-2">
            ORA è un progetto pilota. Le informazioni mostrate provengono in parte da fonti ufficiali (es. Protezione
            Civile Emilia-Romagna) e in parte da segnalazioni inviate dagli utenti della community: potrebbero
            risultare imprecise, incomplete o non aggiornate in tempo reale.
          </p>
          <p className="mb-2 font-medium" style={{ color: "#E8792A" }}>
            ORA non è un servizio di emergenza. Per qualsiasi pericolo reale in corso, chiama sempre il 112 o il
            numero di emergenza competente — non affidarti a questa app.
          </p>
          <p>
            L'uso dell'app è a proprio rischio. Chi la gestisce non risponde di decisioni prese sulla base delle
            informazioni qui contenute.
          </p>
        </Section>
        <Section title="Privacy — dati raccolti">
          <p className="mb-2">Trattiamo solo i dati necessari al funzionamento dell'app:</p>
          <p className="mb-2">
            • <span style={{ color: "#F1EEE6" }}>Email</span>, solo se scegli di accedere con il link — usata per
            associare le tue segnalazioni al tuo account. L'accesso è sempre facoltativo.
          </p>
          <p className="mb-2">
            • <span style={{ color: "#F1EEE6" }}>Posizione geografica</span> di una segnalazione, indicata da te sulla
            mappa (non tracciamo la tua posizione in background).
          </p>
          <p className="mb-2">
            • <span style={{ color: "#F1EEE6" }}>Testo delle segnalazioni</span> che scrivi volontariamente.
          </p>
          <p>
            Non vendiamo né condividiamo questi dati con terzi per finalità pubblicitarie. Puoi chiedere in qualsiasi
            momento la cancellazione del tuo account e dei tuoi dati.
          </p>
        </Section>
        <Section title="Termini di utilizzo">
          <p className="mb-2">Usando ORA accetti di:</p>
          <p className="mb-2">• non pubblicare segnalazioni false, offensive o che violino la legge;</p>
          <p className="mb-2">• non inserire dati personali propri o di terzi nel testo delle segnalazioni;</p>
          <p>
            • accettare che le segnalazioni ritenute inappropriate dalla community (tramite segnalazione/flag)
            possano essere nascoste automaticamente.
          </p>
        </Section>
        <div className="text-[11px] mt-2" style={{ color: "#6B7278" }}>
          Versione pilota — {PILOT_CITY}. Questo testo è una prima informativa e sarà rivisto con l'assistenza di un
          legale prima di un lancio pubblico più ampio.
        </div>
      </div>
    </div>
  );
}

function NumeriScreen({ onBack }) {
  return (
    <div className="flex flex-col h-full" style={{ background: "#14171A" }}>
      <Header title="Numeri utili" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {CONTACTS.map((group, gi) => (
          <div key={gi} className="mb-6">
            <div
              className="text-[11px] font-semibold uppercase mb-2"
              style={{ color: "#6B7278", letterSpacing: "0.06em" }}
            >
              {group.group}
            </div>
            {group.items.map((c, i) => (
              <a
                key={i}
                href={/^[0-9 ]+$/.test(c.number) ? `tel:${c.number.replace(/\s/g, "")}` : undefined}
                className="flex items-center justify-between py-3"
                style={{
                  borderBottom: i < group.items.length - 1 ? "1px solid #2A2F34" : "none",
                  textDecoration: "none",
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center justify-center flex-shrink-0"
                    style={{ width: 32, height: 32, borderRadius: "50%", background: "#D9534F26" }}
                  >
                    <Phone size={14} color="#D9534F" />
                  </div>
                  <div>
                    <div className="text-[14px] font-medium" style={{ color: "#F1EEE6" }}>
                      {c.label}
                    </div>
                    <div className="text-[12px] mt-0.5" style={{ color: "#6B7278" }}>
                      {c.note}
                    </div>
                  </div>
                </div>
                <span className="text-[14px] font-semibold text-right ml-3" style={{ color: "#4E8BC4", flexShrink: 0 }}>
                  {c.number}
                </span>
              </a>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function BottomNav({ tab, setTab }) {
  const items = [
    { id: "mappa", label: "Mappa", Icon: MapIcon },
    { id: "eventi", label: "Eventi", Icon: AlertTriangle },
    { id: "numeri", label: "Numeri", Icon: Phone },
    { id: "profilo", label: "Profilo", Icon: Settings },
  ];
  return (
    <div className="flex" style={{ borderTop: "1px solid #2A2F34", background: "#14171A" }}>
      {items.map((it) => {
        const active = tab === it.id;
        return (
          <button
            key={it.id}
            onClick={() => setTab(it.id)}
            className="flex-1 flex flex-col items-center gap-1 py-2.5"
          >
            <it.Icon size={18} color={active ? "#D9534F" : "#6B7278"} />
            <span
              className="text-[11px]"
              style={{ color: active ? "#D9534F" : "#6B7278", fontWeight: active ? 600 : 500 }}
            >
              {it.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function OraApp() {
  const [tab, setTab] = useState("mappa");
  const [flow, setFlow] = useState("none"); // none | report | notifiche

  const [alerts, setAlerts] = useState(INITIAL_ALERTS);
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  const [, forceTick] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [toast, setToast] = useState(null);

  // moderazione: segnalazioni della community sui contenuti non ufficiali
  const [flagCounts, setFlagCounts] = useState({});
  const [flaggedByMe, setFlaggedByMe] = useState(new Set());
  const flagAlert = (id) => {
    if (flaggedByMe.has(id)) return; // già segnalata da questa sessione: non permettere di rifarlo
    setFlaggedByMe((prev) => new Set(prev).add(id));
    setFlagCounts((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
    // se la segnalazione è salvata davvero (id "db-..."), aggiorna anche il backend
    // tramite una funzione dedicata (non un update diretto, per sicurezza)
    if (BACKEND_ENABLED && id.startsWith("db-")) {
      const realId = id.slice(3);
      loadSupabase().then((client) => {
        if (!client) return;
        client.rpc("flag_segnalazione", { row_id: realId }).then(({ error }) => {
          if (error) console.error("Errore nel salvare la segnalazione:", error.message);
        });
      });
    }
  };
  const hiddenCount = Object.values(flagCounts).filter((n) => n >= FLAG_THRESHOLD).length;

  // limite di frequenza sulle nuove segnalazioni, per contenere lo spam
  const [submissionTimes, setSubmissionTimes] = useState([]);

  // backend reale (Supabase): stato della connessione e caricamento delle
  // segnalazioni già salvate, se le chiavi sono configurate
  const [backendStatus, setBackendStatus] = useState(BACKEND_ENABLED ? "connessione" : "locale");
  const knownDbIdsRef = useRef(new Set());

  // carica le segnalazioni reali salvate su Supabase; isRefresh=true quando è un
  // ricontrollo periodico (in quel caso genera notifiche solo per le segnalazioni
  // nuove rispetto a quelle già viste, non per l'intero elenco)
  const loadReports = (isRefresh = false) => {
    if (!BACKEND_ENABLED) return;
    loadSupabase().then((client) => {
      if (!client) {
        if (!isRefresh) setBackendStatus("errore");
        return;
      }
      client
        .from("segnalazioni")
        .select("*")
        .eq("hidden", false)
        .order("created_at", { ascending: true })
        .then(({ data, error }) => {
          if (error) {
            if (!isRefresh) setBackendStatus("errore");
            return;
          }
          const loaded = (data || []).map((row) => {
            const type = REPORT_TYPES.find((t) => t.id === row.type);
            return {
              id: `db-${row.id}`,
              type: row.type,
              level: row.level,
              trust: "Segnalata",
              label: row.label,
              title: row.title,
              detail: row.detail,
              distance: distanceLabelFrom(row.lat, row.lng),
              Icon: type ? type.Icon : AlertTriangle,
              emoji: row.emoji,
              lat: row.lat,
              lng: row.lng,
              addedAt: new Date(row.created_at).getTime(),
            };
          });
          const freshOnes = loaded.filter((a) => !knownDbIdsRef.current.has(a.id));
          loaded.forEach((a) => knownDbIdsRef.current.add(a.id));
          if (freshOnes.length > 0) {
            setAlerts((prev) => [...prev, ...freshOnes]);
            // durante un ricontrollo periodico, notifica solo le segnalazioni di altri utenti
            // arrivate nel frattempo (non al primissimo caricamento della pagina)
            if (isRefresh) {
              freshOnes.forEach((a) => {
                const notif = {
                  id: `notif-${a.id}`,
                  alertId: a.id,
                  title: a.title,
                  detail: a.detail,
                  emoji: a.emoji,
                  level: a.level,
                  time: Date.now(),
                  read: false,
                };
                setNotifications((prev) => [notif, ...prev]);
                setToast(notif);
              });
            }
          }
          setBackendStatus("connesso");
          setLastUpdated(Date.now());
        });
    });
  };

  useEffect(() => {
    loadReports(false);
  }, []);

  // ricontrolla periodicamente se altri utenti hanno inviato nuove segnalazioni
  useEffect(() => {
    if (!BACKEND_ENABLED) return;
    const t = setInterval(() => loadReports(true), POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, []);

  // autenticazione (facoltativa): accesso via link inviato per email, nessuna password.
  // Se l'utente accede, le sue nuove segnalazioni restano collegate al suo account.
  const [session, setSession] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authStatus, setAuthStatus] = useState("idle"); // idle | sending | sent | errore

  useEffect(() => {
    if (!BACKEND_ENABLED) return;
    let subscription;
    loadSupabase().then((client) => {
      if (!client) return;
      client.auth.getSession().then(({ data }) => setSession(data.session));
      const { data } = client.auth.onAuthStateChange((_event, sess) => setSession(sess));
      subscription = data.subscription;
    });
    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const sendMagicLink = (email) => {
    if (!email.trim()) return;
    setAuthStatus("sending");
    loadSupabase().then((client) => {
      if (!client) {
        setAuthStatus("errore");
        return;
      }
      client.auth
        .signInWithOtp({ email: email.trim(), options: { emailRedirectTo: window.location.origin } })
        .then(({ error }) => setAuthStatus(error ? "errore" : "sent"));
    });
  };

  const signOut = () => {
    loadSupabase().then((client) => {
      if (client) client.auth.signOut();
    });
  };

  const [meteoSource, setMeteoSource] = useState("simulato"); // "simulato" | "reale" | "errore"
  const [meteoReal, setMeteoReal] = useState(null);

  // prova a collegarsi al webservice reale della Protezione Civile Emilia-Romagna;
  // se non è raggiungibile (rete assente, blocco del browser) resta sulla simulazione
  useEffect(() => {
    let cancelled = false;
    fetch(PROTEZIONE_CIVILE_URL)
      .then((r) => {
        if (!r.ok) throw new Error("risposta non valida");
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        const fields = ["temporali", "idraulica", "idrogeologica", "vento"];
        const colors = [];
        Object.keys(data).forEach((k) => {
          const zone = data[k];
          if (zone && typeof zone === "object") {
            fields.forEach((f) => {
              if (zone[f]) colors.push(zone[f]);
            });
          }
        });
        const worst = worstColor(colors) || "green";
        const level = COLOR_TO_LEVEL[worst] || "verde";
        setMeteoReal({
          title: data.titolo || "Bollettino Protezione Civile",
          detail: data.descrizionemeteo || "Nessuna descrizione disponibile per il bollettino odierno.",
          level,
          emoji: EMOJI_FOR_LEVEL[level] || "🌤️",
        });
        setMeteoSource("reale");
      })
      .catch(() => {
        if (!cancelled) setMeteoSource("errore");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ricalcola le etichette di tempo ("3 min fa"...) ogni secondo
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // il toast di nuova notifica sparisce da solo dopo qualche secondo
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const now = Date.now();
  const displayAlerts = alerts
    .map((a) => {
      const base = {
        ...a,
        time: formatAgo(now - a.addedAt),
        isNew: now - a.addedAt < 20000,
      };
      if (a.id === "meteo") {
        // il segnaposto meteo viene mostrato solo quando abbiamo dati reali dalla
        // Protezione Civile: niente più contenuti inventati per riempire la schermata
        if (!meteoReal) return null;
        return {
          ...base,
          level: meteoReal.level,
          emoji: meteoReal.emoji,
          title: meteoReal.title,
          detail: meteoReal.detail,
        };
      }
      return base;
    })
    .filter(Boolean);
  const visibleAlerts = displayAlerts.filter((a) => (flagCounts[a.id] || 0) < FLAG_THRESHOLD);
  const lastUpdatedLabel = formatAgo(now - lastUpdated);

  const [activeFilters, setActiveFilters] = useState(new Set(REPORT_TYPES.map((t) => t.id)));
  const toggleFilter = (id) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const recentSubmissions = submissionTimes.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  const rateLimited = recentSubmissions.length >= RATE_LIMIT_MAX;
  const rateLimitRetryMs = rateLimited ? RATE_LIMIT_WINDOW_MS - (now - recentSubmissions[0]) : 0;

  const submitReport = ({ typeId, type, description, lat, lng }) => {
    if (rateLimited) return; // guardia difensiva, il pulsante è già disabilitato in UI
    const distanceLabel = distanceLabelFrom(lat, lng);
    const newAlert = {
      id: `user-${Date.now()}`,
      type: typeId,
      level: type.level,
      trust: "Segnalata",
      label: type.label.toUpperCase(),
      title: `${type.label} segnalato da un utente`,
      detail: description,
      distance: distanceLabel,
      Icon: type.Icon,
      emoji: type.emoji,
      lat,
      lng,
      addedAt: Date.now(),
    };
    // aggiornamento locale immediato: l'utente vede subito la propria segnalazione
    setAlerts((prev) => [...prev, newAlert]);
    setSubmissionTimes((prev) => [...prev, Date.now()]);
    setLastUpdated(Date.now());

    // salvataggio reale in background, se il backend è configurato
    if (BACKEND_ENABLED) {
      loadSupabase().then((client) => {
        if (!client) return;
        client
          .from("segnalazioni")
          .insert({
            type: typeId,
            level: type.level,
            label: type.label.toUpperCase(),
            title: newAlert.title,
            detail: description,
            emoji: type.emoji,
            lat,
            lng,
            user_id: session?.user?.id || null,
          })
          .select()
          .single()
          .then(({ data, error }) => {
            if (error) {
              console.error("Salvataggio segnalazione non riuscito:", error.message);
              return;
            }
            // sostituisce l'id temporaneo con quello reale del database,
            // così la segnalazione risulta subito moderabile (segnalabile dalla community)
            if (data) {
              setAlerts((prev) => prev.map((a) => (a.id === newAlert.id ? { ...a, id: `db-${data.id}` } : a)));
            }
          });
      });
    }
  };

  const resetToHome = () => {
    setFlow("none");
    setTab("mappa");
  };

  let body;
  if (flow === "report") {
    body = (
      <ReportScreen
        onBack={resetToHome}
        onSubmit={submitReport}
        rateLimited={rateLimited}
        rateLimitRetryMs={rateLimitRetryMs}
      />
    );
  } else if (flow === "notifiche") {
    body = (
      <NotificationsScreen
        notifications={notifications}
        onBack={resetToHome}
        onMarkAllRead={() => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))}
        onOpen={(n) => {
          setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
          setFlow("none");
          setTab("eventi");
        }}
      />
    );
  } else if (tab === "mappa") {
    body = (
      <MapScreen
        alerts={visibleAlerts}
        lastUpdatedLabel={lastUpdatedLabel}
        activeFilters={activeFilters}
        onToggleFilter={toggleFilter}
        onOpenNumeri={() => setTab("numeri")}
        onSeeAll={() => setTab("eventi")}
        onProfile={() => setTab("profilo")}
        onNewReport={() => setFlow("report")}
        onOpenNotifications={() => setFlow("notifiche")}
        unreadCount={notifications.filter((n) => !n.read).length}
        onFlag={flagAlert}
        flaggedIds={flaggedByMe}
      />
    );
  } else if (tab === "eventi") {
    body = (
      <EventsScreen
        alerts={visibleAlerts}
        activeFilters={activeFilters}
        onToggleFilter={toggleFilter}
        onNewReport={() => setFlow("report")}
        onFlag={flagAlert}
        flaggedIds={flaggedByMe}
      />
    );
  } else if (tab === "numeri") {
    body = <NumeriScreen onBack={() => setTab("mappa")} />;
  } else if (tab === "legale") {
    body = <InfoLegaliScreen onBack={() => setTab("profilo")} />;
  } else {
    body = (
      <ProfileScreen
        onBack={() => setTab("mappa")}
        meteoSource={meteoSource}
        onOpenNumeri={() => setTab("numeri")}
        onOpenInfoLegali={() => setTab("legale")}
        hiddenCount={hiddenCount}
        backendStatus={backendStatus}
        session={session}
        authEmail={authEmail}
        onAuthEmailChange={setAuthEmail}
        authStatus={authStatus}
        onSendLink={sendMagicLink}
        onSignOut={signOut}
      />
    );
  }

  return (
    <div className="w-full min-h-screen flex items-center justify-center py-8" style={{ background: "#0B0C0D" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&display=swap');`}</style>
      <div
        className="w-full flex flex-col relative"
        style={{
          maxWidth: 400,
          height: 800,
          background: "#14171A",
          color: "#F1EEE6",
          fontFamily: "'Barlow', sans-serif",
          overflow: "hidden",
          boxShadow: "0 0 0 1px #2A2F34, 0 8px 30px rgba(0,0,0,0.5)",
        }}
      >
        <div className="flex-1 overflow-hidden relative">{body}</div>
        {flow === "none" && <BottomNav tab={tab} setTab={setTab} />}
        <NotificationToast
          notif={toast}
          onDismiss={() => setToast(null)}
          onOpen={() => {
            setNotifications((prev) => prev.map((x) => (x.id === toast.id ? { ...x, read: true } : x)));
            setToast(null);
            setFlow("none");
            setTab("eventi");
          }}
        />
      </div>
    </div>
  );
}
