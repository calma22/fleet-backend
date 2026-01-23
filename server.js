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

/* ==============================
   PRE-POPULATE FLEET
================================ */
const ships = {};

fleetConfig.fleet.forEach(ship => {
  ships[ship.mmsi] = {
    mmsi: ship.mmsi,
    name: ship.name,
    company: ship.company_name,

    lat: null,
    lon: null,
    speed: null,
    heading: null,

    lastSeen: null,
    state: "UNKNOWN" // LIVE | RECENT | UNKNOWN
  };
});

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
  const message = msg.Message;

  if (!message) return;

  /* -------- POSITION REPORT -------- */
  if (message.PositionReport) {
    const p = message.PositionReport;
    const mmsi = String(p.UserID);
    if (!ships[mmsi]) return;

    ships[mmsi] = {
      ...ships[mmsi],
      lat: p.Latitude,
      lon: p.Longitude,
      speed: p.Sog,
      heading: p.Cog,
      lastSeen: Date.now(),
      state: "LIVE"
    };
  }

  /* -------- STATIC DATA -------- */
  if (message.StaticData || message.ShipStaticData) {
    const s = message.StaticData || message.ShipStaticData;
    const mmsi = String(s.UserID);
    if (!ships[mmsi]) return;

    // aggiorna solo presenza
    if (!ships[mmsi].lastSeen) {
      ships[mmsi].lastSeen = Date.now();
    }
  }
});

/* ==============================
   MEMORY LOGIC (12h)
================================ */
setInterval(() => {
  const now = Date.now();
  const MEMORY_LIMIT = 12 * 60 * 60 * 1000;

  Object.values(ships).forEach(ship => {
    if (!ship.lastSeen) return;

    if (now - ship.lastSeen <= MEMORY_LIMIT) {
      if (ship.state !== "LIVE") {
        ship.state = "RECENT";
      }
    } else {
      ship.state = "UNKNOWN";
    }
  });
}, 60 * 1000);

/* ==============================
   API
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
