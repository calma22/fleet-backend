import WebSocket from "ws";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

/* ==========================
   PATH SETUP (ESM)
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
   SIMULAZIONE FALLBACK
========================== */

function simulateShips() {
  const now = new Date().toISOString();

  ships["SIM-1"] = {
    mmsi: "SIM-1",
    lat: 43.3 + Math.sin(Date.now() / 60000) * 0.1,
    lon: 10.5 + Math.cos(Date.now() / 60000) * 0.1,
    speed: 12,
    heading: (Date.now() / 1000) % 360,
    timestamp: now,
    simulated: true
  };
}

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

/* ==========================
   EXPRESS SERVER
========================== */

const app = express();

// 🔥 SERVE IL FRONTEND
app.use(express.static(path.join(__dirname, "public")));

// API
app.get("/ships", (req, res) => {
  res.json(Object.values(ships));
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
