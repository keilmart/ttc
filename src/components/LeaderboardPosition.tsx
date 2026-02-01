import { useState, useEffect, useRef } from "react";
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
}: LeaderboardPosition) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 500);
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 500);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const detailsBorder = isMobile
    ? "------------------------------------"
    : "--------------------------------------------------";

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
        lastUpdated) && (
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
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default LeaderboardPosition;
