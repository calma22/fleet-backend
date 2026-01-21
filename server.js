import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;
const IMO = "9829930";

app.get("/ship", async (req, res) => {
  if (!process.env.MARINETRAFFIC_API_KEY) {
    return res.status(500).json({ error: "API key missing" });
  }

  const url =
    `https://services.marinetraffic.com/api/exportvessel/v:8/` +
    `${process.env.MARINETRAFFIC_API_KEY}` +
    `/protocol:jsono/imo:${IMO}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!data || !data[0]) {
      return res.status(404).json({ error: "Ship not found" });
    }

    const ship = data[0];

    res.json({
      name: ship.SHIPNAME,
      imo: IMO,
      lat: Number(ship.LAT),
      lon: Number(ship.LON),
      speed: ship.SPEED,
      heading: ship.HEADING
    });
  } catch (err) {
    res.status(500).json({ error: "AIS fetch failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Fleet backend running on port ${PORT}`);
});
