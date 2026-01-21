import WebSocket from "ws";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

/* ==========================
   PATH (necessario per ESM)
========================== */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ==========================
   CONFIG
========================== */

const AIS_API_KEY = process.env.AISSTREAM_API_KEY;
const PORT = process.env.PORT || 3000;

/* ==========================
   STATO IN MEMORIA
========================== */

const ships = {};
let lastRealDataTimestamp = null;

/* ==========================
   SIMULAZIONE (FALLBACK)
========================== */

function simulateShips() {
  const now = new Date().toISOString();
  const baseLat = 43.30;
  const baseLon = 10.50;

  ships["SIM-1"] = {
    mmsi: "SIM-1",
    lat: baseLat + Math.sin(Date.now() / 60000) * 0.1,
    lon: baseLon + Math.cos(Date.now() / 60000) * 0.1,
    speed: 12,
    heading: (Date.now() / 1000) % 360,
    timestamp: now,
    simulated: true
  };
}

/* 🔥 CREA SUBITO UNA NAVE SIMULATA ALL'AVVIO */
simulateShips();

/* ==========================
   TIMER FALLBACK
   (se non arrivano AIS veri)
========================== */

setInterval(() => {
  if (
    !lastRealDataTimestamp ||
    Date.now() - lastRealDataTimestamp > 2 * 60 * 1000
  ) {
    simulateShips();
  }
}, 15000);

/* ==========================
   WEBSOCKET AISSTREAM
========================== */

const ws = new WebSocket("wss://stream.aisstream.io/v0/stream", {
  headers: {
    Authorization: `Bearer ${AIS_API_KEY}`
  }
});

ws.on("open", () => {
  console.log("Connected to AISStream");

  ws.send(
    JSON.stringify({
      APIKey: AIS_API_KEY,
      BoundingBoxes: [[[-90, -180], [90, 180]]]
    })
  );
});

ws.on("message", (data) => {
  try {
    const msg = JSON.parse(data);

    if (msg.MessageType === "PositionReport") {
      const pr = msg.Message.PositionReport;
      const mmsi = msg.MetaData.MMSI;

      ships[mmsi] = {
        mmsi,
        lat: pr.Latitude,
        lon: pr.Longitude,
        speed: pr.Sog,
        heading: pr.Cog,
        timestamp: msg.MetaData.time_utc,
        simulated: false
      };

      lastRealDataTimestamp = Date.now();
    }
  } catch {
    // ignora messaggi non validi
  }
});

ws.on("error", (err) => {
  console.error("WebSocket error:", err.message);
});

/* ==========================
   EXPRESS SERVER
========================== */

const app = express();

/* 🔥 SERVE IL FRONTEND */
app.use(express.static(path.join(__dirname, "public")));

/* API */
app.get("/ships", (req, res) => {
  res.json(Object.values(ships));
});

/* ROOT SAFETY (extra sicurezza) */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
