/* =========================
   VERSION ALERT
========================= */

// Imposta il testo del pulsante al caricamento
document.getElementById("versionButton").textContent = `v${APP_VERSION}`;

// Gestione click sul pulsante versione
document.getElementById("versionButton").onclick = () => {
    alert(
        `${APP_NAME}\n` +
        `Versione: ${APP_VERSION}\n` +
        `Engine: Leaflet 1.9.4`
    );
};
/* =========================
       MAP INIT – MARINETRAFFIC STYLE
    ========================= */

    const map = L.map("map", {
      zoomControl: true,
      worldCopyJump: true,

      scrollWheelZoom: true,
      wheelDebounceTime: 120,
      wheelPxPerZoomLevel: 140,
      zoomSnap: 0.5,
      zoomDelta: 0.5,

      zoomAnimation: true,
      fadeAnimation: true,
      markerZoomAnimation: true
    });

/* FUNZIONE AUTO-FIT */
function autoFit() {
    // Usiamo direttamente la variabile definita in config.js
    // Leaflet accetta un array di coordinate direttamente in fitBounds
    map.fitBounds(WORLD_BOUNDS, {
        padding: [25, 0], // Aggiunge un piccolo margine ai bordi
        animate: true      // Rende il movimento fluido
    });
    const z = map.getBoundsZoom(WORLD_BOUNDS, true);
    map.setMinZoom(z);
    map.setMaxZoom(MAP_MAX_ZOOM);
}

/* GESTIONE ROTAZIONE E RIDIMENSIONAMENTO SMARTPHONE */
function handleResize() {
    // Aspettiamo 300ms che l'animazione di rotazione del sistema finisca
    setTimeout(() => {
        map.invalidateSize();
        autoFit();
        console.log("Mappa riadattata al nuovo orientamento");
    }, FLIP_DELAY_MS);
}

// Ascolta sia il resize generico che il cambio orientamento
window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', handleResize);

// Avvio iniziale
autoFit();

setInterval(() => {
    autoFit();
}, AUTOFIT_INTERVAL_MS); // 900000 ms = 15 minuti

/* CUSTOM RESET VIEW CONTROL - Integrato nel gruppo zoom */
const ResetControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function (map) {
        // Cerchiamo il contenitore dello zoom esistente
        const zoomContainer = document.querySelector('.leaflet-control-zoom');

        // Creiamo il pulsante reset
        const button = L.DomUtil.create('a', 'leaflet-control-reset-btn', zoomContainer);
        button.innerHTML = '⌂';
        button.title = "Reset View";
        button.href = '#';
        button.onclick = function (e) {
            e.preventDefault();
            //map.setView([20, 0], 0); // Reset a zoom 0 per vedere tutto il mondo
            autoFit();
        };

        // Restituiamo un elemento vuoto perché abbiamo già iniettato il tasto altrove
        return L.DomUtil.create('div');
    }
});

map.addControl(new ResetControl());
    /* FULLSCREEN CONTROL */
    map.addControl(
      L.control.fullscreen({
        position: "topleft",
        fullscreenElement: document.body
      })
    );

    const darkLayer = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
      { noWrap: false }
    );

    const lightLayer = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      { noWrap: false }
    );

    darkLayer.addTo(map);
    /* THEME TOGGLE */
    let isDark = true;
    const themeToggle = document.getElementById("themeToggle");

    themeToggle.onclick = () => {
      if (isDark) {
        map.removeLayer(darkLayer);
        lightLayer.addTo(map);
        themeToggle.textContent = "☀️";
      } else {
        map.removeLayer(lightLayer);
        darkLayer.addTo(map);
        themeToggle.textContent = "🌙";
      }
      isDark = !isDark;
    };

    /* SHIPS */
    const shipLayer = L.layerGroup().addTo(map);

function companyFromName(name = "") {
    const n = name.toUpperCase();

    // Cerca se il nome della nave contiene una delle chiavi definite in config.js
    const companyKey = Object.keys(COMPANY_COLORS).find(key => n.includes(key));

    // Se trova la compagnia restituisce il colore, altrimenti usa il colore DEFAULT
    return companyKey ? COMPANY_COLORS[companyKey] : COMPANY_COLORS.DEFAULT;
}

    function shipIcon(heading = 0, name = "", state = "UNKNOWN") {
      const opacity =
        state === "LIVE" ? 1 :
        state === "RECENT" ? 0.4 :
        0.15;

      return L.divIcon({
        className: "",
        html: `
          <svg width="26" height="26" viewBox="0 0 24 24"
               style="transform: rotate(${heading}deg); opacity:${opacity}">
            <polygon points="12,2 21,22 12,18 3,22"
                     fill="${companyFromName(name)}" />
          </svg>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });
    }

    async function updateShips() {
      const res = await fetch("/ships", { cache: "no-store" });
      const ships = await res.json();

      shipLayer.clearLayers();

      let live = 0;
      let recent = 0;
      const total = ships.length;

      ships.forEach(ship => {
        if (ship.state === "LIVE") live++;
        if (ship.state === "RECENT") recent++;
        if (ship.lat == null || ship.lon == null) return;

        const tooltip =
          ship.state === "LIVE"
            ? "LIVE"
            : ship.state === "RECENT"
            ? "Last seen < 12h"
            : "No live position";

        L.marker([ship.lat, ship.lon], {
          icon: shipIcon(ship.heading, ship.name, ship.state)
        })
        .addTo(shipLayer)
        .bindTooltip(
          `<b>${ship.name}</b><br>${tooltip}`,
          { direction: "top" }
        );
      });

      document.getElementById("shipCounter").textContent =
        `${live} live · ${recent} recent · ${total} total`;
    }

    updateShips();
setInterval(updateShips, REFRESH_SHIPS_MS);