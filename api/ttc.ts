import type { VercelRequest, VercelResponse } from "@vercel/node";
import { XMLParser } from "fast-xml-parser";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const includeRaw = req.query.includeRaw === "1";
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

    const vehicles = Array.isArray(jsonData.body.vehicle)
      ? jsonData.body.vehicle
      : jsonData.body.vehicle
        ? [jsonData.body.vehicle]
        : [];
    const trams: {
      [key: string]: {
        total_speed: number;
        total_trams: number;
        min_speed: number;
        max_speed: number;
        min_report_age_sec: number | null;
      };
    } = {};
    const vehicleKeys = new Set<string>();

    for (let vehicle of vehicles) {
      if (vehicle["@_routeTag"].length == 3 && vehicle["@_routeTag"].startsWith("5")) {
        const route = vehicle["@_routeTag"];
        const speed = parseInt(vehicle["@_speedKmHr"]);
        const reportAge = vehicle["@_secsSinceReport"]
          ? parseInt(vehicle["@_secsSinceReport"])
          : null;

        if (!Number.isFinite(speed)) continue;

        if (!trams[route]) {
          trams[route] = {
            total_speed: 0,
            total_trams: 0,
            min_speed: speed,
            max_speed: speed,
            min_report_age_sec: reportAge,
          };
        }
        trams[route].total_speed += speed;
        trams[route].total_trams += 1;
        trams[route].min_speed = Math.min(trams[route].min_speed, speed);
        trams[route].max_speed = Math.max(trams[route].max_speed, speed);
        if (reportAge !== null) {
          trams[route].min_report_age_sec =
            trams[route].min_report_age_sec === null
              ? reportAge
              : Math.min(trams[route].min_report_age_sec, reportAge);
        }
      }

      for (const key of Object.keys(vehicle)) {
        vehicleKeys.add(key);
      }
    }

    const average_speeds: {
      [key: string]: {
        avg_speed: number;
        total_trams: number;
        min_speed: number;
        max_speed: number;
        min_report_age_sec: number | null;
      };
    } = {};

    for (let route of Object.keys(trams)) {
      average_speeds[route] = {
        avg_speed: parseFloat((trams[route].total_speed / trams[route].total_trams).toFixed(1)),
        total_trams: trams[route].total_trams,
        min_speed: trams[route].min_speed,
        max_speed: trams[route].max_speed,
        min_report_age_sec: trams[route].min_report_age_sec,
      };
    }

    const sorted_routes = Object.entries(average_speeds)
      .map(([routeNumber, stats]) => ({
        routeNumber,
        avgSpeed: stats.avg_speed,
        totalTrams: stats.total_trams,
        minSpeed: stats.min_speed,
        maxSpeed: stats.max_speed,
        minReportAgeSec: stats.min_report_age_sec,
        lastUpdated: new Date().toISOString(),
      }))
      .sort((a, b) => b.avgSpeed - a.avgSpeed);

    // Set CORS headers to allow requests from your frontend
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json");

    return res.status(200).json({
      routes: sorted_routes,
      ...(includeRaw
        ? {
            rawVehicles: vehicles,
            vehicleKeys: Array.from(vehicleKeys).sort(),
          }
        : {}),
    });
  } catch (error) {
    console.error("Error fetching TTC data:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
