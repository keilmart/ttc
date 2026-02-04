import { useState, useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { motion, AnimatePresence } from "framer-motion";
import "./App.css";
import LeaderboardPosition from "./components/LeaderboardPosition";
import { LeaderboardQueue, type LeaderboardData } from "./LeaderboardQueue";
import { Analytics } from "@vercel/analytics/react";

function App() {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData[]>([]);
  const [vehicleKeys, setVehicleKeys] = useState<string[]>([]);
  const [rawVehicleCount, setRawVehicleCount] = useState<number>(0);
  const [sampleVehicle, setSampleVehicle] = useState<Record<string, unknown> | null>(null);
  const [rawVehicles, setRawVehicles] = useState<Record<string, unknown>[]>([]);
  const leaderboardDataRef = useRef<LeaderboardData[]>([]);
  const leaderboardQueue = useRef(new LeaderboardQueue());
  const route_map: Record<string, string> = {
    "501": "Queen",
    "503": "Kingston",
    "504": "King",
    "505": "Dundas",
    "506": "Carlton",
    "507": "Long Branch",
    "508": "Lake Shore",
    "509": "Harbourfront",
    "510": "Spadina",
    "511": "Bathurst",
    "512": "St. Clair",
    "301": "Queen",
    "304": "King",
    "305": "Dundas",
    "306": "Carleton",
    "310": "Spadina",
    "312": "St. Clair",
  };

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch("/api/ttc");
      const data = await response.json();

      if (response.status !== 200) throw new Error(`Failed to fetch: ${response.status}`);

      const routeStats =
        data.routes ??
        data.averageSpeeds?.map((route: [string, number]) => ({
          routeNumber: route[0],
          avgSpeed: route[1],
        })) ??
        [];

      const newData: LeaderboardData[] = routeStats.map(
        (route: {
          routeNumber: string;
          avgSpeed: number;
          totalTrams?: number;
          minSpeed?: number;
          maxSpeed?: number;
          minReportAgeSec?: number | null;
          lastUpdated?: string;
        }) => ({
          routeNumber: route.routeNumber,
          speed: route.avgSpeed,
          totalTrams: route.totalTrams,
          minSpeed: route.minSpeed,
          maxSpeed: route.maxSpeed,
          minReportAgeSec: route.minReportAgeSec,
          lastUpdated: route.lastUpdated,
        }),
      );


      // Filter to find elements that are different from current leaderboard
      const changedData = newData.filter((newItem) => {
        const existingItem = leaderboardDataRef.current.find(
          (item) => item.routeNumber === newItem.routeNumber,
        );
        // Include if: doesn't exist in current data OR speed changed
        return !existingItem || existingItem.speed !== newItem.speed;
      });

      // Add changed items to the queue
      leaderboardQueue.current.upsertAll(changedData);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    }
  };

  useEffect(() => {
    fetchLeaderboard();

    const fetch_interval = setInterval(() => {
      fetchLeaderboard();
    }, 1000);

    let updateTimeoutId: ReturnType<typeof setTimeout>;

    const processNextItem = () => {
      const nextItem = leaderboardQueue.current.popFront();
      if (nextItem) {
        // Compute what the new sorted data will be using the ref
        const prevData = leaderboardDataRef.current;
        // TODO - Old method below here
        // const existingIndex = prevData.findIndex(
        //   (item) => item.routeNumber === nextItem.routeNumber,
        // );

        const existingIndex = prevData.findIndex(
          (item) => item.routeNumber === nextItem.routeNumber,
        );
        let newData: LeaderboardData[];

        if (existingIndex !== -1) {
          newData = [...prevData];
          newData[existingIndex] = nextItem;
        } else {
          newData = [...prevData, nextItem];
        }

        const sortedData = [...newData].sort((a, b) => b.speed - a.speed);

        // Check if order changed by comparing route order
        const orderChanged = sortedData.some(
          (item, index) => prevData[index]?.routeNumber !== item.routeNumber,
        );

        // Update state and ref
        leaderboardDataRef.current = sortedData;
        setLeaderboardData(sortedData);

        // If order didn't change, immediately process next item
        // Otherwise wait 1 second for animation
        updateTimeoutId = setTimeout(processNextItem, orderChanged ? 1000 : 0);
      } else {
        // Queue empty, check again in 1 second
        updateTimeoutId = setTimeout(processNextItem, 200);
      }
    };

    processNextItem();

    return () => {
      clearInterval(fetch_interval);
      clearTimeout(updateTimeoutId);
    };
  }, []);

  useEffect(() => {
    const fetchRaw = async () => {
      try {
        const response = await fetch("/api/ttc?includeRaw=1");
        const data = await response.json();
        if (response.status !== 200) throw new Error(`Failed to fetch: ${response.status}`);
        if (Array.isArray(data.vehicleKeys)) {
          setVehicleKeys(data.vehicleKeys);
        }
        if (Array.isArray(data.rawVehicles)) {
          setRawVehicleCount(data.rawVehicles.length);
          setSampleVehicle(data.rawVehicles[0] ?? null);
          setRawVehicles(data.rawVehicles);
        }
      } catch (error) {
        console.error("Error fetching raw TTC data:", error);
      }
    };

    fetchRaw();
    const interval = setInterval(fetchRaw, 5000);
    return () => clearInterval(interval);
  }, []);

  const vehicleLocations = useMemo(() => {
    const pickNumber = (v: Record<string, unknown>, keys: string[]): number | null => {
      for (const key of keys) {
        const value = v[key];
        if (typeof value === "number" && Number.isFinite(value)) return value;
        if (typeof value === "string") {
          const parsed = parseFloat(value);
          if (Number.isFinite(parsed)) return parsed;
        }
      }
      return null;
    };

    const pickString = (v: Record<string, unknown>, keys: string[]): string | null => {
      for (const key of keys) {
        const value = v[key];
        if (typeof value === "string" && value.length) return value;
      }
      return null;
    };

    return rawVehicles
      .map((vehicle) => {
        const lat = pickNumber(vehicle, ["@_lat", "lat", "latitude"]);
        const lon = pickNumber(vehicle, ["@_lon", "@_lng", "lon", "lng", "longitude"]);
        const id = pickString(vehicle, ["@_id", "id", "vehicleId"]);
        const routeTag = pickString(vehicle, ["@_routeTag", "routeTag", "route"]);
        const secsSinceReport = pickNumber(vehicle, ["@_secsSinceReport", "secsSinceReport"]);
        const speed = pickNumber(vehicle, ["@_speedKmHr", "speedKmHr", "speed"]);
        if (lat === null || lon === null) return null;
        const renderKey = id && id !== "unknown" ? id : `${routeTag ?? "unknown"}-${lat}-${lon}`;
        return {
          renderKey,
          id: id ?? "unknown",
          routeTag: routeTag ?? "unknown",
          lat,
          lon,
          secsSinceReport,
          speed,
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);
  }, [rawVehicles]);

  const latestVehicleByRoute = useMemo(() => {
    const latest: Record<string, (typeof vehicleLocations)[number]> = {};
    for (const v of vehicleLocations) {
      const existing = latest[v.routeTag];
      if (!existing) {
        latest[v.routeTag] = v;
        continue;
      }
      if (v.secsSinceReport === null || v.secsSinceReport === undefined) continue;
      if (
        existing.secsSinceReport === null ||
        existing.secsSinceReport === undefined ||
        v.secsSinceReport < existing.secsSinceReport
      ) {
        latest[v.routeTag] = v;
      }
    }
    return latest;
  }, [vehicleLocations]);

  const mapBounds = useMemo(() => {
    if (!vehicleLocations.length) {
      return { minLat: 43.58, maxLat: 43.78, minLon: -79.55, maxLon: -79.2 };
    }
    let minLat = vehicleLocations[0].lat;
    let maxLat = vehicleLocations[0].lat;
    let minLon = vehicleLocations[0].lon;
    let maxLon = vehicleLocations[0].lon;
    for (const v of vehicleLocations) {
      minLat = Math.min(minLat, v.lat);
      maxLat = Math.max(maxLat, v.lat);
      minLon = Math.min(minLon, v.lon);
      maxLon = Math.max(maxLon, v.lon);
    }
    const latPad = (maxLat - minLat) * 0.05 || 0.01;
    const lonPad = (maxLon - minLon) * 0.05 || 0.01;
    return {
      minLat: minLat - latPad,
      maxLat: maxLat + latPad,
      minLon: minLon - lonPad,
      maxLon: maxLon + lonPad,
    };
  }, [vehicleLocations]);

  const mapBoundsArray = useMemo(() => {
    return [
      [mapBounds.minLat, mapBounds.minLon],
      [mapBounds.maxLat, mapBounds.maxLon],
    ] as [[number, number], [number, number]];
  }, [mapBounds]);

  return (
    <>
      <div className="wrapper">
        <div className="leaderboard">
          <AnimatePresence>
            {leaderboardData.length == 0 ? (
              <div className="loading">Loading...</div>
            ) : (
              leaderboardData.map((position) => (
                <motion.div
                  key={position.routeNumber}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}>
                  <LeaderboardPosition
                    routeNumber={position.routeNumber}
                    routeName={route_map[position.routeNumber]}
                    speed={position.speed}
                    totalTrams={position.totalTrams}
                    minSpeed={position.minSpeed}
                    maxSpeed={position.maxSpeed}
                    minReportAgeSec={position.minReportAgeSec}
                    lastUpdated={position.lastUpdated}
                    latestLat={latestVehicleByRoute[position.routeNumber]?.lat}
                    latestLon={latestVehicleByRoute[position.routeNumber]?.lon}
                    latestVehicleId={latestVehicleByRoute[position.routeNumber]?.id}
                  />
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
        <div className="info">
          This leaderboard is live and shows the average speed<br></br>of all streetcars
          on a route with ~30 second delay.
          <details className="debug">
            <summary>API keys + sample (debug)</summary>
            <div>vehicles: {rawVehicleCount}</div>
            <div>keys ({vehicleKeys.length}):</div>
            <pre>{vehicleKeys.length ? vehicleKeys.join("\n") : "none"}</pre>
            <pre>{sampleVehicle ? JSON.stringify(sampleVehicle, null, 2) : "no sample"}</pre>
          </details>
        </div>
        <div className="map-wrapper">
          <div className="map-title">Live vehicle map (approx)</div>
          <MapContainer className="map" bounds={mapBoundsArray} scrollWheelZoom={true}>
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {vehicleLocations.map((v) => (
              <CircleMarker
                key={v.renderKey}
                center={[v.lat, v.lon]}
                radius={4}
                pathOptions={{ color: "#ff3b30", fillColor: "#ff3b30", fillOpacity: 0.8 }}
              >
                <Tooltip direction="top" offset={[0, -4]} opacity={0.9}>
                  <div>
                    <div>
                      <strong>{v.routeTag}</strong> · {v.id}
                    </div>
                    <div>
                      {v.lat.toFixed(5)}, {v.lon.toFixed(5)}
                    </div>
                    <div>speed: {v.speed ?? "n/a"} km/h</div>
                    <div>report age: {v.secsSinceReport ?? "n/a"}s</div>
                  </div>
                </Tooltip>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
        <div className="table-wrapper">
          <div className="map-title">Vehicle locations</div>
          <table className="vehicle-table">
            <thead>
              <tr>
                <th>Vehicle ID</th>
                <th>Route</th>
                <th>Lat</th>
                <th>Lon</th>
                <th>Speed</th>
                <th>Report Age</th>
              </tr>
            </thead>
            <tbody>
              {vehicleLocations.map((v) => (
                <tr key={v.renderKey}>
                  <td>{v.id}</td>
                  <td>{v.routeTag}</td>
                  <td>{v.lat.toFixed(5)}</td>
                  <td>{v.lon.toFixed(5)}</td>
                  <td>{v.speed ?? "n/a"}</td>
                  <td>{v.secsSinceReport ?? "n/a"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Analytics />
    </>
  );
}

export default App;
