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

function calculateElasticityScore(
  age: number,
  position: string,
  ktc: number,
  snapPct: number
): number {
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

  return ageFactor * 0.35 + tierFactor * 0.25 + snapFactor * 0.15 + positionFactor * 0.25;
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
    basePct = tier === "Elite" ? -0.05 : tier === "Mid" ? -0.04 : tier === "Low" ? 0.09 : 0.53;
  }

  if (gamesPlayed < 8) {
    const injuryPenalty = ((8 - gamesPlayed) / 8) * 0.15;
    basePct -= injuryPenalty;
    if (age > cliffAge) {
      basePct -= injuryPenalty * 0.5;
    }
  }

  return basePct;
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

  if (cohort === "old") return { level: "LOW", color: "text-red-400" };
  if (tier === "depth") return { level: "LOW", color: "text-red-400" };
  if (isBackup && cohort === "rookie") return { level: "LOW", color: "text-red-400" };

  if (cohort === "prime" && (tier === "elite" || tier === "mid") && !isBackup) {
    return { level: "HIGH", color: "text-green-400" };
  }
  if (cohort === "prime" && tier === "low" && !isBackup) {
    return { level: "HIGH", color: "text-green-400" };
  }

  return { level: "MEDIUM", color: "text-yellow-400" };
}

function getPredictionRange(
  pctChange: number,
  confidence: "HIGH" | "MEDIUM" | "LOW"
): { low: number; high: number } {
  const width = confidence === "HIGH" ? 0.10 : confidence === "MEDIUM" ? 0.20 : 0.40;
  return { low: pctChange - width, high: pctChange + width };
}

interface PlayerWithElasticity extends PlayerChartData {
  elasticity: number;
  cohort: string;
  tier: string;
  confidence: { level: "HIGH" | "MEDIUM" | "LOW"; color: string };
}

function PlayerSelector({
  label,
  selectedId,
  onSelect,
  players,
  searchQuery,
  onSearchChange,
}: {
  label: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  players: PlayerWithElasticity[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
}) {
  const filteredPlayers = useMemo(() => {
    if (!searchQuery) return players.slice(0, 20);
    const q = searchQuery.toLowerCase();
    return players.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 20);
  }, [players, searchQuery]);

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="text-gray-400 text-sm mb-2">{label}</div>
      <input
        type="text"
        placeholder="Search players..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none mb-2"
      />
      <div className="max-h-48 overflow-y-auto space-y-1">
        {filteredPlayers.map((player) => (
          <button
            key={player.playerId}
            onClick={() => onSelect(player.playerId)}
            className={`w-full text-left px-3 py-2 rounded ${
              selectedId === player.playerId
                ? "bg-blue-600 text-white"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
          >
            <div className="flex justify-between items-center">
              <span>
                {player.name} ({player.position})
              </span>
              <span className="text-sm text-gray-400">{player.currentAge}yo</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function PlayerCard({ player }: { player: PlayerWithElasticity }) {
  const cliffAge = AGE_CLIFFS[player.position] || 30;
  const yearsTillCliff = Math.max(0, cliffAge - player.currentAge);

  const scenarios = {
    ifBreakout: predictPctChange(player.currentAge, player.position, player.latestKtc, 0.3, 17),
    ifDecline: predictPctChange(player.currentAge, player.position, player.latestKtc, -0.3, 17),
    ifInjury: predictPctChange(player.currentAge, player.position, player.latestKtc, -0.2, 6),
  };

  // Calculate prediction ranges
  const ranges = {
    ifBreakout: getPredictionRange(scenarios.ifBreakout, player.confidence.level),
    ifDecline: getPredictionRange(scenarios.ifDecline, player.confidence.level),
    ifInjury: getPredictionRange(scenarios.ifInjury, player.confidence.level),
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="text-center mb-4">
        <h3 className="text-xl font-bold">{player.name}</h3>
        <div className="text-gray-400">
          {player.position} | {player.currentAge}yo | {player.yearsExp}yr exp
        </div>
        <div className={`inline-block mt-2 px-2 py-1 rounded text-xs font-medium ${player.confidence.color} bg-gray-700`}>
          {player.confidence.level} Confidence
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-700 rounded p-3 text-center">
          <div className="text-gray-400 text-sm">Current KTC</div>
          <div className="text-xl font-bold">{player.latestKtc.toLocaleString()}</div>
        </div>
        <div className="bg-gray-700 rounded p-3 text-center">
          <div className="text-gray-400 text-sm">Elasticity</div>
          <div className={`text-xl font-bold ${getElasticityColor(player.elasticity)}`}>
            {(player.elasticity * 100).toFixed(0)}%
          </div>
        </div>
        <div className="bg-gray-700 rounded p-3 text-center">
          <div className="text-gray-400 text-sm">Cohort</div>
          <div className="text-lg">{player.cohort}</div>
        </div>
        <div className="bg-gray-700 rounded p-3 text-center">
          <div className="text-gray-400 text-sm">Tier</div>
          <div className="text-lg">{player.tier}</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-gray-400 text-sm mb-2">Scenario Predictions</div>

        <div className="bg-gray-700 rounded px-3 py-2">
          <div className="flex justify-between items-center">
            <span className="text-green-400">If +30% FP</span>
            <div className="text-right">
              <span className="font-mono">
                {scenarios.ifBreakout >= 0 ? "+" : ""}
                {(scenarios.ifBreakout * 100).toFixed(0)}%
              </span>
              <span className="text-gray-400 text-sm ml-2">
                ({scenarios.ifBreakout >= 0 ? "+" : ""}
                {Math.round(player.latestKtc * scenarios.ifBreakout).toLocaleString()})
              </span>
            </div>
          </div>
          <div className="text-gray-500 text-xs mt-1">
            Range: {(ranges.ifBreakout.low * 100).toFixed(0)}% to {(ranges.ifBreakout.high * 100).toFixed(0)}%
          </div>
        </div>

        <div className="bg-gray-700 rounded px-3 py-2">
          <div className="flex justify-between items-center">
            <span className="text-red-400">If -30% FP</span>
            <div className="text-right">
              <span className="font-mono">
                {scenarios.ifDecline >= 0 ? "+" : ""}
                {(scenarios.ifDecline * 100).toFixed(0)}%
              </span>
              <span className="text-gray-400 text-sm ml-2">
                ({scenarios.ifDecline >= 0 ? "+" : ""}
                {Math.round(player.latestKtc * scenarios.ifDecline).toLocaleString()})
              </span>
            </div>
          </div>
          <div className="text-gray-500 text-xs mt-1">
            Range: {(ranges.ifDecline.low * 100).toFixed(0)}% to {(ranges.ifDecline.high * 100).toFixed(0)}%
          </div>
        </div>

        <div className="bg-gray-700 rounded px-3 py-2">
          <div className="flex justify-between items-center">
            <span className="text-orange-400">If Injury (6 games)</span>
            <div className="text-right">
              <span className="font-mono">
                {scenarios.ifInjury >= 0 ? "+" : ""}
                {(scenarios.ifInjury * 100).toFixed(0)}%
              </span>
              <span className="text-gray-400 text-sm ml-2">
                ({scenarios.ifInjury >= 0 ? "+" : ""}
                {Math.round(player.latestKtc * scenarios.ifInjury).toLocaleString()})
              </span>
            </div>
          </div>
          <div className="text-gray-500 text-xs mt-1">
            Range: {(ranges.ifInjury.low * 100).toFixed(0)}% to {(ranges.ifInjury.high * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      <div className="mt-4 text-gray-400 text-sm">
        Years till cliff ({cliffAge}yo): <span className="text-white">{yearsTillCliff}</span>
      </div>
    </div>
  );
}

export default function ComparePage() {
  const [player1Id, setPlayer1Id] = useState<string | null>(null);
  const [player2Id, setPlayer2Id] = useState<string | null>(null);
  const [search1, setSearch1] = useState("");
  const [search2, setSearch2] = useState("");

  const data = chartData as { players: PlayerChartData[] };

  const players: PlayerWithElasticity[] = useMemo(() => {
    return data.players
      .filter((p) => ["QB", "RB", "WR", "TE"].includes(p.position))
      .map((player) => ({
        ...player,
        elasticity: calculateElasticityScore(
          player.currentAge,
          player.position,
          player.latestKtc,
          player.historicalSnapPct || 0.8
        ),
        cohort: getAgeCohort(player.currentAge),
        tier: getKtcTier(player.latestKtc),
        confidence: getConfidence(
          player.currentAge,
          player.latestKtc,
          player.historicalSnapPct || 0.8
        ),
      }))
      .sort((a, b) => b.latestKtc - a.latestKtc);
  }, [data.players]);

  const player1 = player1Id ? players.find((p) => p.playerId === player1Id) : null;
  const player2 = player2Id ? players.find((p) => p.playerId === player2Id) : null;

  const comparison = useMemo(() => {
    if (!player1 || !player2) return null;

    const p1Decline = predictPctChange(player1.currentAge, player1.position, player1.latestKtc, -0.3, 17);
    const p2Decline = predictPctChange(player2.currentAge, player2.position, player2.latestKtc, -0.3, 17);
    const p1Injury = predictPctChange(player1.currentAge, player1.position, player1.latestKtc, -0.2, 6);
    const p2Injury = predictPctChange(player2.currentAge, player2.position, player2.latestKtc, -0.2, 6);

    return {
      elasticityDiff: player1.elasticity - player2.elasticity,
      downsideRatio: p1Decline !== 0 ? Math.abs(p2Decline / p1Decline) : 1,
      injuryRatio: p1Injury !== 0 ? Math.abs(p2Injury / p1Injury) : 1,
      p1Decline,
      p2Decline,
      p1Injury,
      p2Injury,
    };
  }, [player1, player2]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href="/ktc-elasticity" className="text-blue-400 hover:text-blue-300 mb-2 inline-block">
            ← Back to Elasticity
          </Link>
          <h1 className="text-3xl font-bold">Compare Player Elasticity</h1>
          <p className="text-gray-400">
            Select two players to compare their value sensitivity side-by-side.
          </p>
        </div>

        {/* Player Selectors */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <PlayerSelector
            label="Player 1"
            selectedId={player1Id}
            onSelect={setPlayer1Id}
            players={players}
            searchQuery={search1}
            onSearchChange={setSearch1}
          />
          <PlayerSelector
            label="Player 2"
            selectedId={player2Id}
            onSelect={setPlayer2Id}
            players={players}
            searchQuery={search2}
            onSearchChange={setSearch2}
          />
        </div>

        {/* Comparison */}
        {player1 && player2 && comparison && (
          <>
            {/* Summary */}
            <div className="bg-gray-800 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-bold mb-4">Comparison Summary</h2>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-gray-700 rounded p-4 text-center">
                  <div className="text-gray-400 text-sm">Elasticity Difference</div>
                  <div className="text-2xl font-bold">
                    {comparison.elasticityDiff >= 0 ? "+" : ""}
                    {(comparison.elasticityDiff * 100).toFixed(0)}%
                  </div>
                  <div className="text-gray-400 text-sm">
                    {player1.name} vs {player2.name}
                  </div>
                </div>
                <div className="bg-gray-700 rounded p-4 text-center">
                  <div className="text-gray-400 text-sm">Downside Ratio</div>
                  <div className="text-2xl font-bold">{comparison.downsideRatio.toFixed(2)}x</div>
                  <div className="text-gray-400 text-sm">
                    {player2.name} loses{" "}
                    {comparison.downsideRatio > 1 ? "more" : "less"} on decline
                  </div>
                </div>
                <div className="bg-gray-700 rounded p-4 text-center">
                  <div className="text-gray-400 text-sm">Injury Impact Ratio</div>
                  <div className="text-2xl font-bold">{comparison.injuryRatio.toFixed(2)}x</div>
                  <div className="text-gray-400 text-sm">
                    {player2.name} loses{" "}
                    {comparison.injuryRatio > 1 ? "more" : "less"} on injury
                  </div>
                </div>
              </div>
            </div>

            {/* Side by Side Cards */}
            <div className="grid md:grid-cols-2 gap-6">
              <PlayerCard player={player1} />
              <PlayerCard player={player2} />
            </div>
          </>
        )}

        {/* Placeholder when no players selected */}
        {(!player1 || !player2) && (
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <div className="text-gray-500 text-lg">
              Select two players above to compare their elasticity
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
