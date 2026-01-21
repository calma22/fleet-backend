import WebSocket from "ws";
import express from "express";

const AIS_API_KEY = process.env.AISSTREAM_API_KEY;
const MMSI = "248995000"; // nave test
let lastPosition = null;

// --- WebSocket AISStream ---
const ws = new WebSocket("wss://stream.aisstream.io/v0/stream", {
  headers: {
    "Authorization": `Bearer ${AIS_API_KEY}`
  }
});

ws.on("open", () => {
  console.log("Connected to AISStream");

  ws.send(JSON.stringify({
    "APIKey": AIS_API_KEY,
    "BoundingBoxes": [[[-90, -180], [90, 180]]],
    "FiltersShipMMSI": [MMSI]
  }));
});

ws.on("message", (data) => {
  const msg = JSON.parse(data);

  if (msg.MessageType === "PositionReport") {
    lastPosition = {
      lat: msg.Message.PositionReport.Latitude,
      lon: msg.Message.PositionReport.Longitude,
      speed: msg.Message.PositionReport.Sog,
      heading: msg.Message.PositionReport.Cog,
      timestamp: msg.MetaData.time_utc
    };
  }
});

// --- HTTP API ---
const app = express();
app.get("/ship", (req, res) => {
  if (!lastPosition) {
    return res.json({ status: "waiting_for_data" });
  }
  res.json(lastPosition);
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Backend running");
});

