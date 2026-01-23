import express from "express";
import WebSocket from "ws";
import fs from "fs";

const PORT = process.env.PORT || 3000;
const AISSTREAM_KEY =
  process.env.AISSTREAM_KEY || process.env.AISSTREAM_API_KEY;

const app = express();
app.use(express.static("public"));

/* ==============================
   LOAD FLEET CONFIG
================================ */
const fleetConfig = JSON.parse(
  fs.readFileSync("./ships.json", "utf-8")
);

const ALLOWED_MMSI = fleetConfig.fleet.map(s => s.mmsi);

/* ==============================
   IN-MEMORY SHIP STATE
================================ */
const ships = {};

/* ==============================
   AISSTREAM CONNECTION
================================ */
const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");

ws.on("open", () => {
  console.log("Connected to AISStream");

  ws.send(JSON.stringify({
    APIKey: AISSTREAM_KEY,
    BoundingBoxes: [
      [[-90, -180], [90, 180]]
    ]
  }));
});

ws.on("message", data => {
  const msg = JSON.parse(data);

  if (!msg.Message?.PositionReport) return;

  const p = msg.Message.PositionReport;
  const mmsi = String(p.UserID);

  if (!ALLOWED_MMSI.includes(mmsi)) return;

  const shipInfo = fleetConfig.fleet.find(s => s.mmsi === mmsi);

  ships[mmsi] = {
    mmsi,
    name: shipInfo?.name || "Unknown",
    lat: p.Latitude,
    lon: p.Longitude,
    speed: p.Sog,
    heading: p.Cog,

    lastSeen: Date.now(),
    isLive: true
  };
});

/* ==============================
   MEMORY LOGIC (12 HOURS)
================================ */
setInterval(() => {
  const now = Date.now();
  const MEMORY_LIMIT = 12 * 60 * 60 * 1000;

  Object.values(ships).forEach(ship => {
    if (now - ship.lastSeen > MEMORY_LIMIT) {
      ship.isLive = false;
    }
  });
}, 60 * 1000);

/* ==============================
   API ENDPOINT
================================ */
app.get("/ships", (req, res) => {
  res.json(Object.values(ships));
});

/* ==============================
   START SERVER
================================ */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
