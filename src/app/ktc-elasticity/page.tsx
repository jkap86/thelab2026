"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import chartData from "../ktc-predictor/chart-data.json";
import elasticityModel from "../ktc-predictor/elasticity-model.json";

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
    startKtc: number;
    actualEndKtc: number;
  }>;
}

interface ChartDataOutput {
  players: PlayerChartData[];
}

const AGE_CLIFFS: Record<string, number> = {
  QB: 35,
  RB: 27,
  WR: 30,
  TE: 30,
};

function getAgeCohort(age: number): string {
  if (age <= 23) return "Rookie (21-23)";
  if (age <= 28) return "Prime (24-28)";
  if (age <= 32) return "Veteran (29-32)";
  return "Old (33+)";
}

function getKtcTier(ktc: number): string {
  if (ktc >= 6000) return "Elite";
  if (ktc >= 3000) return "Mid";
  if (ktc >= 1000) return "Low";
  return "Depth";
}

function calculateElasticityScore(
  age: number,
  position: string,
  ktc: number,
  snapPct: number
): number {
  const cliffAge = AGE_CLIFFS[position] || 30;

  let ageFactor = 0;
  if (age <= 23) ageFactor = 0.8;
  else if (age <= 28) ageFactor = 0.4;
  else if (age <= 32) ageFactor = 0.5;
  else ageFactor = 0.9;

  let tierFactor = 0;
  if (ktc < 1000) tierFactor = 0.9;
  else if (ktc < 3000) tierFactor = 0.6;
  else if (ktc < 6000) tierFactor = 0.4;
  else tierFactor = 0.3;

  const snapFactor = snapPct < 0.5 ? 0.7 : 0.3;

  let positionFactor = 0.5;
  if (position === "RB") positionFactor = 0.8;
  else if (position === "WR") positionFactor = 0.6;
  else if (position === "TE") positionFactor = 0.5;
  else if (position === "QB") positionFactor = 0.4;

  return (
    ageFactor * 0.35 + tierFactor * 0.25 + snapFactor * 0.15 + positionFactor * 0.25
  );
}

function getElasticityLabel(score: number): string {
  if (score >= 0.7) return "Very High";
  if (score >= 0.5) return "High";
  if (score >= 0.35) return "Moderate";
  return "Stable";
}

function getElasticityColor(score: number): string {
  if (score >= 0.7) return "text-red-400";
  if (score >= 0.5) return "text-orange-400";
  if (score >= 0.35) return "text-yellow-400";
  return "text-green-400";
}

function getConfidence(
  age: number,
  ktc: number,
  snapPct: number
): { level: "HIGH" | "MEDIUM" | "LOW"; color: string } {
  const cohort = age <= 23 ? "rookie" : age <= 28 ? "prime" : age <= 32 ? "veteran" : "old";
  const tier = ktc >= 6000 ? "elite" : ktc >= 3000 ? "mid" : ktc >= 1000 ? "low" : "depth";
  const isBackup = snapPct < 0.5;

  // LOW confidence
  if (cohort === "old") return { level: "LOW", color: "text-red-400" };
  if (tier === "depth") return { level: "LOW", color: "text-red-400" };
  if (isBackup && cohort === "rookie") return { level: "LOW", color: "text-red-400" };

  // HIGH confidence
  if (cohort === "prime" && (tier === "elite" || tier === "mid") && !isBackup) {
    return { level: "HIGH", color: "text-green-400" };
  }
  if (cohort === "prime" && tier === "low" && !isBackup) {
    return { level: "HIGH", color: "text-green-400" };
  }

  // MEDIUM confidence
  return { level: "MEDIUM", color: "text-yellow-400" };
}

export default function KtcElasticityPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "compare" | "leaderboard">("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPosition, setSelectedPosition] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"elasticity" | "ktc" | "age">("elasticity");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const data = chartData as ChartDataOutput;
  const model = elasticityModel as typeof elasticityModel;

  // Calculate elasticity for all players
  const playersWithElasticity = useMemo(() => {
    return data.players
      .filter((p) => ["QB", "RB", "WR", "TE"].includes(p.position))
      .map((player) => {
        const elasticity = calculateElasticityScore(
          player.currentAge,
          player.position,
          player.latestKtc,
          player.historicalSnapPct || 0.8
        );
        const confidence = getConfidence(
          player.currentAge,
          player.latestKtc,
          player.historicalSnapPct || 0.8
        );
        return {
          ...player,
          elasticity,
          cohort: getAgeCohort(player.currentAge),
          tier: getKtcTier(player.latestKtc),
          cliffAge: AGE_CLIFFS[player.position] || 30,
          confidence,
        };
      });
  }, [data.players]);

  // Filter and sort players
  const filteredPlayers = useMemo(() => {
    let filtered = playersWithElasticity;

    if (selectedPosition !== "ALL") {
      filtered = filtered.filter((p) => p.position === selectedPosition);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((p) => p.name.toLowerCase().includes(query));
    }

    filtered.sort((a, b) => {
      let aVal: number, bVal: number;
      switch (sortBy) {
        case "elasticity":
          aVal = a.elasticity;
          bVal = b.elasticity;
          break;
        case "ktc":
          aVal = a.latestKtc;
          bVal = b.latestKtc;
          break;
        case "age":
          aVal = a.currentAge;
          bVal = b.currentAge;
          break;
        default:
          aVal = a.elasticity;
          bVal = b.elasticity;
      }
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });

    return filtered;
  }, [playersWithElasticity, selectedPosition, searchQuery, sortBy, sortDir]);

  const cohortStats = model.cohort_stats;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">KTC Elasticity Analysis</h1>
          <p className="text-gray-400">
            Understand how sensitive a player&apos;s dynasty value is to performance changes.
            Compare elasticity across players and simulate scenarios.
          </p>
        </div>

        {/* Model Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Model MAE</div>
            <div className="text-2xl font-bold">{(model.metrics.mae_pct * 100).toFixed(1)}%</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Model R²</div>
            <div className="text-2xl font-bold">{model.metrics.r2.toFixed(3)}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Features</div>
            <div className="text-2xl font-bold">{model.n_features}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Version</div>
            <div className="text-2xl font-bold">{model.version}</div>
          </div>
        </div>

        {/* Cohort Stats */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">Elasticity by Age Cohort</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(cohortStats).map(([cohort, stats]) => (
              <div key={cohort} className="bg-gray-700 rounded-lg p-4">
                <div className="text-gray-300 capitalize mb-2">
                  {cohort === "old"
                    ? "Old (33+)"
                    : cohort === "veteran"
                    ? "Veteran (29-32)"
                    : cohort === "prime"
                    ? "Prime (24-28)"
                    : "Rookie (21-23)"}
                </div>
                <div className="text-2xl font-bold mb-1">
                  {stats.mean >= 0 ? "+" : ""}
                  {(stats.mean * 100).toFixed(1)}%
                </div>
                <div className="text-gray-400 text-sm">
                  Std: {(stats.std * 100).toFixed(1)}% | n={stats.n}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 border-b border-gray-700 mb-6">
          <button
            onClick={() => setActiveTab("overview")}
            className={`pb-2 px-4 ${
              activeTab === "overview"
                ? "border-b-2 border-blue-500 text-blue-400"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("leaderboard")}
            className={`pb-2 px-4 ${
              activeTab === "leaderboard"
                ? "border-b-2 border-blue-500 text-blue-400"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Leaderboard
          </button>
          <Link
            href="/ktc-elasticity/compare"
            className="pb-2 px-4 text-gray-400 hover:text-white"
          >
            Compare Players
          </Link>
          <Link
            href="/ktc-elasticity/simulator"
            className="pb-2 px-4 text-gray-400 hover:text-white"
          >
            Simulator
          </Link>
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">What is Elasticity?</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <p className="text-gray-300 mb-4">
                    Elasticity measures how sensitive a player&apos;s dynasty value is to changes in
                    performance. A highly elastic player will see large value swings based on
                    their season-to-season performance.
                  </p>
                  <ul className="space-y-2 text-gray-400">
                    <li>
                      <span className="text-red-400 font-semibold">Very High:</span> Value
                      changes dramatically with performance (old players, depth pieces)
                    </li>
                    <li>
                      <span className="text-orange-400 font-semibold">High:</span> Significant
                      value swings (young players, RBs)
                    </li>
                    <li>
                      <span className="text-yellow-400 font-semibold">Moderate:</span> Normal
                      value responsiveness (prime age players)
                    </li>
                    <li>
                      <span className="text-green-400 font-semibold">Stable:</span> Value
                      resistant to short-term performance (elite QBs)
                    </li>
                  </ul>
                </div>
                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Key Findings</h3>
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400">*</span>
                      <span>
                        When FP improves &gt;15%, old players gain <b>+70.5%</b> KTC vs{" "}
                        <b>+21.4%</b> for rookies
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400">*</span>
                      <span>
                        When FP declines &gt;15%, old players lose <b>-29.3%</b> KTC vs{" "}
                        <b>-12.4%</b> for rookies
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400">*</span>
                      <span>
                        Elite players (6000+ KTC) average <b>-4.6%</b> change (stable)
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400">*</span>
                      <span>
                        Depth players (&lt;1000 KTC) average <b>+53.3%</b> change (high
                        upside)
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard Tab */}
        {activeTab === "leaderboard" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-4">
              <input
                type="text"
                placeholder="Search players..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
              />
              <select
                value={selectedPosition}
                onChange={(e) => setSelectedPosition(e.target.value)}
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
              >
                <option value="ALL">All Positions</option>
                <option value="QB">QB</option>
                <option value="RB">RB</option>
                <option value="WR">WR</option>
                <option value="TE">TE</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
              >
                <option value="elasticity">Sort by Elasticity</option>
                <option value="ktc">Sort by KTC</option>
                <option value="age">Sort by Age</option>
              </select>
              <button
                onClick={() => setSortDir(sortDir === "desc" ? "asc" : "desc")}
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700"
              >
                {sortDir === "desc" ? "Highest First" : "Lowest First"}
              </button>
            </div>

            {/* Table */}
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="px-4 py-3 text-left">Player</th>
                    <th className="px-4 py-3 text-left">Pos</th>
                    <th className="px-4 py-3 text-right">Age</th>
                    <th className="px-4 py-3 text-right">KTC</th>
                    <th className="px-4 py-3 text-right">Elasticity</th>
                    <th className="px-4 py-3 text-left">Rating</th>
                    <th className="px-4 py-3 text-center">Confidence</th>
                    <th className="px-4 py-3 text-left">Cohort</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlayers.slice(0, 100).map((player, idx) => (
                    <tr key={player.playerId} className="border-t border-gray-700 hover:bg-gray-750">
                      <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium">{player.name}</td>
                      <td className="px-4 py-3 text-gray-400">{player.position}</td>
                      <td className="px-4 py-3 text-right">{player.currentAge}</td>
                      <td className="px-4 py-3 text-right">{player.latestKtc.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        {(player.elasticity * 100).toFixed(0)}%
                      </td>
                      <td className={`px-4 py-3 ${getElasticityColor(player.elasticity)}`}>
                        {getElasticityLabel(player.elasticity)}
                      </td>
                      <td className={`px-4 py-3 text-center ${player.confidence.color}`}>
                        {player.confidence.level}
                      </td>
                      <td className="px-4 py-3 text-gray-400">{player.cohort}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-gray-400 text-sm">
              Showing {Math.min(100, filteredPlayers.length)} of {filteredPlayers.length} players
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
