import { useRef } from "react";
import "./LeaderboardPosition.css";

interface LeaderboardPosition {
  routeNumber: string;
  routeName: string;
  speed: number;
  totalTrams?: number;
  minSpeed?: number;
  maxSpeed?: number;
  minReportAgeSec?: number | null;
  lastUpdated?: string;
  latestLat?: number;
  latestLon?: number;
  latestVehicleId?: string;
}

function LeaderboardPosition({
  routeNumber,
  routeName,
  speed,
  totalTrams,
  minSpeed,
  maxSpeed,
  minReportAgeSec,
  lastUpdated,
  latestLat,
  latestLon,
  latestVehicleId,
}: LeaderboardPosition) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="leaderboard-position" ref={containerRef}>
      <div className="content">
        <div className="left-side">
          <div
            className={`position-route-number ${routeNumber.startsWith("3") ? "blue" : ""}`}>
            {routeNumber}
          </div>
          &nbsp;|&nbsp;
          <div className="position-route-name">{routeName}</div>
        </div>
        <div className="position-speed">{speed.toFixed(1)} km/h</div>
      </div>

      {(totalTrams !== undefined ||
        minSpeed !== undefined ||
        maxSpeed !== undefined ||
        minReportAgeSec !== undefined ||
        lastUpdated ||
        (latestLat !== undefined && latestLon !== undefined)) && (
        <>
          <div className="content meta">
            <div className="left-side">
              {totalTrams !== undefined && <span>trams: {totalTrams}</span>}
              {minSpeed !== undefined && <span>min: {minSpeed.toFixed(1)} km/h</span>}
              {maxSpeed !== undefined && <span>max: {maxSpeed.toFixed(1)} km/h</span>}
              {minReportAgeSec !== undefined && (
                <span>
                  min report age:{" "}
                  {minReportAgeSec === null ? "n/a" : `${minReportAgeSec}s`}
                </span>
              )}
              {lastUpdated && (
                <span>&nbsp;updated: {new Date(lastUpdated).toLocaleTimeString()}</span>
              )}
              {latestLat !== undefined && latestLon !== undefined && (
                <span>
                  &nbsp;latest: {latestLat.toFixed(5)}, {latestLon.toFixed(5)}
                  {latestVehicleId ? ` (${latestVehicleId})` : ""}
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default LeaderboardPosition;
