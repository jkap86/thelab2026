import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

// Load chart data to get player info
const chartDataPath = path.resolve(process.cwd(), 'src/app/ktc-predictor/chart-data.json');

const GAMES_PER_SEASON = 17;

interface SeasonData {
  year: number;
  fantasyPoints: number;
  gamesPlayed: number;
  actualEndKtc: number;
  predictedEndKtc: number;
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
  confidenceFactors: {
    dataAvailability: number;
    ageFactor: number;
    historicalAccuracy: number;
    performanceStability: number;
  };
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

/**
 * Calculate how much weight to give performance vs maintaining baseline value
 * For short seasons, performance is unreliable - we should mostly preserve value
 *
 * Returns a value 0-1 where:
 * - 0 = ignore performance entirely, keep baseline value
 * - 1 = use full performance-based calculation
 */
function getPerformanceWeight(gamesPlayed: number): number {
  if (gamesPlayed <= 1) return 0.05;  // 1 game: 5% performance, 95% baseline
  if (gamesPlayed <= 2) return 0.15;  // 2 games: 15% performance
  if (gamesPlayed <= 4) return 0.30;  // 3-4 games: 30% performance
  if (gamesPlayed <= 8) return 0.60;  // 5-8 games: 60% performance
  if (gamesPlayed <= 12) return 0.85; // 9-12 games: 85% performance
  return 1.0;                          // 13+ games: full performance weight
}

/**
 * Calculate games played adjustment factor for full seasons
 * Only applies to games 5+, short seasons handled by performance weight blending
 */
function getGamesAdjustment(gamesPlayed: number, historicalAvgGames: number): number {
  // For short seasons, adjustment is handled by performance weight blending
  if (gamesPlayed <= 4) return 1.0;

  const gamesFactor = Math.min(gamesPlayed / GAMES_PER_SEASON, 1);
  const historicalFactor = Math.min(historicalAvgGames / GAMES_PER_SEASON, 1);

  if (gamesFactor < historicalFactor) {
    // Penalty: up to 15% reduction for significantly fewer games
    return 0.85 + (gamesFactor / historicalFactor) * 0.15;
  } else {
    // Bonus: up to 10% increase for more games than average
    const bonus = Math.min((gamesFactor - historicalFactor) * 0.5, 0.1);
    return 1.0 + bonus;
  }
}

/**
 * Prediction function that scales from the most recent season
 * Uses latest season as baseline and scales proportionally by FP/game ratio
 * This ensures monotonic behavior (higher FP always = higher predicted KTC)
 */
function predictKtcForFPAndGames(
  player: PlayerChartData,
  projectedFP: number,
  projectedGames: number
): number {
  const seasons = player.seasons;

  if (seasons.length === 0) {
    return player.latestKtc;
  }

  // Get most recent season as baseline
  const latestSeason = [...seasons].sort((a, b) => b.year - a.year)[0];

  const baselineFpPerGame = latestSeason.gamesPlayed > 0
    ? latestSeason.fantasyPoints / latestSeason.gamesPlayed
    : 0;
  const baselineKtc = latestSeason.predictedEndKtc;

  // Calculate projected FP/game
  const projectedFpPerGame = projectedGames > 0 ? projectedFP / projectedGames : 0;

  // Handle edge case: no baseline FP/game
  if (baselineFpPerGame <= 0.1) {
    return player.latestKtc;
  }

  // Calculate performance ratio
  const performanceRatio = projectedFpPerGame / baselineFpPerGame;

  // Non-linear scaling that models real market behavior:
  // - Diminishing returns for gains (sqrt scaling)
  // - Steeper drops for poor performance (quadratic scaling)
  let scaledRatio: number;

  if (performanceRatio >= 1) {
    // Better than baseline: diminishing returns (sqrt)
    // ratio 1.0 → 1.0, ratio 1.5 → ~1.22, ratio 2.0 → ~1.41
    const gain = performanceRatio - 1;
    scaledRatio = 1 + Math.sqrt(gain) * 0.6; // 0.6 dampening on sqrt
  } else {
    // Worse than baseline: steeper decline (quadratic)
    // ratio 0.5 → ~0.56, ratio 0.25 → ~0.19
    const loss = 1 - performanceRatio;
    scaledRatio = 1 - (loss * loss + loss) * 0.5; // Quadratic + linear blend
  }

  // Bounds: 5% to 180% of baseline KTC (tighter than before)
  const boundedRatio = Math.max(0.05, Math.min(scaledRatio, 1.8));

  // Calculate pure performance-based prediction
  const performanceBasedKtc = baselineKtc * boundedRatio;

  // Blend performance-based prediction with baseline based on games played
  // For short seasons, rely more on baseline (injury shouldn't crater value)
  const performanceWeight = getPerformanceWeight(projectedGames);
  let predictedKtc = performanceBasedKtc * performanceWeight + baselineKtc * (1 - performanceWeight);

  // Apply games adjustment (only for 5+ games, short seasons already handled by blending)
  const historicalAvgGames = seasons.reduce((sum, s) => sum + s.gamesPlayed, 0) / seasons.length;
  const gamesAdj = getGamesAdjustment(projectedGames, historicalAvgGames);

  return Math.round(predictedKtc * gamesAdj);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const playerId = searchParams.get('playerId');
  const gamesParam = searchParams.get('games');

  if (!playerId) {
    return NextResponse.json({ error: 'playerId is required' }, { status: 400 });
  }

  // Default to 17 games (full season) if not specified
  const projectedGames = gamesParam ? parseInt(gamesParam, 10) : 17;

  if (isNaN(projectedGames) || projectedGames < 1 || projectedGames > 17) {
    return NextResponse.json({ error: 'games must be between 1 and 17' }, { status: 400 });
  }

  try {
    // Load chart data
    const chartData: ChartDataOutput = JSON.parse(fs.readFileSync(chartDataPath, 'utf-8'));

    // Find player
    const player = chartData.players.find(p => p.playerId === playerId);

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Generate predictions for FP/game range based on position
    // Points every 0.5 FP/game for smooth curve
    const positionMaxFpPerGame: Record<string, number> = {
      QB: 35,
      RB: 30,
      WR: 30,
      TE: 25,
    };

    const rangeMax = positionMaxFpPerGame[player.position] || 24;

    // Generate points at 0.5 increments from 0 to max
    const fpPerGameRange: number[] = [];
    for (let fp = 0; fp <= rangeMax; fp += 0.5) {
      fpPerGameRange.push(fp);
    }

    // Calculate historical average games for context
    const historicalAvgGames = player.seasons.length > 0
      ? Math.round(player.seasons.reduce((sum, s) => sum + s.gamesPlayed, 0) / player.seasons.length)
      : 17;

    // Generate predictions: convert FP/game to total FP for the prediction function
    const predictions = fpPerGameRange.map(fpPerGame => {
      const totalFP = fpPerGame * projectedGames;
      return {
        projectedFPPerGame: fpPerGame,
        predictedKtc: predictKtcForFPAndGames(player, totalFP, projectedGames),
      };
    });

    // Find breakeven point (where predicted KTC = current KTC)
    // Binary search for the FP/game that produces latestKtc
    let breakevenFPPerGame: number | null = null;
    const targetKtc = player.latestKtc;

    // Search between 0 and max FP/game
    const maxFpPerGame = fpPerGameRange[fpPerGameRange.length - 1];
    let low = 0;
    let high = maxFpPerGame * 1.5; // Allow some room above max

    for (let i = 0; i < 20; i++) { // 20 iterations for precision
      const mid = (low + high) / 2;
      const totalFP = mid * projectedGames;
      const predictedKtc = predictKtcForFPAndGames(player, totalFP, projectedGames);

      if (Math.abs(predictedKtc - targetKtc) < 10) {
        breakevenFPPerGame = Math.round(mid * 10) / 10; // Round to 1 decimal
        break;
      }

      if (predictedKtc < targetKtc) {
        low = mid;
      } else {
        high = mid;
      }
    }

    // If breakeven found and not already in predictions, add it
    if (breakevenFPPerGame !== null && !predictions.some(p => Math.abs(p.projectedFPPerGame - breakevenFPPerGame!) < 0.5)) {
      predictions.push({
        projectedFPPerGame: breakevenFPPerGame,
        predictedKtc: targetKtc,
      });
      // Sort by FP/game
      predictions.sort((a, b) => a.projectedFPPerGame - b.projectedFPPerGame);
    }

    return NextResponse.json({
      playerId: player.playerId,
      name: player.name,
      position: player.position,
      currentAge: player.currentAge,
      yearsExp: player.yearsExp,
      latestKtc: player.latestKtc,
      projectedGames,
      historicalAvgGames,
      confidenceScore: player.confidenceScore,
      confidenceFactors: player.confidenceFactors,
      breakevenFPPerGame,
      predictions,
    });
  } catch (error) {
    console.error('Error in ktc-predict API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
