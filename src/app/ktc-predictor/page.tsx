'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ComposedChart,
  Scatter,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import chartData from './chart-data.json';

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

interface ChartDataOutput {
  players: PlayerChartData[];
  metadata: {
    generatedAt: string;
    totalPlayers: number;
    totalSeasons: number;
  };
}

interface UpcomingPrediction {
  projectedFPPerGame: number;
  predictedKtc: number;
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
}

function ConfidenceBadge({ score, factors }: { score: number; factors?: ConfidenceFactors }) {
  // Color based on score: green (65+), yellow (40-64), red (<40)
  const getColor = (s: number) => {
    if (s >= 65) return 'bg-green-600 text-green-100';
    if (s >= 40) return 'bg-yellow-600 text-yellow-100';
    return 'bg-red-600 text-red-100';
  };

  return (
    <div className="inline-flex items-center gap-2">
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getColor(score)}`}>
        {score}% Confidence
      </span>
      {factors && (
        <div className="group relative">
          <span className="text-gray-500 cursor-help text-sm">ⓘ</span>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-3 bg-gray-800 rounded-lg shadow-lg border border-gray-600 text-xs z-10">
            <p className="font-semibold mb-2 text-gray-300">Confidence Factors:</p>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-400">Data Availability:</span>
                <span className="text-white">{Math.round(factors.dataAvailability * 100)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Age Factor:</span>
                <span className="text-white">{Math.round(factors.ageFactor * 100)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Historical Accuracy:</span>
                <span className="text-white">{Math.round(factors.historicalAccuracy * 100)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Performance Stability:</span>
                <span className="text-white">{Math.round(factors.performanceStability * 100)}%</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function KtcPredictorPage() {
  const data = chartData as ChartDataOutput;
  const searchParams = useSearchParams();
  const router = useRouter();

  // Read from URL params
  const selectedPlayerId = searchParams.get('player') || '';
  const projectedGames = parseInt(searchParams.get('games') || '17', 10) || 17;

  const [upcomingPredictions, setUpcomingPredictions] = useState<UpcomingPredictionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [inputText, setInputText] = useState('');

  const selectedPlayer = data.players.find(p => p.playerId === selectedPlayerId);

  // Sync input text with selected player
  useEffect(() => {
    if (selectedPlayer) {
      setInputText(`${selectedPlayer.name} (${selectedPlayer.position})`);
    } else {
      setInputText('');
    }
  }, [selectedPlayer]);

  // Initialize games param if not present
  useEffect(() => {
    if (!searchParams.has('games')) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('games', '17');
      router.replace(`?${params.toString()}`, { scroll: false });
    }
  }, [searchParams, router]);

  // Update URL params
  const setSelectedPlayerId = useCallback((playerId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (playerId) {
      params.set('player', playerId);
    } else {
      params.delete('player');
    }
    if (!params.has('games')) {
      params.set('games', '17');
    }
    router.push(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const setProjectedGames = useCallback((games: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('games', games.toString());
    router.push(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  // Handle player selection from datalist
  const handlePlayerInput = useCallback((inputValue: string) => {
    setInputText(inputValue);
    const player = data.players.find(
      p => `${p.name} (${p.position})` === inputValue
    );
    if (player) {
      setSelectedPlayerId(player.playerId);
    } else if (inputValue === '') {
      setSelectedPlayerId('');
    }
  }, [data.players, setSelectedPlayerId]);

  // Clear player selection
  const clearPlayer = useCallback(() => {
    setInputText('');
    setSelectedPlayerId('');
  }, [setSelectedPlayerId]);

  // Fetch upcoming predictions when player or games changes
  useEffect(() => {
    if (!selectedPlayerId) {
      setUpcomingPredictions(null);
      return;
    }

    setLoading(true);
    fetch(`/api/ktc-predict?playerId=${selectedPlayerId}&games=${projectedGames}`)
      .then(r => r.json())
      .then(data => {
        setUpcomingPredictions(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedPlayerId, projectedGames]);

  // Prepare historical chart data - vectors from actual to predicted
  const vectorData = selectedPlayer?.seasons.map(s => {
    const fpPerGame = s.gamesPlayed > 0 ? s.fantasyPoints / s.gamesPlayed : 0;
    return {
      x: fpPerGame,
      actual: s.actualEndKtc,
      predicted: s.predictedEndKtc,
      year: s.year,
    };
  }) || [];

  // Position-specific max FP/game for chart scaling (matches API)
  const maxFpPerGame = 25;

  return (
    <main className="min-h-screen w-full p-8 bg-gray-900 text-white">
      <h1 className="text-3xl font-bold mb-4 text-center">KTC Prediction Model</h1>
      <p className="text-center mb-6 text-gray-400">
        XGBoost Model (39 features) | R² = 0.944 | MAE = 169 pts | {data.metadata.totalPlayers} players
      </p>

      {/* Player Selector */}
      <div className="max-w-md mx-auto mb-8 relative">
        <input
          type="text"
          list="player-list"
          value={inputText}
          onChange={e => handlePlayerInput(e.target.value)}
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
          {data.players.map(player => (
            <option key={player.playerId} value={`${player.name} (${player.position})`} />
          ))}
        </datalist>
      </div>

      {selectedPlayer && (
        <>
          {/* Player Info */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-purple-400">{selectedPlayer.name}</h2>
            <p className="text-gray-400 mb-2">
              {selectedPlayer.position} | Age: {selectedPlayer.currentAge} | Exp: {selectedPlayer.yearsExp} yrs | Latest KTC: {selectedPlayer.latestKtc.toLocaleString()}
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
              <table className="w-full text-sm">
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
                  {selectedPlayer.seasons.map(season => {
                    const error = season.predictedEndKtc - season.actualEndKtc;
                    const fpPerGame = season.gamesPlayed > 0 ? season.fantasyPoints / season.gamesPlayed : 0;
                    return (
                      <tr key={season.year} className="border-b border-gray-700">
                        <td className="py-4 px-6 text-center">{season.year}</td>
                        <td className="py-4 px-6 text-center">{season.gamesPlayed}</td>
                        <td className="py-4 px-6 text-center">{fpPerGame.toFixed(1)}</td>
                        <td className="py-4 px-6 text-center text-gray-300">
                          {season.startKtc.toLocaleString()}
                        </td>
                        <td className="py-4 px-6 text-center text-purple-400">
                          {season.actualEndKtc.toLocaleString()}
                        </td>
                        <td className="py-4 px-6 text-center text-green-400">
                          {season.predictedEndKtc.toLocaleString()}
                        </td>
                        <td className={`py-4 px-6 text-center ${error > 0 ? 'text-red-400' : 'text-blue-400'}`}>
                          {error > 0 ? '+' : ''}{error.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Charts Container */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Chart 1: Historical */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-xl font-semibold mb-4 text-center">Historical Performance</h3>
              <p className="text-center text-gray-500 text-sm mb-4">
                Past seasons: Actual vs Predicted End KTC
              </p>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={vectorData} margin={{ top: 20, right: 20, bottom: 40, left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      type="number"
                      dataKey="x"
                      name="FP/Game"
                      domain={[0, maxFpPerGame]}
                      allowDataOverflow={true}
                      tick={{ fill: '#9CA3AF' }}
                      tickFormatter={(value: number) => value.toFixed(1)}
                      label={{
                        value: 'Fantasy Points / Game',
                        position: 'bottom',
                        offset: 20,
                        fill: '#9CA3AF',
                      }}
                    />
                    <YAxis
                      type="number"
                      domain={[0, 9999]}
                      allowDataOverflow={true}
                      tick={{ fill: '#9CA3AF' }}
                      tickFormatter={(value: number) => value.toLocaleString()}
                      label={{
                        value: 'End KTC',
                        angle: -90,
                        position: 'insideLeft',
                        offset: -10,
                        fill: '#9CA3AF',
                      }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        const error = d.predicted - d.actual;
                        return (
                          <div className="bg-gray-800 p-3 rounded border border-gray-600 text-sm">
                            <p className="text-gray-300 font-semibold">{d.year}</p>
                            <p className="text-gray-300">FP/Game: {d.x.toFixed(1)}</p>
                            <p className="text-purple-400">Actual: {d.actual.toLocaleString()}</p>
                            <p className="text-green-400">Predicted: {d.predicted.toLocaleString()}</p>
                            <p className={error > 0 ? 'text-red-400' : 'text-blue-400'}>
                              Error: {error > 0 ? '+' : ''}{error.toLocaleString()}
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
                          { x: d.x, y: d.predicted }
                        ]}
                        stroke={d.predicted > d.actual ? '#10B981' : '#EF4444'}
                        strokeWidth={2}
                      />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 text-center text-gray-500 text-xs">
                <p>Purple dot: Actual | Green dot: Predicted | Line: Error (green=over, red=under)</p>
              </div>
            </div>

            {/* Chart 2: Upcoming Season Prediction */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-xl font-semibold mb-4 text-center">2026 Season Projection</h3>
              <p className="text-center text-gray-500 text-sm mb-2">
                Predicted End KTC by Projected FP/Game
              </p>

              {/* Games Played Slider */}
              <div className="mb-4 px-4">
                <label htmlFor="games-slider" className="block text-sm text-gray-400 mb-1">
                  Projected Games Played: <span className="text-white font-semibold">{projectedGames}</span>
                  {upcomingPredictions?.historicalAvgGames && (
                    <span className="text-gray-500 ml-2">
                      (Historical avg: {upcomingPredictions.historicalAvgGames})
                    </span>
                  )}
                </label>
                <input
                  id="games-slider"
                  type="range"
                  min="1"
                  max="17"
                  value={projectedGames}
                  onChange={e => setProjectedGames(parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1</span>
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
                    <LineChart
                      data={upcomingPredictions.predictions}
                      margin={{ top: 20, right: 20, bottom: 40, left: 40 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis
                        dataKey="projectedFPPerGame"
                        type="number"
                        domain={[0, 'auto']}
                        tick={{ fill: '#9CA3AF' }}
                        tickFormatter={(value: number) => value.toFixed(1)}
                        label={{
                          value: 'Projected FP / Game',
                          position: 'bottom',
                          offset: 20,
                          fill: '#9CA3AF',
                        }}
                      />
                      <YAxis
                        type="number"
                        domain={[0, 9999]}
                        allowDataOverflow={true}
                        tick={{ fill: '#9CA3AF' }}
                        tickFormatter={(value: number) => value.toLocaleString()}
                        label={{
                          value: 'Predicted End KTC',
                          angle: -90,
                          position: 'insideLeft',
                          offset: -10,
                          fill: '#9CA3AF',
                        }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload as UpcomingPrediction;
                          return (
                            <div className="bg-gray-800 p-3 rounded border border-gray-600 text-sm">
                              <p className="text-gray-300">FP/Game: {d.projectedFPPerGame.toFixed(1)}</p>
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
                        dot={{ fill: '#10B981', strokeWidth: 2, r: 5 }}
                        activeDot={{ r: 8 }}
                      />
                      <ReferenceLine
                        y={selectedPlayer?.latestKtc}
                        stroke="#8B5CF6"
                        strokeDasharray="5 5"
                        strokeWidth={2}
                        label={{
                          value: `Current: ${selectedPlayer?.latestKtc.toLocaleString()}`,
                          position: 'right',
                          fill: '#8B5CF6',
                          fontSize: 12,
                        }}
                      />
                      {upcomingPredictions?.breakevenFPPerGame && (
                        <ReferenceLine
                          x={upcomingPredictions.breakevenFPPerGame}
                          stroke="#F59E0B"
                          strokeDasharray="3 3"
                          strokeWidth={2}
                          label={{
                            value: `Breakeven: ${upcomingPredictions.breakevenFPPerGame.toFixed(1)} FP/G`,
                            position: 'top',
                            fill: '#F59E0B',
                            fontSize: 11,
                          }}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-400">Select a player to see predictions</p>
                  </div>
                )}
              </div>
              {upcomingPredictions && (
                <div className="mt-4 text-center text-gray-500 text-xs">
                  <p>
                    Purple line: Current KTC | Orange line: Breakeven FP/Game to maintain value
                  </p>
                </div>
              )}
            </div>
          </div>

        </>
      )}

      {!selectedPlayer && (
        <div className="text-center text-gray-500 mt-16">
          <p className="text-lg">Select a player from the dropdown to view their KTC predictions</p>
        </div>
      )}
    </main>
  );
}
