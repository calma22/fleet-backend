// VERSIONE APPLICAZIONE
const APP_VERSION = "1.1.4";
const APP_NAME = "SMCS – Worldwide Safety";


// CONFIGURAZIONE MAPPA
const WORLD_BOUNDS = [
	  [-60, -180], // Sud-Ovest
    [85, 180] // Nord-Est
];

const MAP_MAX_ZOOM = 7; // Zoom massimo della mappa

// INTERVALLI DI AGGIORNAMENTO
const REFRESH_SHIPS_MS = 30000;  // 30 secondi
const AUTOFIT_INTERVAL_MS = 900000; // 15 minuti
const FLIP_DELAY_MS = 300; // 8 secondi


// COLORI AZIENDALI
const COMPANY_COLORS = {
    "MSC": "#0a84ff",
    "COSTA": "#ffd200",
    "CARNIVAL": "#ff453a",
    "AIDA": "#ff6f00",
    "DISNEY": "#bf5af2",
    "VIKING": "#9e9e9e",
    "PRINCESS": "#5b7db1",
    "ROYAL": "#00205b",
    "NORWEGIAN": "#1c8adb",
    "VIRGIN": "#c8102e",
    "DEFAULT": "#9fa3a7"
};