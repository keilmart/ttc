import type { VercelRequest, VercelResponse } from "@vercel/node";
import { XMLParser } from "fast-xml-parser";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const response = await fetch(
      "https://webservices.umoiq.com/service/publicXMLFeed?command=vehicleLocations&a=ttc",
    );

    if (!response.ok) {
      return res.status(response.status).json({ error: "Failed to fetch TTC data" });
    }

    const xmlData = await response.text();

    // Parse XML to JSON
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });
    const jsonData = parser.parse(xmlData);

    const vehicles = jsonData.body.vehicle;
    const trams: { [key: string]: { total_speed: number; total_trams: number } } = {};

    for (let vehicle of vehicles) {
      if (vehicle["@_routeTag"].length == 3 && vehicle["@_routeTag"].startsWith("5")) {
        const route = vehicle["@_routeTag"];
        if (!trams[route]) {
          trams[route] = {
            total_speed: 0,
            total_trams: 0,
          };
        }
        trams[route].total_speed += parseInt(vehicle["@_speedKmHr"]);
        trams[route].total_trams += 1;
      }
    }

    const average_speeds: { [key: string]: number } = {};

    for (let route of Object.keys(trams)) {
      average_speeds[route] = parseFloat(
        (trams[route].total_speed / trams[route].total_trams).toFixed(1),
      );
    }

    const sorted_average_speeds = Object.entries(average_speeds).sort(
      (a, b) => b[1] - a[1],
    );

    // Set CORS headers to allow requests from your frontend
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json");

    // TODO - Old method commented out below
    // return res.status(200).json(sorted_average_speeds);

    return res.status(200).json({ averageSpeeds: sorted_average_speeds });
  } catch (error) {
    console.error("Error fetching TTC data:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
