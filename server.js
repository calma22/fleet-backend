import WebSocket from "ws";
import express from "express";

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
   FUNZIONE DI SIMULAZIONE
========================== */

function simulateShips() {
  const now = new Date().toISOString();
  const baseLat = 43.30;
  const baseLon = 10.50;

  ships["SIM-1"] = {
    mmsi: "SIM-1",
    lat: baseLat + Math.sin(Date.now() / 60000) * 0.05,
    lon: baseLon + Math.cos(Date.now() / 60000) * 0.05,
    speed: 14,
    heading: (Date.now() / 1000) % 360,
    timestamp: now,
    simulated: true
  };
}

/* ==========================
   TIMER FALLBACK
   (se non arrivano AIS veri)
========================== */

setInterval(() => {
  const now = Date.now();

  if (
    !lastRealDataTimestamp ||
    now - lastRealDataTimestamp > 2 * 60 * 1000 // 2 minuti
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

  ws.send(JSON.stringify({
    APIKey: AIS_API_KEY,
    BoundingBoxes: [[[-90, -180], [90, 180]]]
  }));
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
  } catch (err) {
    console.error("Invalid AIS message");
  }
});

ws.on("error", (err) => {
  console.error("WebSocket error", err.message);
});

/* ==========================
   HTTP SERVER
========================== */

const app = express();

app.get("/ships", (req, res) => {
  res.json(Object.values(ships));
});

app.get("/", (req, res) => {
  res.send("AIS backend running");
});

app.listen(PORT, () => {
  console.log("Backend running on port", PORT);
});
