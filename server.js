import WebSocket from "ws";
import express from "express";

/**
 * CONFIG
 */
const AIS_API_KEY = process.env.AISSTREAM_API_KEY;
const PORT = process.env.PORT || 3000;

/**
 * MMSI DA ASCOLTARE
 * (navi molto attive per test + la tua)
 */
const MMSI_LIST = [
  "211331640", // cargo molto attivo (test)
  "249097000", // tanker
  "235091089", // container
  "248995000"  // tua nave
];

/**
 * Stato in memoria
 */
const ships = {};

/**
 * WEBSOCKET AISSTREAM
 */
const ws = new WebSocket("wss://stream.aisstream.io/v0/stream", {
  headers: {
    Authorization: `Bearer ${AIS_API_KEY}`
  }
});

ws.on("open", () => {
  console.log("Connected to AISStream");

  ws.send(JSON.stringify({
    APIKey: AIS_API_KEY,
    BoundingBoxes: [[[-90, -180], [90, 180]]],
    FiltersShipMMSI: MMSI_LIST
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
        timestamp: msg.MetaData.time_utc
      };
    }
  } catch (err) {
    console.error("Invalid AIS message", err);
  }
});

ws.on("error", (err) => {
  console.error("WebSocket error", err);
});

/**
 * HTTP API
 */
const app = express();

app.get("/ships", (req, res) => {
  res.json(Object.values(ships));
});

app.get("/ship", (req, res) => {
  const first = Object.values(ships)[0];
  if (!first) {
    return res.json({ status: "waiting_for_data" });
  }
  res.json(first);
});

app.listen(PORT, () => {
  console.log("Backend running on port", PORT);
});
