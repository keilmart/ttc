import { useState, useEffect, useRef } from "react";
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
        }
      } catch (error) {
        console.error("Error fetching raw TTC data:", error);
      }
    };

    fetchRaw();
  }, []);

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
      </div>

      <Analytics />
    </>
  );
}

export default App;
