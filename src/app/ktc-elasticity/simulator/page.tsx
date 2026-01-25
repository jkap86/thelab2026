"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import chartData from "../../ktc-predictor/chart-data.json";

interface PlayerChartData {
  playerId: string;
  name: string;
  position: string;
  currentAge: number;
  yearsExp: number;
  latestKtc: number;
  historicalSnapPct?: number;
  seasons: Array<{
    year: number;
    fantasyPoints: number;
    gamesPlayed: number;
  }>;
}

const AGE_CLIFFS: Record<string, number> = {
  QB: 35,
  RB: 27,
  WR: 30,
  TE: 30,
};

function getAgeCohort(age: number): string {
  if (age <= 23) return "Rookie";
  if (age <= 28) return "Prime";
  if (age <= 32) return "Veteran";
  return "Old";
}

function getKtcTier(ktc: number): string {
  if (ktc >= 6000) return "Elite";
  if (ktc >= 3000) return "Mid";
  if (ktc >= 1000) return "Low";
  return "Depth";
}

function predictPctChange(
  age: number,
  position: string,
  ktc: number,
  fpChangePct: number,
  gamesPlayed: number = 17
): number {
  const cohort = getAgeCohort(age);
  const cliffAge = AGE_CLIFFS[position] || 30;
  const tier = getKtcTier(ktc);

  let basePct = 0;

  if (fpChangePct > 0.15) {
    const ageMultiplier =
      cohort === "Rookie" ? 0.58 : cohort === "Prime" ? 1.0 : cohort === "Veteran" ? 1.4 : 1.95;
    basePct = 0.36 * (fpChangePct / 0.15) * ageMultiplier;
  } else if (fpChangePct < -0.15) {
    const ageMultiplier =
      cohort === "Rookie" ? 1.33 : cohort === "Prime" ? 1.0 : cohort === "Veteran" ? 1.7 : 3.1;
    basePct = -0.09 * (Math.abs(fpChangePct) / 0.15) * ageMultiplier;
  } else {
    // Linear interpolation between -0.15 and 0.15
    if (fpChangePct > 0) {
      // Slight positive
      const tierBase = tier === "Elite" ? -0.02 : tier === "Mid" ? 0.02 : tier === "Low" ? 0.1 : 0.3;
      basePct = tierBase + fpChangePct * 0.5;
    } else if (fpChangePct < 0) {
      // Slight negative
      const tierBase = tier === "Elite" ? -0.05 : tier === "Mid" ? -0.04 : tier === "Low" ? 0.0 : 0.1;
      basePct = tierBase + fpChangePct * 0.3;
    } else {
      // Exactly stable
      basePct = tier === "Elite" ? -0.05 : tier === "Mid" ? -0.04 : tier === "Low" ? 0.09 : 0.53;
    }
  }

  // Adjust for games played
  if (gamesPlayed < 17) {
    // Partial season penalty
    const missingGamesPct = (17 - gamesPlayed) / 17;
    const injuryPenalty = missingGamesPct * 0.12;
    basePct -= injuryPenalty;

    // Additional penalty for old players missing games
    if (age > cliffAge) {
      basePct -= injuryPenalty * 0.6;
    }

    // Severe injury (less than half season)
    if (gamesPlayed < 8) {
      const severePenalty = ((8 - gamesPlayed) / 8) * 0.1;
      basePct -= severePenalty;
    }
  }

  return basePct;
}

export default function SimulatorPage() {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [fpChange, setFpChange] = useState(0); // -50% to +50%
  const [gamesPlayed, setGamesPlayed] = useState(17);

  const data = chartData as { players: PlayerChartData[] };

  const players = useMemo(() => {
    return data.players
      .filter((p) => ["QB", "RB", "WR", "TE"].includes(p.position))
      .sort((a, b) => b.latestKtc - a.latestKtc);
  }, [data.players]);

  const filteredPlayers = useMemo(() => {
    if (!searchQuery) return players.slice(0, 30);
    const q = searchQuery.toLowerCase();
    return players.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 30);
  }, [players, searchQuery]);

  const selectedPlayer = selectedPlayerId
    ? players.find((p) => p.playerId === selectedPlayerId)
    : null;

  const prediction = useMemo(() => {
    if (!selectedPlayer) return null;

    const pctChange = predictPctChange(
      selectedPlayer.currentAge,
      selectedPlayer.position,
      selectedPlayer.latestKtc,
      fpChange / 100,
      gamesPlayed
    );

    const predictedKtc = Math.round(selectedPlayer.latestKtc * (1 + pctChange));

    return {
      pctChange,
      predictedKtc,
      ktcDelta: predictedKtc - selectedPlayer.latestKtc,
    };
  }, [selectedPlayer, fpChange, gamesPlayed]);

  // Calculate similar player scenarios
  const similarPlayers = useMemo(() => {
    if (!selectedPlayer) return [];

    return players
      .filter(
        (p) =>
          p.playerId !== selectedPlayer.playerId &&
          p.position === selectedPlayer.position &&
          Math.abs(p.currentAge - selectedPlayer.currentAge) <= 2
      )
      .slice(0, 5)
      .map((p) => {
        const pctChange = predictPctChange(
          p.currentAge,
          p.position,
          p.latestKtc,
          fpChange / 100,
          gamesPlayed
        );
        return {
          ...p,
          pctChange,
          predictedKtc: Math.round(p.latestKtc * (1 + pctChange)),
        };
      });
  }, [selectedPlayer, players, fpChange, gamesPlayed]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/ktc-elasticity"
            className="text-blue-400 hover:text-blue-300 mb-2 inline-block"
          >
            ← Back to Elasticity
          </Link>
          <h1 className="text-3xl font-bold">Scenario Simulator</h1>
          <p className="text-gray-400">
            Select a player and adjust FP change and games played to see predicted KTC impact.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: Player Selection & Controls */}
          <div className="space-y-6">
            {/* Player Selection */}
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-gray-400 text-sm mb-2">Select Player</div>
              <input
                type="text"
                placeholder="Search players..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none mb-2"
              />
              <div className="max-h-48 overflow-y-auto space-y-1">
                {filteredPlayers.map((player) => (
                  <button
                    key={player.playerId}
                    onClick={() => setSelectedPlayerId(player.playerId)}
                    className={`w-full text-left px-3 py-2 rounded ${
                      selectedPlayerId === player.playerId
                        ? "bg-blue-600 text-white"
                        : "bg-gray-700 hover:bg-gray-600"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span>
                        {player.name} ({player.position})
                      </span>
                      <span className="text-sm text-gray-400">
                        {player.currentAge}yo | {player.latestKtc.toLocaleString()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Scenario Controls */}
            <div className="bg-gray-800 rounded-lg p-4 space-y-6">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Fantasy Points Change (YoY)</span>
                  <span className="font-mono text-lg">
                    {fpChange >= 0 ? "+" : ""}
                    {fpChange}%
                  </span>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={fpChange}
                  onChange={(e) => setFpChange(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>-50% (Decline)</span>
                  <span>0% (Stable)</span>
                  <span>+50% (Breakout)</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Games Played</span>
                  <span className="font-mono text-lg">{gamesPlayed}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="17"
                  value={gamesPlayed}
                  onChange={(e) => setGamesPlayed(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0 (Out)</span>
                  <span>8 (Half)</span>
                  <span>17 (Full)</span>
                </div>
              </div>

              {/* Quick Presets */}
              <div>
                <div className="text-gray-400 text-sm mb-2">Quick Scenarios</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setFpChange(30);
                      setGamesPlayed(17);
                    }}
                    className="px-3 py-2 bg-green-700 hover:bg-green-600 rounded text-sm"
                  >
                    Breakout Season
                  </button>
                  <button
                    onClick={() => {
                      setFpChange(-30);
                      setGamesPlayed(17);
                    }}
                    className="px-3 py-2 bg-red-700 hover:bg-red-600 rounded text-sm"
                  >
                    Major Decline
                  </button>
                  <button
                    onClick={() => {
                      setFpChange(-20);
                      setGamesPlayed(6);
                    }}
                    className="px-3 py-2 bg-orange-700 hover:bg-orange-600 rounded text-sm"
                  >
                    Injured + Decline
                  </button>
                  <button
                    onClick={() => {
                      setFpChange(0);
                      setGamesPlayed(17);
                    }}
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                  >
                    Stable Season
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Results */}
          <div className="space-y-6">
            {selectedPlayer && prediction ? (
              <>
                {/* Player Info */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-xl font-bold mb-2">{selectedPlayer.name}</h3>
                  <div className="text-gray-400 mb-4">
                    {selectedPlayer.position} | {selectedPlayer.currentAge}yo |{" "}
                    {getAgeCohort(selectedPlayer.currentAge)} | {getKtcTier(selectedPlayer.latestKtc)}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-700 rounded p-4">
                      <div className="text-gray-400 text-sm">Current KTC</div>
                      <div className="text-2xl font-bold">
                        {selectedPlayer.latestKtc.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-gray-700 rounded p-4">
                      <div className="text-gray-400 text-sm">Cliff Age</div>
                      <div className="text-2xl font-bold">
                        {AGE_CLIFFS[selectedPlayer.position] || 30}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Prediction Result */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-bold mb-4">Predicted Outcome</h3>

                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-gray-700 rounded p-4 text-center">
                      <div className="text-gray-400 text-sm">% Change</div>
                      <div
                        className={`text-2xl font-bold ${
                          prediction.pctChange >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {prediction.pctChange >= 0 ? "+" : ""}
                        {(prediction.pctChange * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="bg-gray-700 rounded p-4 text-center">
                      <div className="text-gray-400 text-sm">Predicted KTC</div>
                      <div className="text-2xl font-bold">
                        {prediction.predictedKtc.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-gray-700 rounded p-4 text-center">
                      <div className="text-gray-400 text-sm">KTC Delta</div>
                      <div
                        className={`text-2xl font-bold ${
                          prediction.ktcDelta >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {prediction.ktcDelta >= 0 ? "+" : ""}
                        {prediction.ktcDelta.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Visual Bar */}
                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="flex items-center gap-4">
                      <div className="text-right w-24">
                        <div className="text-sm text-gray-400">Start</div>
                        <div className="font-mono">
                          {selectedPlayer.latestKtc.toLocaleString()}
                        </div>
                      </div>
                      <div className="flex-1 h-8 bg-gray-600 rounded relative overflow-hidden">
                        {prediction.pctChange >= 0 ? (
                          <div
                            className="absolute left-1/2 h-full bg-green-500/50"
                            style={{
                              width: `${Math.min(prediction.pctChange * 100, 50)}%`,
                            }}
                          />
                        ) : (
                          <div
                            className="absolute right-1/2 h-full bg-red-500/50"
                            style={{
                              width: `${Math.min(Math.abs(prediction.pctChange) * 100, 50)}%`,
                            }}
                          />
                        )}
                        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/30" />
                      </div>
                      <div className="w-24">
                        <div className="text-sm text-gray-400">End</div>
                        <div className="font-mono">
                          {prediction.predictedKtc.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Similar Players */}
                {similarPlayers.length > 0 && (
                  <div className="bg-gray-800 rounded-lg p-6">
                    <h3 className="text-lg font-bold mb-4">
                      Similar Players With This Scenario
                    </h3>
                    <div className="space-y-2">
                      {similarPlayers.map((p) => (
                        <div
                          key={p.playerId}
                          className="flex justify-between items-center bg-gray-700 rounded px-4 py-2"
                        >
                          <div>
                            <span className="font-medium">{p.name}</span>
                            <span className="text-gray-400 text-sm ml-2">
                              {p.currentAge}yo
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-gray-400 text-sm mr-2">
                              {p.latestKtc.toLocaleString()} →
                            </span>
                            <span
                              className={`font-mono ${
                                p.pctChange >= 0 ? "text-green-400" : "text-red-400"
                              }`}
                            >
                              {p.pctChange >= 0 ? "+" : ""}
                              {(p.pctChange * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-gray-800 rounded-lg p-12 text-center">
                <div className="text-gray-500 text-lg">
                  Select a player to simulate scenarios
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
