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
   PRE-POPULATE FLEET (IN MEMORY)
================================ */
const ships = {};

fleetConfig.fleet.forEach(ship => {
  ships[ship.mmsi] = {
    mmsi: ship.mmsi,
    name: ship.name,

    lat: null,
    lon: null,
    speed: null,
    heading: null,

    lastSeen: null,
    state: "UNKNOWN" // LIVE | RECENT | UNKNOWN
  };
});

/* ==============================
   AISSTREAM ROBUST CONNECTION
================================ */
let ws = null;
let lastMessageAt = 0;
let reconnectTimer = null;

const AISSTREAM_URL = "wss://stream.aisstream.io/v0/stream";
const WATCHDOG_LIMIT = 5 * 60 * 1000; // 5 minuti

function connectAISStream() {
  console.log("🔌 Connecting to AISStream...");

  ws = new WebSocket(AISSTREAM_URL);

  ws.on("open", () => {
    console.log("✅ AISStream connected");
    lastMessageAt = Date.now();

    ws.send(JSON.stringify({
      APIKey: AISSTREAM_KEY,
      BoundingBoxes: [
        [[-90, -180], [90, 180]]
      ]
    }));
  });

  ws.on("message", data => {
    lastMessageAt = Date.now();

    try {
      const msg = JSON.parse(data);
      const message = msg.Message;

      if (!message?.PositionReport) return;

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
    } catch (err) {
      console.error("AISStream message parse error:", err);
    }
  });

  ws.on("close", (code, reason) => {
    console.error(
      "❌ AISStream closed",
      code,
      reason?.toString()
    );
    scheduleReconnect();
  });

  ws.on("error", err => {
    console.error("❌ AISStream error:", err);
    scheduleReconnect();
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    try {
      ws?.terminate();
    } catch {}
    connectAISStream();
  }, 5000); // 5 secondi
}

/* ==============================
   WATCHDOG (STALE CONNECTION)
================================ */
setInterval(() => {
  if (!lastMessageAt) return;

  const delta = Date.now() - lastMessageAt;

  if (delta > WATCHDOG_LIMIT) {
    console.warn(
      "⚠️ AISStream stale for",
      Math.floor(delta / 1000),
      "seconds – reconnecting"
    );

    try {
      ws?.terminate();
    } catch {}
    connectAISStream();
  }
}, 60 * 1000);

/* ==============================
   MEMORY LOGIC (12h)
================================ */
const MEMORY_LIMIT = 12 * 60 * 60 * 1000;

setInterval(() => {
  const now = Date.now();

  Object.values(ships).forEach(ship => {
    if (!ship.lastSeen) return;

    if (now - ship.lastSeen > MEMORY_LIMIT && ship.state === "LIVE") {
      ship.state = "RECENT";
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
  console.log(`🚀 Server running on port ${PORT}`);
  connectAISStream();
});