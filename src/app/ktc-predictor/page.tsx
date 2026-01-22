"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ComposedChart,
  Scatter,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
} from "recharts";
import chartData from "./chart-data.json";

interface SeasonData {
  year: number;
  fantasyPoints: number;
  gamesPlayed: number;
  startKtc: number;
  actualEndKtc: number;
  predictedEndKtc: number;
}

interface ConfidenceFactors {
  dataAvailability: number;
  ageFactor: number;
  historicalAccuracy: number;
  performanceStability: number;
}

interface PlayerChartData {
  playerId: string;
  name: string;
  position: string;
  currentAge: number;
  yearsExp: number;
  latestKtc: number;
  ktc30dTrend: number;
  ktc90dTrend: number;
  confidenceScore: number;
  confidenceFactors: ConfidenceFactors;
  seasons: SeasonData[];
}

interface YearModelMetrics {
  trainYears: string;
  trainSamples: number;
  testSamples: number;
  mae: number;
  r2: number;
}

interface ChartDataOutput {
  players: PlayerChartData[];
  metadata: {
    generatedAt: string;
    totalPlayers: number;
    totalSeasons: number;
    modelsByYear?: Record<string, YearModelMetrics>;
  };
}

interface UpcomingPrediction {
  projectedFPPerGame: number;
  predictedKtc: number;
}

interface ActualPerformance {
  gamesPlayed: number;
  fpPerGame: number;
  actualEndKtc: number;
  predictedAtActualFP: number;
}

interface UpcomingPredictionResponse {
  playerId: string;
  name: string;
  position: string;
  currentAge: number;
  yearsExp: number;
  latestKtc: number;
  projectedGames: number;
  historicalAvgGames: number;
  confidenceScore: number;
  confidenceFactors: ConfidenceFactors;
  breakevenFPPerGame: number | null;
  predictions: UpcomingPrediction[];
  // Historical mode fields
  isHistorical?: boolean;
  historicalYear?: number;
  actualPerformance?: ActualPerformance;
}

function ConfidenceBadge({
  score,
  factors,
}: {
  score: number;
  factors?: ConfidenceFactors;
}) {
  // Color based on score: green (65+), yellow (40-64), red (<40)
  const getColor = (s: number) => {
    if (s >= 65) return "bg-green-600 text-green-100";
    if (s >= 40) return "bg-yellow-600 text-yellow-100";
    return "bg-red-600 text-red-100";
  };

  return (
    <div className="inline-flex items-center gap-2">
      <span
        className={`px-3 py-1 rounded-full text-sm font-medium ${getColor(score)}`}
      >
        {score}% Confidence
      </span>
      {factors && (
        <div className="group relative">
          <span className="text-gray-500 cursor-help text-sm">ⓘ</span>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-3 bg-gray-800 rounded-lg shadow-lg border border-gray-600 text-xs z-10">
            <p className="font-semibold mb-2 text-gray-300">
              Confidence Factors:
            </p>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-400">Data Availability:</span>
                <span className="text-white">
                  {Math.round(factors.dataAvailability * 100)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Age Factor:</span>
                <span className="text-white">
                  {Math.round(factors.ageFactor * 100)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Historical Accuracy:</span>
                <span className="text-white">
                  {Math.round(factors.historicalAccuracy * 100)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Performance Stability:</span>
                <span className="text-white">
                  {Math.round(factors.performanceStability * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Available years for filtering
const AVAILABLE_YEARS = [2022, 2023, 2024, 2025] as const;

function KtcPredictorContent() {
  const data = chartData as ChartDataOutput;
  const searchParams = useSearchParams();
  const router = useRouter();

  // Read from URL params
  const selectedPlayerId = searchParams.get("player") || "";
  const projectedGames = parseInt(searchParams.get("games") || "17", 10) || 17;
  const selectedYear = parseInt(searchParams.get("year") || "0", 10) as
    | (typeof AVAILABLE_YEARS)[number]
    | 0;

  const [upcomingPredictions, setUpcomingPredictions] =
    useState<UpcomingPredictionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [inputText, setInputText] = useState("");

  // Get model metrics for selected year
  const yearMetrics =
    selectedYear && data.metadata.modelsByYear
      ? data.metadata.modelsByYear[selectedYear.toString()]
      : null;

  const selectedPlayer = data.players.find(
    (p) => p.playerId === selectedPlayerId,
  );

  // Sync input text with selected player
  useEffect(() => {
    if (selectedPlayer) {
      setInputText(`${selectedPlayer.name} (${selectedPlayer.position})`);
    } else {
      setInputText("");
    }
  }, [selectedPlayer]);

  // Initialize games param if not present
  useEffect(() => {
    if (!searchParams.has("games")) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("games", "17");
      router.replace(`?${params.toString()}`, { scroll: false });
    }
  }, [searchParams, router]);

  // Update URL params
  const setSelectedPlayerId = useCallback(
    (playerId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (playerId) {
        params.set("player", playerId);
      } else {
        params.delete("player");
      }
      if (!params.has("games")) {
        params.set("games", "17");
      }
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [searchParams, router],
  );

  const setProjectedGames = useCallback(
    (games: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("games", games.toString());
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [searchParams, router],
  );

  const setSelectedYear = useCallback(
    (year: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (year === 0) {
        params.delete("year");
      } else {
        params.set("year", year.toString());
      }
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [searchParams, router],
  );

  // When year changes, set games to actual games played that season
  useEffect(() => {
    if (selectedYear !== 0 && selectedPlayer) {
      const historicalSeason = selectedPlayer.seasons.find(
        (s) => s.year === selectedYear,
      );
      // Only update if different to prevent infinite loop
      if (historicalSeason && historicalSeason.gamesPlayed !== projectedGames) {
        setProjectedGames(historicalSeason.gamesPlayed);
      }
    }
  }, [selectedYear, selectedPlayer, projectedGames, setProjectedGames]);

  // Handle player selection from datalist
  const handlePlayerInput = useCallback(
    (inputValue: string) => {
      setInputText(inputValue);
      const player = data.players.find(
        (p) => `${p.name} (${p.position})` === inputValue,
      );
      if (player) {
        setSelectedPlayerId(player.playerId);
      } else if (inputValue === "") {
        setSelectedPlayerId("");
      }
    },
    [data.players, setSelectedPlayerId],
  );

  // Clear player selection
  const clearPlayer = useCallback(() => {
    setInputText("");
    setSelectedPlayerId("");
  }, [setSelectedPlayerId]);

  // Fetch upcoming predictions when player, games, or year changes
  useEffect(() => {
    if (!selectedPlayerId) {
      setUpcomingPredictions(null);
      return;
    }

    setLoading(true);

    // Build URL with optional year parameter
    let url = `/api/ktc-predict?playerId=${selectedPlayerId}&games=${projectedGames}`;
    if (selectedYear !== 0) {
      url += `&year=${selectedYear}`;
    }

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setUpcomingPredictions(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedPlayerId, projectedGames, selectedYear]);

  // Filter seasons by selected year (0 = all years)
  // Historical Performance shows years BEFORE selected year (model's track record)
  const filteredSeasons =
    selectedPlayer?.seasons.filter(
      (s) => selectedYear === 0 || s.year < selectedYear,
    ) || [];

  // Prepare historical chart data - vectors from actual to predicted (filtered by year)
  // Only include seasons with valid predictions (not -1)
  const vectorData = filteredSeasons
    .filter((s) => s.predictedEndKtc >= 0)
    .map((s) => {
      const fpPerGame = s.gamesPlayed > 0 ? s.fantasyPoints / s.gamesPlayed : 0;
      return {
        x: fpPerGame,
        actual: s.actualEndKtc,
        predicted: s.predictedEndKtc,
        year: s.year,
      };
    });

  // Position-specific max FP/game for chart scaling (matches API)
  const maxFpPerGame = 25;

  return (
    <main className="min-h-screen w-full p-8 bg-gray-900 text-white">
      <h1 className="text-3xl font-bold mb-4 text-center">
        KTC Prediction Model
      </h1>
      <p className="text-center mb-2 text-gray-400 text-[1.5rem]">
        XGBoost Model (39 features) | Rolling Year Validation |{" "}
        {data.metadata.totalPlayers} players
      </p>

      {/* Year Filter Tabs */}
      <div className="flex justify-center gap-2 mb-6 text-[2rem]">
        {AVAILABLE_YEARS.map((year) => {
          const metrics = data.metadata.modelsByYear?.[year.toString()];
          return (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={`relative group px-4 py-2 rounded-lg transition-colors ${
                selectedYear === year
                  ? "bg-purple-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {year}
              {metrics && (
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block whitespace-nowrap px-3 py-2 bg-gray-800 rounded-lg shadow-lg border border-gray-600 text-[1.5rem] text-gray-300 z-10">
                  Trained on {metrics.trainYears}, MAE:{" "}
                  {Math.round(metrics.mae)} pts
                </span>
              )}
            </button>
          );
        })}
        <button
          onClick={() => setSelectedYear(0)}
          className={`relative group px-4 py-2 rounded-lg transition-colors ${
            selectedYear === 0
              ? "bg-purple-600 text-white"
              : "bg-gray-800 text-gray-400 hover:bg-gray-700"
          }`}
        >
          2026
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block whitespace-nowrap px-3 py-2 bg-gray-800 rounded-lg shadow-lg border border-gray-600 text-[1.5rem] text-gray-300 z-10">
            Model trained on 2021-2025 (all data)
          </span>
        </button>
      </div>

      {/* Year-specific model info */}
      {yearMetrics && (
        <p className="text-center mb-6 text-[1.5rem] text-gray-500">
          Model trained on{" "}
          <span className="text-purple-400">{yearMetrics.trainYears}</span> | R²
          = <span className="text-green-400">{yearMetrics.r2.toFixed(4)}</span>{" "}
          | MAE ={" "}
          <span className="text-yellow-400">
            {Math.round(yearMetrics.mae)} pts
          </span>
        </p>
      )}
      {selectedYear === 0 && (
        <p className="text-center mb-6 text-[1.5rem] text-gray-500">
          2026 Projection | Model trained on{" "}
          <span className="text-purple-400">2021-2025</span> (all available
          data)
        </p>
      )}

      {/* Player Selector */}
      <div className="max-w-md mx-auto mb-8 relative">
        <input
          type="text"
          list="player-list"
          value={inputText}
          onChange={(e) => handlePlayerInput(e.target.value)}
          placeholder="Search for a player..."
          className="w-full p-3 pr-10 bg-gray-800 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
        {inputText && (
          <button
            onClick={clearPlayer}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            type="button"
          >
            ✕
          </button>
        )}
        <datalist id="player-list">
          {data.players.map((player) => (
            <option
              key={player.playerId}
              value={`${player.name} (${player.position})`}
            />
          ))}
        </datalist>
      </div>

      {selectedPlayer && (
        <>
          {/* Player Info */}
          <div className="text-center mb-8">
            <h2 className="text-[2rem] font-bold text-purple-400">
              {selectedPlayer.name}
            </h2>
            <p className="text-gray-400 mb-2 text-[1.5rem]">
              {selectedPlayer.position} | Age: {selectedPlayer.currentAge} |
              Exp: {selectedPlayer.yearsExp} yrs | Latest KTC:{" "}
              {selectedPlayer.latestKtc.toLocaleString()}
            </p>
            <ConfidenceBadge
              score={selectedPlayer.confidenceScore}
              factors={selectedPlayer.confidenceFactors}
            />
          </div>

          {/* Season History Table */}
          <div className="mb-8 bg-gray-800 rounded-lg p-4">
            <h3 className="text-xl font-semibold mb-4">Season History</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xl font-black">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="py-4 px-6 text-center">Year</th>
                    <th className="py-4 px-6 text-center">Games</th>
                    <th className="py-4 px-6 text-center">FP/Game</th>
                    <th className="py-4 px-6 text-center">Start KTC</th>
                    <th className="py-4 px-6 text-center">Actual End KTC</th>
                    <th className="py-4 px-6 text-center">Predicted End KTC</th>
                    <th className="py-4 px-6 text-center">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSeasons.map((season) => {
                    const hasPrediction = season.predictedEndKtc >= 0;
                    const error = hasPrediction
                      ? season.predictedEndKtc - season.actualEndKtc
                      : 0;
                    const fpPerGame =
                      season.gamesPlayed > 0
                        ? season.fantasyPoints / season.gamesPlayed
                        : 0;
                    return (
                      <tr
                        key={season.year}
                        className="border-b border-gray-700"
                      >
                        <td className="py-4 px-6 text-center h-[3rem]">
                          {season.year}
                        </td>
                        <td className="py-4 px-6 text-center">
                          {season.gamesPlayed}
                        </td>
                        <td className="py-4 px-6 text-center">
                          {fpPerGame.toFixed(1)}
                        </td>
                        <td className="py-4 px-6 text-center text-gray-300">
                          {season.startKtc.toLocaleString()}
                        </td>
                        <td className="py-4 px-6 text-center text-purple-400">
                          {season.actualEndKtc.toLocaleString()}
                        </td>
                        <td className="py-4 px-6 text-center text-green-400">
                          {hasPrediction ? (
                            season.predictedEndKtc.toLocaleString()
                          ) : (
                            <span className="text-gray-500">N/A</span>
                          )}
                        </td>
                        <td
                          className={`py-4 px-6 text-center ${hasPrediction ? (error > 0 ? "text-red-400" : "text-blue-400") : ""}`}
                        >
                          {hasPrediction ? (
                            (error > 0 ? "+" : "") + error.toLocaleString()
                          ) : (
                            <span className="text-gray-500">N/A</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Charts Container */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-xl">
            {/* Chart 1: Historical */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-xl font-semibold mb-4 text-center">
                Historical Performance {selectedYear ? `(${selectedYear})` : ""}
              </h3>
              <p className="text-center text-gray-500 text-xl mb-4">
                {selectedYear
                  ? `${selectedYear} season: Out-of-sample prediction (model trained on ${yearMetrics?.trainYears || "prior years"})`
                  : "Past seasons: Actual vs Predicted End KTC (rolling validation)"}
              </p>
              <div className="h-[400px]">
                {filteredSeasons.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-400">
                      {`No historical data before ${selectedYear}`}
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={vectorData}
                      margin={{ top: 20, right: 20, bottom: 40, left: 40 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis
                        type="number"
                        dataKey="x"
                        name="FP/Game"
                        domain={[0, maxFpPerGame]}
                        allowDataOverflow={true}
                        ticks={[0, 5, 10, 15, 20, 25]}
                        tick={{ fill: "#9CA3AF" }}
                        label={{
                          value: "Fantasy Points / Game",
                          position: "bottom",
                          offset: 20,
                          fill: "#9CA3AF",
                        }}
                      />
                      <YAxis
                        type="number"
                        domain={[0, 9999]}
                        allowDataOverflow={true}
                        ticks={[
                          0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000,
                          9000,
                        ]}
                        interval={0}
                        tick={{ fill: "#9CA3AF", fontSize: 11 }}
                        tickFormatter={(value: number) =>
                          value.toLocaleString()
                        }
                        label={{
                          value: "End KTC",
                          angle: -90,
                          position: "insideLeft",
                          offset: -10,
                          fill: "#9CA3AF",
                        }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          const error = d.predicted - d.actual;
                          return (
                            <div className="bg-gray-800 p-3 rounded border border-gray-600 text-xl">
                              <p className="text-gray-300 font-semibold">
                                {d.year}
                              </p>
                              <p className="text-gray-300">
                                FP/Game: {d.x.toFixed(1)}
                              </p>
                              <p className="text-purple-400">
                                Actual: {d.actual.toLocaleString()}
                              </p>
                              <p className="text-green-400">
                                Predicted: {d.predicted.toLocaleString()}
                              </p>
                              <p
                                className={
                                  error > 0 ? "text-red-400" : "text-blue-400"
                                }
                              >
                                Error: {error > 0 ? "+" : ""}
                                {error.toLocaleString()}
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Legend />
                      <Scatter
                        name="Actual End KTC"
                        dataKey="actual"
                        fill="#8B5CF6"
                      />
                      <Scatter
                        name="Predicted End KTC"
                        dataKey="predicted"
                        fill="#10B981"
                      />
                      {/* Draw vectors from actual to predicted */}
                      {vectorData.map((d, i) => (
                        <ReferenceLine
                          key={i}
                          segment={[
                            { x: d.x, y: d.actual },
                            { x: d.x, y: d.predicted },
                          ]}
                          stroke={
                            d.predicted > d.actual ? "#10B981" : "#EF4444"
                          }
                          strokeWidth={2}
                        />
                      ))}
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="mt-4 text-center text-gray-500 text-xl">
                <p>
                  Purple: Actual KTC | Green: Predicted KTC | Line:{" "}
                  <span className="text-green-500">overestimated</span> /{" "}
                  <span className="text-red-500">underestimated</span>
                </p>
              </div>
            </div>

            {/* Chart 2: Upcoming/Historical Season Projection */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-xl font-semibold mb-4 text-center">
                {selectedYear !== 0
                  ? `${selectedYear} Season Projection (Historical)`
                  : "2026 Season Projection"}
              </h3>
              <p className="text-center text-gray-500 mb-2">
                {selectedYear !== 0
                  ? `What the model would have predicted before the ${selectedYear} season`
                  : "Predicted End KTC by Projected FP/Game"}
              </p>

              {/* Games Played Slider */}
              <div className="mb-4 px-4">
                <label
                  htmlFor="games-slider"
                  className="block text-gray-400 mb-1"
                >
                  Projected Games Played:{" "}
                  <span className="text-white font-semibold">
                    {projectedGames}
                  </span>
                  {upcomingPredictions?.isHistorical &&
                  upcomingPredictions.actualPerformance ? (
                    <span className="text-gray-500 ml-2">
                      (Actual:{" "}
                      {upcomingPredictions.actualPerformance.gamesPlayed})
                    </span>
                  ) : (
                    upcomingPredictions?.historicalAvgGames && (
                      <span className="text-gray-500 ml-2">
                        (Historical avg:{" "}
                        {upcomingPredictions.historicalAvgGames})
                      </span>
                    )
                  )}
                </label>
                <input
                  id="games-slider"
                  type="range"
                  min="0"
                  max="17"
                  value={projectedGames}
                  onChange={(e) =>
                    setProjectedGames(parseInt(e.target.value, 10))
                  }
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0</span>
                  <span>9</span>
                  <span>17</span>
                </div>
              </div>
              <div className="h-[400px]">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-400">Loading predictions...</p>
                  </div>
                ) : upcomingPredictions ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={upcomingPredictions.predictions}
                      margin={{ top: 20, right: 20, bottom: 40, left: 40 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis
                        dataKey="projectedFPPerGame"
                        type="number"
                        domain={[0, 25]}
                        ticks={[0, 5, 10, 15, 20, 25]}
                        tick={{ fill: "#9CA3AF" }}
                        label={{
                          value: "Projected FP / Game",
                          position: "bottom",
                          offset: 20,
                          fill: "#9CA3AF",
                        }}
                      />
                      <YAxis
                        type="number"
                        domain={[0, 9999]}
                        allowDataOverflow={true}
                        ticks={[
                          0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000,
                          9000,
                        ]}
                        interval={0}
                        tick={{ fill: "#9CA3AF", fontSize: 11 }}
                        tickFormatter={(value: number) =>
                          value.toLocaleString()
                        }
                        label={{
                          value: "Predicted End KTC",
                          angle: -90,
                          position: "insideLeft",
                          offset: -10,
                          fill: "#9CA3AF",
                        }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload as UpcomingPrediction;
                          return (
                            <div className="bg-gray-800 p-3 rounded border border-gray-600 text-sm">
                              <p className="text-gray-300">
                                FP/Game: {d.projectedFPPerGame.toFixed(1)}
                              </p>
                              <p className="text-green-400 font-semibold">
                                Predicted KTC: {d.predictedKtc.toLocaleString()}
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="predictedKtc"
                        stroke="#10B981"
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 8 }}
                      />
                      {/* Reference line for start/current KTC */}
                      <ReferenceLine
                        y={upcomingPredictions.latestKtc}
                        stroke="#8B5CF6"
                        strokeDasharray="5 5"
                        strokeWidth={2}
                        label={{
                          value: upcomingPredictions.isHistorical
                            ? `Start: ${upcomingPredictions.latestKtc.toLocaleString()}`
                            : `Current: ${upcomingPredictions.latestKtc.toLocaleString()}`,
                          position: "right",
                          fill: "#8B5CF6",
                          fontSize: 12,
                        }}
                      />
                      {/* Breakeven line */}
                      {upcomingPredictions?.breakevenFPPerGame && (
                        <ReferenceLine
                          x={upcomingPredictions.breakevenFPPerGame}
                          stroke="#F59E0B"
                          strokeDasharray="3 3"
                          strokeWidth={2}
                          label={{
                            value: `Breakeven: ${upcomingPredictions.breakevenFPPerGame.toFixed(1)} FP/G`,
                            position: "top",
                            fill: "#F59E0B",
                            fontSize: 11,
                          }}
                        />
                      )}
                      {/* Historical mode: Show actual outcome markers */}
                      {upcomingPredictions.isHistorical &&
                        upcomingPredictions.actualPerformance && (
                          <>
                            {/* Actual end KTC marker (purple) */}
                            <ReferenceDot
                              x={
                                upcomingPredictions.actualPerformance.fpPerGame
                              }
                              y={
                                upcomingPredictions.actualPerformance
                                  .actualEndKtc
                              }
                              r={8}
                              fill="#8B5CF6"
                              stroke="#fff"
                              strokeWidth={2}
                            />
                            {/* Predicted KTC at actual FP/game marker (green) */}
                            <ReferenceDot
                              x={
                                upcomingPredictions.actualPerformance.fpPerGame
                              }
                              y={
                                upcomingPredictions.actualPerformance
                                  .predictedAtActualFP
                              }
                              r={8}
                              fill="#10B981"
                              stroke="#fff"
                              strokeWidth={2}
                            />
                            {/* Error vector line between predicted and actual */}
                            <ReferenceLine
                              segment={[
                                {
                                  x: upcomingPredictions.actualPerformance
                                    .fpPerGame,
                                  y: upcomingPredictions.actualPerformance
                                    .predictedAtActualFP,
                                },
                                {
                                  x: upcomingPredictions.actualPerformance
                                    .fpPerGame,
                                  y: upcomingPredictions.actualPerformance
                                    .actualEndKtc,
                                },
                              ]}
                              stroke={
                                upcomingPredictions.actualPerformance
                                  .actualEndKtc >
                                upcomingPredictions.actualPerformance
                                  .predictedAtActualFP
                                  ? "#10B981"
                                  : "#EF4444"
                              }
                              strokeWidth={3}
                            />
                          </>
                        )}
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-400">
                      Select a player to see predictions
                    </p>
                  </div>
                )}
              </div>
              {upcomingPredictions && (
                <div className="mt-4 text-center text-gray-500">
                  {upcomingPredictions.isHistorical &&
                  upcomingPredictions.actualPerformance ? (
                    <p>
                      Purple: Actual (
                      {upcomingPredictions.actualPerformance.actualEndKtc.toLocaleString()}
                      ) | Green: Predicted (
                      {upcomingPredictions.actualPerformance.predictedAtActualFP.toLocaleString()}
                      ) |
                      {upcomingPredictions.actualPerformance
                        .predictedAtActualFP >
                      upcomingPredictions.actualPerformance.actualEndKtc ? (
                        <span className="text-green-500">
                          {" "}
                          overestimated by{" "}
                          {(
                            upcomingPredictions.actualPerformance
                              .predictedAtActualFP -
                            upcomingPredictions.actualPerformance.actualEndKtc
                          ).toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-red-500">
                          {" "}
                          underestimated by{" "}
                          {(
                            upcomingPredictions.actualPerformance.actualEndKtc -
                            upcomingPredictions.actualPerformance
                              .predictedAtActualFP
                          ).toLocaleString()}
                        </span>
                      )}
                    </p>
                  ) : (
                    <p>
                      Purple line: Current KTC | Orange line: Breakeven FP/Game
                      to maintain value
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!selectedPlayer && (
        <div className="text-center text-gray-500 mt-16">
          <p className="text-[1.5rem]">
            Select a player from the dropdown to view their KTC predictions
          </p>
        </div>
      )}
    </main>
  );
}

export default function KtcPredictorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-900 text-white p-8">
          Loading...
        </div>
      }
    >
      <KtcPredictorContent />
    </Suspense>
  );
}
