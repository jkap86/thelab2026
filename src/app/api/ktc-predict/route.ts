import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

// Load chart data and XGBoost projection model
const chartDataPath = path.resolve(process.cwd(), 'src/app/ktc-predictor/chart-data.json');
const projectionModelPath = path.resolve(process.cwd(), 'src/app/ktc-predictor/xgboost-projection-model.json');

const GAMES_PER_SEASON = 17;
const KTC_MAX_VALUE = 9999;

// Position-specific FP thresholds for normalization
const FP_THRESHOLDS: Record<string, { elite: number; average: number; min: number }> = {
  QB: { elite: 350, average: 250, min: 150 },
  RB: { elite: 250, average: 150, min: 80 },
  WR: { elite: 250, average: 150, min: 80 },
  TE: { elite: 200, average: 120, min: 60 },
};

// Position-specific age curves
const AGE_CURVES: Record<string, { peakStart: number; peakEnd: number; careerEnd: number }> = {
  QB: { peakStart: 28, peakEnd: 34, careerEnd: 42 },
  RB: { peakStart: 23, peakEnd: 27, careerEnd: 32 },
  WR: { peakStart: 25, peakEnd: 29, careerEnd: 35 },
  TE: { peakStart: 26, peakEnd: 30, careerEnd: 36 },
};

// Position-specific cliff ages
const AGE_CLIFFS: Record<string, number> = {
  QB: 35,
  RB: 27,
  WR: 30,
  TE: 31,
};

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
  historicalSnapPct: number;
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

// XGBoost tree structure
interface XGBoostTree {
  left_children: number[];
  right_children: number[];
  split_indices: number[];
  split_conditions: number[];
  base_weights: number[];
  default_left: number[];
}

interface XGBoostModel {
  metadata: {
    model_type: string;
    n_trees: number;
    r2_score: number;
    mae: number;
    mae_ktc: number;
    n_features: number;
    feature_names: string[];
  };
  xgboost_model: {
    learner: {
      gradient_booster: {
        model: {
          trees: XGBoostTree[];
        };
      };
      learner_model_param: {
        base_score: string;
      };
    };
  };
}

// Feature extraction functions
function normalizeKtc(ktc: number): number {
  return Math.min(Math.max(ktc / KTC_MAX_VALUE, 0), 1);
}

function getAgeFactor(age: number, position: string): number {
  const curve = AGE_CURVES[position] || AGE_CURVES.WR;

  if (age >= curve.peakStart && age <= curve.peakEnd) {
    return 1.0;
  } else if (age < curve.peakStart) {
    const minAge = 21;
    const range = curve.peakStart - minAge;
    const progress = (age - minAge) / range;
    return 0.5 + (progress * 0.5);
  } else {
    const range = curve.careerEnd - curve.peakEnd;
    const decline = (age - curve.peakEnd) / range;
    return Math.max(1.0 - (decline * decline), 0);
  }
}

function getCliffYearsPenalty(age: number, position: string): number {
  const cliff = AGE_CLIFFS[position] || AGE_CLIFFS.WR;
  if (age < cliff) return 0;
  const yearsOver = age - cliff;
  return Math.min((yearsOver / 2) ** 2, 1);
}

function normalizeYearsExp(yearsExp: number): number {
  return Math.min(yearsExp / 10, 1);
}

function normalizeFP(fp: number, position: string): number {
  const thresholds = FP_THRESHOLDS[position] || FP_THRESHOLDS.WR;

  if (fp >= thresholds.elite) {
    return Math.min(1.0 + ((fp - thresholds.elite) / thresholds.elite) * 0.2, 1.2);
  } else if (fp >= thresholds.average) {
    const range = thresholds.elite - thresholds.average;
    return 0.5 + ((fp - thresholds.average) / range) * 0.5;
  } else if (fp >= thresholds.min) {
    const range = thresholds.average - thresholds.min;
    return ((fp - thresholds.min) / range) * 0.5;
  } else {
    return Math.max(fp / thresholds.min * 0.25, 0);
  }
}

function encodePosition(position: string): { is_qb: number; is_rb: number; is_wr: number; is_te: number } {
  return {
    is_qb: position === 'QB' ? 1 : 0,
    is_rb: position === 'RB' ? 1 : 0,
    is_wr: position === 'WR' ? 1 : 0,
    is_te: position === 'TE' ? 1 : 0,
  };
}

// Extract features for projection model (19 features with breakout detection)
function extractProjectionFeatures(
  startKtc: number,
  age: number,
  yearsExp: number,
  position: string,
  historicalSnapPct: number,
  baselineFP: number, // Historical average FP
  projectedFP: number,
  projectedGames: number,
  ktc30dTrend: number,  // NEW: 30-day KTC trend
  ktc90dTrend: number,  // NEW: 90-day KTC trend
  draftRoundValue: number,  // NEW: Draft round value (0.5 default)
  draftPickValue: number    // NEW: Draft pick value (0.5 default)
): number[] {
  const positionEncoding = encodePosition(position);
  const projectedFpNormalized = normalizeFP(projectedFP, position);
  const baselineFpNormalized = normalizeFP(baselineFP, position);

  // Calculate fp_improvement: how much better than baseline (capped -0.5 to 1.0)
  const rawImprovement = projectedFpNormalized - baselineFpNormalized;
  const fpImprovement = Math.max(-0.5, Math.min(rawImprovement, 1.0));

  // Breakout potential: high projected FP + low snap % = high breakout potential
  const breakoutPotential = projectedFpNormalized * (1 - historicalSnapPct);

  // Is backup: binary flag for low snap %
  const isBackup = historicalSnapPct < 0.65 ? 1 : 0;

  // Features in the same order as PROJECTION_FEATURE_NAMES (19 features):
  // start_ktc, age_factor, years_exp_normalized, historical_snap_pct, cliff_years_penalty,
  // ktc_30d_trend, ktc_90d_trend, draft_round_value, draft_pick_value,
  // is_qb, is_rb, is_wr, is_te, projected_fp_normalized, projected_games_factor,
  // baseline_fp_normalized, fp_improvement, breakout_potential, is_backup
  return [
    normalizeKtc(startKtc),
    getAgeFactor(age, position),
    normalizeYearsExp(yearsExp),
    historicalSnapPct,
    getCliffYearsPenalty(age, position),
    ktc30dTrend,       // NEW
    ktc90dTrend,       // NEW
    draftRoundValue,   // NEW
    draftPickValue,    // NEW
    positionEncoding.is_qb,
    positionEncoding.is_rb,
    positionEncoding.is_wr,
    positionEncoding.is_te,
    projectedFpNormalized,
    Math.min(projectedGames / GAMES_PER_SEASON, 1),
    baselineFpNormalized,
    fpImprovement,
    breakoutPotential,
    isBackup,
  ];
}

// Predict using a single XGBoost tree
function predictXGBoostTree(tree: XGBoostTree, features: number[]): number {
  let nodeIdx = 0;

  // Traverse until we hit a leaf (left_children[nodeIdx] === -1)
  while (tree.left_children[nodeIdx] !== -1) {
    const featureIdx = tree.split_indices[nodeIdx];
    const threshold = tree.split_conditions[nodeIdx];
    const featureValue = features[featureIdx];

    // Check for missing value (NaN) - use default direction
    if (Number.isNaN(featureValue)) {
      nodeIdx = tree.default_left[nodeIdx] === 1
        ? tree.left_children[nodeIdx]
        : tree.right_children[nodeIdx];
    } else if (featureValue < threshold) {
      nodeIdx = tree.left_children[nodeIdx];
    } else {
      nodeIdx = tree.right_children[nodeIdx];
    }
  }

  return tree.base_weights[nodeIdx];
}

// Predict using XGBoost (sum of all trees + base_score)
function predictXGBoost(model: XGBoostModel, features: number[]): number {
  // Parse base_score - XGBoost stores it as '[value]' string format
  const baseScoreStr = model.xgboost_model.learner.learner_model_param.base_score;
  const cleanedStr = baseScoreStr.replace(/[\[\]]/g, '');
  const baseScore = parseFloat(cleanedStr);

  const trees = model.xgboost_model.learner.gradient_booster.model.trees;

  let sum = baseScore;
  for (const tree of trees) {
    sum += predictXGBoostTree(tree, features);
  }

  return sum;
}

// Load model (cached)
let cachedModel: XGBoostModel | null = null;

function loadProjectionModel(): XGBoostModel {
  if (!cachedModel) {
    cachedModel = JSON.parse(fs.readFileSync(projectionModelPath, 'utf-8'));
  }
  return cachedModel!;
}

// Calculate baseline FP from player's historical seasons
function calculateBaselineFP(player: PlayerChartData): number {
  if (player.seasons.length === 0) return 0;

  const totalFP = player.seasons.reduce((sum, s) => sum + s.fantasyPoints, 0);
  const totalGames = player.seasons.reduce((sum, s) => sum + s.gamesPlayed, 0);
  const avgFpPerGame = totalGames > 0 ? totalFP / totalGames : 0;

  // Return annualized baseline (FP per full season)
  return avgFpPerGame * GAMES_PER_SEASON;
}

// Prediction function using the projection model
function predictKtcForFPAndGames(
  player: PlayerChartData,
  baselineFP: number,
  projectedFP: number,
  projectedGames: number
): number {
  const model = loadProjectionModel();

  const features = extractProjectionFeatures(
    player.latestKtc,
    player.currentAge,
    player.yearsExp,
    player.position,
    player.historicalSnapPct || 0.8,
    baselineFP,
    projectedFP,
    projectedGames,
    player.ktc30dTrend || 0,  // NEW: KTC momentum
    player.ktc90dTrend || 0,  // NEW: KTC momentum
    0.5,  // NEW: Draft round value (default, not available in chart data)
    0.5   // NEW: Draft pick value (default, not available in chart data)
  );

  const predictedNorm = predictXGBoost(model, features);
  const predictedKtc = Math.round(predictedNorm * KTC_MAX_VALUE);

  // Cap at 9999
  return Math.min(predictedKtc, KTC_MAX_VALUE);
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

    // Calculate baseline FP for breakout detection
    const baselineFP = calculateBaselineFP(player);

    // Generate predictions for FP/game range (0-25 PPG for all positions)
    const rangeMax = 25;

    // Generate points at 0.5 increments from 0 to max
    const fpPerGameRange: number[] = [];
    for (let fp = 0; fp <= rangeMax; fp += 0.5) {
      fpPerGameRange.push(fp);
    }

    // Calculate historical average games for context
    const historicalAvgGames = player.seasons.length > 0
      ? Math.round(player.seasons.reduce((sum, s) => sum + s.gamesPlayed, 0) / player.seasons.length)
      : 17;

    // Generate predictions using the projection model
    const predictions = fpPerGameRange.map(fpPerGame => {
      const totalFP = fpPerGame * projectedGames;
      return {
        projectedFPPerGame: fpPerGame,
        predictedKtc: predictKtcForFPAndGames(player, baselineFP, totalFP, projectedGames),
      };
    });

    // Find breakeven point (where predicted KTC = current KTC)
    let breakevenFPPerGame: number | null = null;
    const targetKtc = player.latestKtc;

    // Binary search for breakeven
    const maxFpPerGame = fpPerGameRange[fpPerGameRange.length - 1];
    let low = 0;
    let high = maxFpPerGame * 1.5;

    for (let i = 0; i < 20; i++) {
      const mid = (low + high) / 2;
      const totalFP = mid * projectedGames;
      const predictedKtc = predictKtcForFPAndGames(player, baselineFP, totalFP, projectedGames);

      if (Math.abs(predictedKtc - targetKtc) < 10) {
        breakevenFPPerGame = Math.round(mid * 10) / 10;
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
