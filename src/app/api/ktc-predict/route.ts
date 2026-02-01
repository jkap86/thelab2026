import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

// Projection model inference (replaces LSTM)
import {
  predictProjection,
  ProjectionInput,
  getProjectionModelInfo,
} from './projection-inference';

// Load chart data and optimized models
const chartDataPath = path.resolve(process.cwd(), 'src/app/ktc-predictor/chart-data.json');

const GAMES_PER_SEASON = 17;
const KTC_MAX_VALUE = 9999;

// Age cliffs by position (same as Python model)
const AGE_CLIFFS: Record<string, number> = {
  QB: 35,
  RB: 27,
  WR: 30,
  TE: 30,
};

interface SeasonData {
  year: number;
  fantasyPoints: number;
  gamesPlayed: number;
  startKtc: number;
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


// ============================================================================
// Training Data Types and Loader (for real weekly data)
// ============================================================================

interface TrainingWeeklyStats {
  week: number;
  fantasy_points: number;
  games_played: number;
  snap_pct: number;
}

interface TrainingWeeklyKtc {
  week: number;
  ktc: number;
  date?: string;
}

interface TrainingSeason {
  year: number;
  start_ktc: number;
  end_ktc: number;
  fantasy_points: number;
  games_played: number;
  age: number;
  years_exp: number;
  weekly_stats: TrainingWeeklyStats[];
  weekly_ktc: TrainingWeeklyKtc[];
  draft_round?: number | null;
}

interface TrainingPlayer {
  player_id: string;
  name: string;
  position: string;
  seasons: TrainingSeason[];
}

interface TrainingData {
  players: TrainingPlayer[];
}

// Cache for training data (loaded once, used for historical years with real weekly data)
let trainingDataCache: TrainingData | null = null;

function loadTrainingData(): TrainingData | null {
  if (trainingDataCache) return trainingDataCache;

  try {
    // Training data is in models/ktc/data/ relative to project root
    const trainingPath = path.resolve(process.cwd(), '../models/ktc/data/training-data.json');
    if (!fs.existsSync(trainingPath)) {
      // Try alternate path (for when cwd is project root)
      const altPath = path.resolve(process.cwd(), 'models/ktc/data/training-data.json');
      if (fs.existsSync(altPath)) {
        trainingDataCache = JSON.parse(fs.readFileSync(altPath, 'utf-8'));
        return trainingDataCache;
      }
      console.warn('Training data not found at:', trainingPath, 'or', altPath);
      return null;
    }

    trainingDataCache = JSON.parse(fs.readFileSync(trainingPath, 'utf-8'));
    return trainingDataCache;
  } catch (error) {
    console.error('Failed to load training data:', error);
    return null;
  }
}

// ============================================================================
// Projection Model Prediction (replaces LSTM)
// ============================================================================

/**
 * Predict KTC using the projection model.
 * Takes games and PPG directly - no need for weekly sequence data.
 */
function predictWithProjection(
  player: PlayerChartData,
  projectedTotalFP: number,
  projectedGames: number,
  startKtc?: number,
  age?: number,
  yearsExp?: number,
  modelYear: number = 2026
): number {
  const effectiveStartKtc = startKtc ?? player.latestKtc;
  const effectiveAge = age ?? player.currentAge;
  const effectiveYearsExp = yearsExp ?? player.yearsExp;

  // Calculate PPG from total FP and games
  const ppg = projectedGames > 0 ? projectedTotalFP / projectedGames : 0;

  // Get prior season data from player seasons
  const sortedSeasons = [...player.seasons].sort((a, b) => a.year - b.year);
  const latestSeason = sortedSeasons[sortedSeasons.length - 1];
  const priorSeasonFp = latestSeason?.fantasyPoints || 0;
  const priorSeasonGames = latestSeason?.gamesPlayed || 0;

  // Build projection input
  const input: ProjectionInput = {
    position: player.position,
    age: effectiveAge,
    yearsExp: effectiveYearsExp,
    currentKtc: effectiveStartKtc,
    draftRound: 4, // Default to mid-round if unknown
    priorSeasonFp,
    priorSeasonGames,
    snapPct: player.historicalSnapPct || 0.8,
    games: projectedGames,
    ppg,
  };

  return predictProjection(input, modelYear);
}

/**
 * Helper function to calculate weekly KTC trend based on FP per game.
 * Uses position-specific expectations to determine if performance is
 * elite, average, or poor - and returns the corresponding weekly trend %.
 */
function calculateWeeklyKtcTrend(
  fpPerGame: number,
  position: string
): number {
  const positionFpExpectations: Record<string, { low: number; avg: number; high: number }> = {
    'QB': { low: 12, avg: 18, high: 24 },
    'RB': { low: 8, avg: 12, high: 18 },
    'WR': { low: 8, avg: 12, high: 18 },
    'TE': { low: 6, avg: 10, high: 15 },
  };

  const expectations = positionFpExpectations[position] || positionFpExpectations['WR'];

  if (fpPerGame >= expectations.high) {
    // Elite performance → strong positive KTC trend (+1-2% per week)
    const excessFp = (fpPerGame - expectations.high) / expectations.high;
    return 0.01 + Math.min(excessFp * 0.01, 0.01);
  } else if (fpPerGame >= expectations.avg) {
    // Above average → slight positive trend (0 to +1% per week)
    const ratio = (fpPerGame - expectations.avg) / (expectations.high - expectations.avg);
    return ratio * 0.01;
  } else if (fpPerGame >= expectations.low) {
    // Below average → slight negative trend (0 to -1% per week)
    const ratio = (expectations.avg - fpPerGame) / (expectations.avg - expectations.low);
    return -ratio * 0.01;
  } else {
    // Poor performance → strong negative trend (-1-2% per week)
    const deficitRatio = Math.min((expectations.low - fpPerGame) / expectations.low, 1);
    return -0.01 - deficitRatio * 0.01;
  }
}

/**
 * Predict using training data for historical seasons.
 * With the projection model, we just need games/ppg and player context.
 */
function predictWithHistoricalData(
  player: PlayerChartData,
  trainingSeason: TrainingSeason,
  projectedTotalFP: number,
  projectedGames: number,
  startKtcOverride?: number,
  modelYear: number = 2026
): number {
  // Use override if provided, otherwise use season's start_ktc
  const baseStartKtc = startKtcOverride ?? trainingSeason.start_ktc;

  // Calculate PPG
  const ppg = projectedGames > 0 ? projectedTotalFP / projectedGames : 0;

  // Get prior season FP from training data
  const priorSeasonFp = trainingSeason.fantasy_points || 0;
  const priorSeasonGames = trainingSeason.games_played || 0;

  // Build projection input
  const input: ProjectionInput = {
    position: player.position,
    age: trainingSeason.age,
    yearsExp: trainingSeason.years_exp,
    currentKtc: baseStartKtc,
    draftRound: trainingSeason.draft_round ?? 4,
    priorSeasonFp,
    priorSeasonGames,
    snapPct: player.historicalSnapPct ?? 0.8,
    games: projectedGames,
    ppg,
  };

  return predictProjection(input, modelYear);
}

// ============================================================================
// Feature Extraction (148 features matching Python model)
// ============================================================================

function normalizeKtc(ktc: number): number {
  return Math.min(ktc / KTC_MAX_VALUE, 1.0);
}

function normalizeAge(age: number): number {
  return Math.max(0, Math.min((age - 21) / 15, 1.0));
}

function normalizeYearsExp(yearsExp: number): number {
  return Math.min(yearsExp / 10, 1.0);
}

function normalizeFp(fp: number): number {
  return Math.min(fp / 400, 1.0);
}

function normalizeGames(games: number): number {
  return Math.min(games / 17, 1.0);
}

function normalizeFpChangeYoy(change: number | null): number {
  if (change === null) return 0.5;
  return (Math.max(-0.5, Math.min(change, 1.0)) + 0.5) / 1.5;
}

// Estimate stats from projected FP based on position
function estimateStatsFromFP(
  projectedFP: number,
  games: number,
  position: string
): {
  receptions: number;
  targets: number;
  receivingYards: number;
  receivingTds: number;
  carries: number;
  rushingYards: number;
  rushingTds: number;
  passingYards: number;
  passingTds: number;
  interceptions: number;
} {
  // PPR scoring: 1 pt per reception, 0.1 per yard, 6 per TD
  // Position-typical stat distributions based on average elite players

  if (position === 'QB') {
    // QB: ~4 pts/pass yard, ~4 pts/pass TD, ~6 pts/rush TD
    const passingYards = projectedFP * 50; // ~250 yards/game = ~12.5 PPG from passing yards
    const passingTds = Math.max(0, (projectedFP - passingYards * 0.04) / 4 * 0.7);
    const rushingYards = projectedFP * 2;
    const rushingTds = Math.max(0, (projectedFP - passingYards * 0.04 - passingTds * 4) / 6);
    const interceptions = passingTds * 0.4; // ~40% INT rate relative to TDs

    return {
      receptions: 0,
      targets: 0,
      receivingYards: 0,
      receivingTds: 0,
      carries: rushingYards / 5,
      rushingYards: Math.min(rushingYards, 600),
      rushingTds: Math.min(rushingTds, 8),
      passingYards: Math.min(passingYards, 5500),
      passingTds: Math.min(passingTds, 50),
      interceptions: Math.min(interceptions, 20),
    };
  } else if (position === 'RB') {
    // RB: Mix of rushing and receiving
    const rushingPct = 0.65; // 65% from rushing
    const rushingFP = projectedFP * rushingPct;
    const receivingFP = projectedFP * (1 - rushingPct);

    // Rushing: ~0.1 pts/yard + 6 pts/TD, avg 4.5 YPC
    const rushingYards = rushingFP * 7;
    const rushingTds = (rushingFP - rushingYards * 0.1) / 6;
    const carries = rushingYards / 4.5;

    // Receiving: 1 pt/rec + 0.1/yard + 6/TD
    const receptions = receivingFP * 0.3;
    const receivingYards = receptions * 8;
    const receivingTds = Math.max(0, (receivingFP - receptions - receivingYards * 0.1) / 6);
    const targets = receptions / 0.75;

    return {
      receptions: Math.min(receptions, 100),
      targets: Math.min(targets, 140),
      receivingYards: Math.min(receivingYards, 800),
      receivingTds: Math.min(receivingTds, 5),
      carries: Math.min(carries, 350),
      rushingYards: Math.min(rushingYards, 1800),
      rushingTds: Math.min(rushingTds, 18),
      passingYards: 0,
      passingTds: 0,
      interceptions: 0,
    };
  } else if (position === 'WR') {
    // WR: Mostly receiving
    const receptions = projectedFP * 0.35;
    const receivingYards = projectedFP * 5.5;
    const receivingTds = Math.max(0, (projectedFP - receptions - receivingYards * 0.1) / 6);
    const targets = receptions / 0.65;

    return {
      receptions: Math.min(receptions, 120),
      targets: Math.min(targets, 180),
      receivingYards: Math.min(receivingYards, 1800),
      receivingTds: Math.min(receivingTds, 15),
      carries: projectedFP * 0.01,
      rushingYards: projectedFP * 0.15,
      rushingTds: 0,
      passingYards: 0,
      passingTds: 0,
      interceptions: 0,
    };
  } else {
    // TE: Similar to WR but lower volume
    const receptions = projectedFP * 0.4;
    const receivingYards = projectedFP * 4.5;
    const receivingTds = Math.max(0, (projectedFP - receptions - receivingYards * 0.1) / 6);
    const targets = receptions / 0.68;

    return {
      receptions: Math.min(receptions, 100),
      targets: Math.min(targets, 150),
      receivingYards: Math.min(receivingYards, 1200),
      receivingTds: Math.min(receivingTds, 12),
      carries: 0,
      rushingYards: 0,
      rushingTds: 0,
      passingYards: 0,
      passingTds: 0,
      interceptions: 0,
    };
  }
}

// Extract 61 features matching the Python model
function extractEnhancedFeatures(
  startKtc: number,
  ktc30dTrend: number,
  ktc90dTrend: number,
  age: number,
  yearsExp: number,
  projectedFP: number,
  projectedGames: number,
  position: string,
  baselineFP: number,
  snapPct: number,
  rookieYear: number | null = null
): number[] {
  // Normalize inputs
  const startKtcNorm = normalizeKtc(startKtc);
  const ktc30d = Math.max(-1, Math.min(ktc30dTrend, 1));
  const ktc90d = Math.max(-1, Math.min(ktc90dTrend, 1));
  const ageFactor = normalizeAge(age);
  const yearsExpNorm = normalizeYearsExp(yearsExp);
  const fpNorm = normalizeFp(projectedFP);
  const gamesFactor = normalizeGames(projectedGames);
  const fpPerGame = (projectedFP / Math.max(projectedGames, 1)) / 25;

  // Prior year FP and change
  const priorFpNorm = normalizeFp(baselineFP);

  // Prior FP per game: estimate from baseline FP assuming typical 17 games
  // For projections, we don't have prior year games, so approximate with avg season
  const priorFpPerGame = baselineFP > 0
    ? (baselineFP / GAMES_PER_SEASON) / 25  // Same normalization as fp_per_game
    : 0.5;  // Neutral default if no prior data

  // FP per game change: current normalized fp/g - prior normalized fp/g
  // Positive = improvement, negative = decline
  const fpPerGameChange = baselineFP > 0
    ? fpPerGame - priorFpPerGame
    : 0;  // No change if no prior data

  const rawFpChange = baselineFP > 0 ? (projectedFP - baselineFP) / baselineFP : 0;
  const fpChangeYoy = normalizeFpChangeYoy(rawFpChange);

  // Position rank (estimated from FP)
  const positionRankNorm = Math.min(50, Math.max(1, 50 - projectedFP / 5)) / 50;

  // KTC volatility
  const ktcVolatility = Math.min(Math.abs(ktc30dTrend) + Math.abs(ktc90dTrend), 1.0);

  // Breakout candidate
  const isBreakoutCandidate = (yearsExp <= 2 && fpNorm > 0.3 && startKtcNorm < 0.5) ? 1 : 0;

  // Position encoding
  const isQb = position === 'QB' ? 1 : 0;
  const isRb = position === 'RB' ? 1 : 0;
  const isWr = position === 'WR' ? 1 : 0;
  const isTe = position === 'TE' ? 1 : 0;

  // Estimate stats from projected FP
  const stats = estimateStatsFromFP(projectedFP, projectedGames, position);

  // Receiving stats
  const receptionsNorm = Math.min(stats.receptions / 120, 1.0);
  const targetsNorm = Math.min(stats.targets / 180, 1.0);
  const receivingYardsNorm = Math.min(stats.receivingYards / 1800, 1.0);
  const receivingTdsNorm = Math.min(stats.receivingTds / 15, 1.0);
  const yardsPerTarget = (stats.receivingYards / Math.max(stats.targets, 1)) / 15;
  const targetShare = projectedGames > 0 ? Math.min(stats.targets / (projectedGames * 8), 1.0) : 0;

  // Rushing stats
  const carriesNorm = Math.min(stats.carries / 350, 1.0);
  const rushingYardsNorm = Math.min(stats.rushingYards / 1800, 1.0);
  const rushingTdsNorm = Math.min(stats.rushingTds / 18, 1.0);
  const yardsPerCarry = (stats.rushingYards / Math.max(stats.carries, 1)) / 6;

  // Passing stats
  const passingYardsNorm = Math.min(stats.passingYards / 5500, 1.0);
  const passingTdsNorm = Math.min(stats.passingTds / 50, 1.0);
  const interceptionsNorm = Math.min(stats.interceptions / 20, 1.0);

  // Draft (use defaults since we don't have this in projection)
  const draftRoundValue = 0.5;
  const draftPickValue = 0.5;

  // Interaction features
  const ageFpInteraction = ageFactor * fpNorm;

  // Cliff years penalty (steeper: (years/2)^1.5 to match Python)
  const cliffAge = AGE_CLIFFS[position] || 30;
  const yearsPastCliff = Math.max(0, age - cliffAge);
  const cliffYearsPenalty = yearsPastCliff > 0 ? Math.min((yearsPastCliff / 2) ** 1.5, 1.0) : 0;

  // Age-experience gap
  const ageExpGap = ((age - 21) - yearsExp) / 10;

  // Snap-based features
  const snapPctNorm = Math.min(snapPct, 1.0);
  const fpPerSnap = projectedGames > 0 ? (projectedFP / Math.max(projectedGames * snapPct * 60, 1)) / 0.5 : 0;

  // Elite youth premium
  const ageYouthFactor = Math.max(0, (28 - age) / 7);
  const eliteFactor = Math.max(0, fpNorm - 0.5);
  const eliteYouthPremium = Math.min((ageYouthFactor ** 2) * (eliteFactor ** 2) * 4, 1.0);

  // FP trajectory
  const clampedChange = Math.max(-0.5, Math.min(rawFpChange, 1.0));
  const fpTrajectory = (clampedChange + 0.5) / 1.5;

  // QB-specific features
  const qbTdIntRatio = isQb ? Math.min((stats.passingTds / Math.max(stats.interceptions, 1)) / 5, 1) : 0;
  const qbRushingBonus = isQb ? Math.min((stats.rushingYards + stats.rushingTds * 60) / 1000, 1) : 0;
  const qbAgePremium = isQb ? Math.max(0, 1 - (age - 26) / 10) : 0;
  const qbEfficiency = isQb ? Math.min(stats.passingYards / Math.max(stats.interceptions * 100, 1) / 50, 1) : 0;

  // Elite tier features
  // ADJUSTED: Only apply dampening to TRUE Elite (8000+), not Tier-1 (6000-8000)
  const isEliteTier = startKtcNorm > 0.6 ? 1 : 0;  // Keep for feature consistency
  const isTrueElite = startKtcNorm >= 0.8 ? 1 : 0;  // NEW: Only 8000+ KTC
  const eliteAgeInteraction = isEliteTier * ageFactor;
  // REDUCED: Only apply trajectory dampening to true elite, and reduce intensity
  let eliteTrajectoryInteraction = isTrueElite * fpTrajectory * 0.5;  // Reduced from 1.0
  // Round 3: Add age-adjusted dampening - young elites shouldn't get same dampening as old elites
  if (age <= 27) {
    const ageDampeningReduction = (28 - age) / 10;  // 0.1 to 0.7 reduction for young players
    eliteTrajectoryInteraction *= (1 - ageDampeningReduction);
  }
  // ROUND 3 FIX: Penalize VOLATILITY, not stability! Old logic was backwards.
  // Stable elite players should NOT be penalized - volatile ones should be
  const eliteVolatilityDampener = isTrueElite * ktcVolatility * 0.3;  // Changed from (1-volatility)*0.5

  // Advanced features
  const efficiencyVolume = fpPerSnap * targetShare;
  const workloadIntensity = projectedGames > 0 ? Math.min((stats.carries + stats.targets) / projectedGames / 20, 1) : 0;
  const tdConversionRate = (stats.receivingTds + stats.rushingTds) / Math.max(stats.carries + stats.targets, 1);
  const trajectoryCliffInteraction = fpTrajectory * (1 - cliffYearsPenalty);
  const draftPerformanceRatio = draftRoundValue * fpNorm;

  // Decline/collapse features
  let yoyDeclineSeverity = 0;
  if (rawFpChange < 0) {
    const declineMagnitude = Math.min(Math.abs(rawFpChange) / 0.5, 1.0);
    const ageAmplifier = age >= cliffAge ? 1.5 : (age >= cliffAge - 2 ? 1.2 : 1.0);
    yoyDeclineSeverity = Math.min(declineMagnitude * ageAmplifier, 1.0);
  }

  const gamesPlayedCollapse = projectedGames < 8 ? Math.max(0, (8 - projectedGames) / 8) : 0;

  // Gap year penalty
  let gapYearPenalty = 0;
  if (projectedGames <= 4) {
    const hadPriorProduction = baselineFP > 50;
    const basePenalty = hadPriorProduction ? 0.6 : 0.3;
    const agePenalty = age >= cliffAge ? 0.4 : (age >= cliffAge - 2 ? 0.2 : 0);
    gapYearPenalty = Math.min(basePenalty + agePenalty, 1.0);
  }

  // QB age cliff 40+
  let qbAgeCliff40plus = 0;
  if (isQb && age >= 40) {
    const baseRisk = (age - 40) / 5;
    const injuryRisk = projectedGames < 14 ? ((14 - projectedGames) / 14 * 0.5) : 0;
    const declineRisk = rawFpChange < -0.1 ? Math.abs(rawFpChange) * 0.5 : 0;
    qbAgeCliff40plus = Math.min(baseRisk + injuryRisk + declineRisk, 1.0);
  }

  // Elite partial season resilience
  let elitePartialSeasonResilience = 0;
  if (startKtcNorm > 0.7 && projectedGames < 15) {
    const ultraEliteFactor = Math.min((startKtcNorm - 0.7) * 3.33, 1.0);
    const fpPerGameSignal = Math.min((projectedFP / Math.max(projectedGames, 1)) / 18, 1.0);
    elitePartialSeasonResilience = Math.min(ultraEliteFactor * fpPerGameSignal, 1.0);
  }

  // Career prime factor (from rookie year)
  const currentYear = 2025;
  const yearsSinceRookie = rookieYear && rookieYear > 0 ? Math.max(0, currentYear - rookieYear) : yearsExp;
  let careerPrimeFactor: number;
  if (yearsSinceRookie >= 2 && yearsSinceRookie <= 4) {
    careerPrimeFactor = 1.0;
  } else if (yearsSinceRookie < 2) {
    careerPrimeFactor = 0.8;
  } else {
    careerPrimeFactor = Math.max(0, 1 - (yearsSinceRookie - 4) / 8);
  }

  // Red zone features (estimate from FP and position)
  const redZoneTargetsNorm = position === 'WR' || position === 'TE'
    ? Math.min(stats.receivingTds * 3 / 30, 1.0)
    : 0;
  const redZoneTouchesNorm = position === 'RB'
    ? Math.min((stats.rushingTds * 4) / 50, 1.0)
    : redZoneTargetsNorm;
  const redZoneEfficiencyNorm = redZoneTouchesNorm > 0
    ? Math.min((stats.receivingTds + stats.rushingTds) / Math.max(redZoneTouchesNorm * 50, 1), 1.0)
    : 0;

  // Advanced receiving features (estimated from FP)
  const airYardsNorm = Math.min(stats.receivingYards * 0.7 / 1500, 1.0);
  const yacNorm = Math.min(stats.receivingYards * 0.3 / 800, 1.0);
  const yacPerRecNorm = stats.receptions > 0 ? Math.min((stats.receivingYards * 0.3 / stats.receptions) / 10, 1.0) : 0.5;
  const airYardsPerTgtNorm = stats.targets > 0 ? Math.min((stats.receivingYards * 0.7 / stats.targets) / 15, 1.0) : 0.5;
  const dropRateNorm = 0.1; // Neutral default
  const receivingFdNorm = Math.min(stats.receptions * 0.5 / 60, 1.0);

  // Advanced rushing features
  const rushingFdNorm = Math.min(stats.carries * 0.25 / 70, 1.0);
  const brokenTacklesNorm = 0.5; // Neutral default
  const rushShareNorm = isRb ? Math.min(stats.carries / 300, 1.0) : 0;

  // Advanced passing features
  const completionRateNorm = isQb ? 0.65 : 0; // Neutral ~65%
  const sackRateNorm = isQb ? 0.3 : 0; // Neutral
  const passingFdNorm = isQb ? Math.min(stats.passingTds * 5 / 200, 1.0) : 0;

  // Weekly-derived features (neutral defaults for projections)
  const weeklyFpCv = 0.5;
  const momentumRatio = 0.5;
  const boomRate = 0.2;
  const bustRate = 0.2;
  const last4VsSeason = 0.5;
  const maxGamesMissedStreak = 0;
  const ktcWeeklyVolatility = 0;

  // Team volume features (neutral defaults)
  const teamPassFactor = 1.0;
  const teamRushFactor = 1.0;
  const opportunityCeiling = targetShare * teamPassFactor;
  const rushOpportunity = carriesNorm * teamRushFactor;
  const teamVolumeCombined = 1.0;

  // Snap trend features (neutral defaults)
  const snapTrend = 0;
  const snapCollapse = 0;
  const snapConsistency = 1.0;

  // Weekly KTC market features (neutral defaults)
  const ktcTrendAcceleration = 0;
  const midSeasonCorrection = 0;
  const ktcMomentum = (ktc90d + 1) / 2;

  // PFF features (neutral defaults - no PFF data for projections)
  const pffGradeNorm = 0.5;
  const pffHasData = 0;
  const pffGradeConfidence = 0;
  const pffPositionGrade = 0.5;
  const pffGradeDivergence = 0.5;
  const pffGradeTrajectory = 0.5;
  const pffWrSeparation = 0.5;
  const pffWrContestedCatch = 0.5;
  const pffRbElusiveRating = 0.5;
  const pffRbReceivingGrade = 0.5;
  const pffQbAccuracy = 0.5;
  const pffQbPressureGrade = 0.5;
  const pffGradeVolatility = 0.5;
  const pffYouthPremium = ageYouthFactor * pffGradeNorm;
  const pffDeclineAlert = 0;
  const pffGradeSnapDivergence = 0.5;
  const pffEliteIndicator = 0;
  const pffBustRisk = 0;
  const pffBreakoutProbability = 0;
  const pffDynastyScore = 0.5;

  // =====================================================
  // BIAS CORRECTION FEATURES (11 features)
  // =====================================================

  // 1. Veteran decline risk
  // ADJUSTED: Reduce by 40% for QBs (they decline slower than other positions)
  let veteranDeclineRisk = 0;
  if (age >= 28) {
    const ageRisk = Math.min((age - 28) / 8, 1.0);
    let declineAmplifier = 1.0;
    if (rawFpChange < 0) {
      declineAmplifier = 1.0 + Math.abs(rawFpChange);
    }
    const productionDamper = Math.max(0.3, 1 - fpNorm);
    veteranDeclineRisk = Math.min(ageRisk * declineAmplifier * productionDamper, 1.0);
    // Reduce decline risk by 40% for QBs - they can produce into late 30s
    if (isQb) {
      veteranDeclineRisk *= 0.6;
    }
  }

  // 2. RB age penalty (ENHANCED: exponential at 28+ to capture cliff)
  let rbAgePenalty = 0;
  if (isRb) {
    if (age >= 28) {
      // Exponential penalty starting at 28 (the cliff)
      const yearsOver27 = age - 27;
      rbAgePenalty = Math.min(0.3 * Math.pow(yearsOver27, 1.5), 1.0);
      // Amplify by workload (more carries = faster decline)
      const workloadAmplifier = 1.0 + (carriesNorm * 0.5);
      rbAgePenalty = Math.min(rbAgePenalty * workloadAmplifier, 1.0);
    } else if (age === 27) {
      // Warning zone - slight penalty
      rbAgePenalty = 0.1;
    }
  }

  // 3. WR/TE age penalty
  let wrTeAgePenalty = 0;
  if ((isWr || isTe) && age >= 30) {
    wrTeAgePenalty = Math.min((age - 30) / 4, 1.0);
  }

  // 4. Binary age flag
  const age31PlusFlag = age >= 31 ? 1 : 0;

  // 5. Age decline signal
  const ageComponent = Math.max(0, (age - 28) / 10);
  let fpDeclineComponent = 0;
  if (rawFpChange < 0) {
    fpDeclineComponent = Math.min(Math.abs(rawFpChange), 0.5);
  }
  const ageDeclineSignal = Math.min(ageComponent + fpDeclineComponent, 1.0);

  // 6. Value depreciation risk
  const cliffRisk = cliffYearsPenalty * 0.3;
  const valueRisk = Math.max(0, startKtcNorm - 0.3) * 0.2;
  const declineRisk = yoyDeclineSeverity * 0.3;
  const trajectoryRisk = Math.max(0, 0.5 - fpTrajectory) * 0.2;
  const valueDepreciationRisk = Math.min(cliffRisk + valueRisk + declineRisk + trajectoryRisk, 1.0);

  // 7. Veteran with declining FP (binary)
  const veteranWithDecliningFp = (age >= 31 && rawFpChange < 0) ? 1 : 0;

  // 8. Mid-tier depreciation signal
  let midTierDepreciationSignal = 0;
  if (startKtcNorm >= 0.2 && startKtcNorm <= 0.6) {
    const baseSignal = 0.3;
    const ageAmplifier = 1.0 + Math.max(0, (age - 26) / 10);
    const rangeCenter = 0.4;
    const distanceFromCenter = Math.abs(startKtcNorm - rangeCenter) / 0.2;
    const rangeFactor = Math.max(0.5, 1 - distanceFromCenter);
    midTierDepreciationSignal = Math.min(baseSignal * ageAmplifier * rangeFactor, 1.0);
  }

  // 9. Snap percentage decline (no prior data for projections)
  const snapPctDecline = 0;

  // 10. Starter to backup risk
  let starterToBackupRisk = 0;
  if (snapPctNorm < 0.5 && startKtcNorm > 0.3) {
    const ageRiskComponent = Math.max(0, (age - 26) / 10);
    const marginalStarterComponent = (snapPctNorm >= 0.4 && snapPctNorm < 0.6) ? 0.3 : 0;
    starterToBackupRisk = Math.min(ageRiskComponent + marginalStarterComponent, 1.0);
  }

  // 11. Mid-tier regression factor
  let midTierRegressionFactor = 0;
  if (startKtcNorm >= 0.2 && startKtcNorm <= 0.6) {
    const eliteFpThreshold = 0.6;
    const productionGap = Math.max(0, eliteFpThreshold - fpNorm);
    const rangeCenter = 0.4;
    const distanceFromCenter = Math.abs(startKtcNorm - rangeCenter) / 0.2;
    midTierRegressionFactor = productionGap * Math.max(0.3, 1 - distanceFromCenter);
  }

  // =====================================================
  // PHASE 2 CALIBRATION FEATURES (12 features)
  // =====================================================

  // 1. QB stability premium: Extended prime window for QBs (stable until 38, not 35)
  // ENHANCED: QBs can produce into late 30s, tiered by age
  let qbStabilityPremium = 0;
  if (isQb) {
    if (age <= 35) {
      qbStabilityPremium = 0.15;  // Full premium during prime
    } else if (age <= 38) {
      qbStabilityPremium = 0.10;  // Still valuable in extended prime
    } else if (age <= 40) {
      qbStabilityPremium = 0.05;  // Reduced but still some floor
    }
    // age > 40: no premium (severe decline expected)
  }

  // 2. QB scarcity factor: Top-12 QB value floor protection
  const qbScarcityFactor = (isQb && startKtcNorm > 0.7) ? 0.15 : 0;

  // 3. RB accelerated decline: 1.5x age penalty for RBs 28+
  const rbAcceleratedDecline = (isRb && age >= 28) ? Math.min(1.5 * rbAgePenalty, 1.0) : 0;

  // 4. Position cliff multiplier: Position-specific exponential cliff
  const positionCliffMultipliers: Record<string, number> = { QB: 0.8, RB: 1.5, WR: 1.2, TE: 1.1 };
  const positionCliffMultiplier = (positionCliffMultipliers[position] || 1.0) * cliffYearsPenalty;

  // 5. Elite young upside: Bonus for elite players under 27
  const eliteYoungUpside = (startKtcNorm > 0.8 && age < 27) ? 0.15 : 0;

  // 6. Elite momentum amplifier: 1.5x weight on KTC trend for elite players
  const eliteMomentumAmplifier = (startKtcNorm > 0.8) ? ktcMomentum * 1.5 : 0;

  // 7. Breakout trajectory: Identifies rapid value ascent (young player KTC jumped significantly)
  const breakoutTrajectory = (age <= 25 && ktcMomentum > 0.1) ? 1.0 : 0;

  // 8. Tier-2 hope discount: Base 15% regression risk for 4000-6000 KTC
  const tier2HopeDiscount = (startKtcNorm >= 0.4 && startKtcNorm < 0.6) ? 0.15 : 0;

  // 9. Non-starter depreciation: Penalty for <70% snap share at mid value
  const nonStarterDepreciation = (snapPct < 0.7 && startKtcNorm > 0.4) ? 0.1 : 0;

  // 10. One-hit wonder risk: First big season + age 26+ = regression signal
  const oneHitWonderRisk = (age >= 26 && yearsExp <= 3 && fpNorm > 0.4 && priorFpNorm < 0.3) ? 0.2 : 0;

  // 11. Peak season risk: High GP + high FP = potential ceiling/regression
  const peakSeasonRisk = (projectedGames >= 16 && fpPerGame > 0.6) ? 0.1 : 0;

  // 12. Buy low recovery: Injured young players have upside
  const buyLowRecovery = (projectedGames < 10 && age < 28 && startKtcNorm > 0.3) ? 0.1 : 0;

  // =====================================================
  // PHASE 3 CALIBRATION FEATURES (12 features for TE, breakout, young/veteran)
  // =====================================================

  // --- TE Position Boost (TEs under-predicted by -99 pts avg, 100% breakouts under-predicted) ---
  // ROUND 3: Further enhanced TE features to fix systematic under-prediction

  // 1. TE upside amplifier: TEs have unique value in dynasty due to scarcity
  let teUpsideAmplifier = 0;
  if (isTe) {
    const basePremium = 0.25;  // Increased from 0.15
    const youthBoost = Math.max(0, (27 - age) / 8) * 0.2;  // Increased from /10 * 0.15
    const productionBoost = fpNorm * 0.25;  // Increased from 0.2
    // PFF grade multiplier for TEs
    const pffBoost = pffGradeNorm > 0.6 ? (pffGradeNorm - 0.6) * 0.5 : 0;
    // Snap scarcity premium (only ~8 startable TEs in dynasty)
    const snapScarcityBoost = snapPctNorm > 0.6 ? 0.15 : 0;
    // ROUND 3: Trajectory boost for TEs on upward trend
    const trajectoryBoost = fpTrajectory > 0.5 ? (fpTrajectory - 0.5) * 0.4 : 0;  // Up to +0.2
    // ROUND 3: Cap increased from 0.7 to 0.9 for more upside
    teUpsideAmplifier = Math.min(basePremium + youthBoost + productionBoost + pffBoost + snapScarcityBoost + trajectoryBoost, 0.9);
  }

  // 2. TE elite ceiling: Elite TEs have higher ceiling
  let teEliteCeiling = 0;
  if (isTe && startKtcNorm > 0.5) {  // Lowered from 0.6
    const eliteBase = 0.3;  // Increased from 0.25
    const youthAmplifier = Math.max(0, (28 - age) / 4);  // Steeper curve: /4 instead of /5
    // ROUND 3: Increased cap from 0.6 to 0.7
    teEliteCeiling = Math.min(eliteBase * (1 + youthAmplifier), 0.7);
  }

  // 3. TE breakout indicator: Young TEs showing production breakout
  // ROUND 3: Increased values to 0.5/0.4 to better capture TE breakouts
  let teBreakoutIndicator = 0;
  if (isTe && age <= 27) {  // Extended from 26
    if (rawFpChange && rawFpChange > 0.15) {  // Lowered from 0.2
      teBreakoutIndicator = 0.5;  // ROUND 3: Increased from 0.4 to 0.5
    } else if (fpNorm > 0.25 && priorFpNorm < 0.15) {  // Lowered thresholds
      teBreakoutIndicator = 0.4;  // ROUND 3: Increased from 0.35 to 0.4
    }
  }

  // --- Breakout Detection (70.9% of breakouts under-predicted) ---

  // 4. Breakout potential ceiling: Combines multiple breakout signals
  let breakoutPotentialCeiling = 0;
  if (age <= 25) {
    const ktcMomentumSignal = Math.max(0, ktcMomentum) * 0.3;
    const fpTrajectorySignal = Math.max(0, fpTrajectory - 0.5) * 0.4;
    const productionJump = rawFpChange ? Math.max(0, rawFpChange) * 0.3 : 0;
    breakoutPotentialCeiling = Math.min(ktcMomentumSignal + fpTrajectorySignal + productionJump, 0.5);
  }

  // 5. Rookie draft capital ceiling: High draft capital rookies have upside
  let rookieDraftCapitalCeiling = 0;
  if (yearsExp <= 2) {
    if (draftRoundValue > 0.85) {
      rookieDraftCapitalCeiling = 0.3;
    } else if (draftRoundValue > 0.7) {
      rookieDraftCapitalCeiling = 0.2;
    } else if (draftRoundValue > 0.55) {
      rookieDraftCapitalCeiling = 0.1;
    }
  }

  // 6. Momentum ceiling amplifier: Strong positive momentum deserves higher ceiling
  const momentumCeilingAmplifier = (ktcMomentum > 0.1 && age <= 27)
    ? Math.min(ktcMomentum * 1.5, 0.4)
    : 0;

  // --- Young Player Calibration (Young <=24 under-predicted by -84 pts) ---

  // 7. Young elite ceiling boost: Young elite players have highest ceiling
  // ROUND 3: Lowered threshold from 0.7 to 0.6 to capture Drake Maye (0.64) and JSN (0.63)
  // Also expanded age from 24 to 25 and increased cap from 0.4 to 0.6
  let youngEliteCeilingBoost = 0;
  if (age <= 25 && startKtcNorm > 0.6) {  // EXPANDED: age 24->25, KTC 0.7->0.6
    const youthPremium = (26 - age) / 5;  // 0.2 to 1.0 (expanded range)
    const elitePremium = (startKtcNorm - 0.6) * 2.5;  // 0 to 1.0 for 6000-10000 KTC
    youngEliteCeilingBoost = Math.min(youthPremium * elitePremium * 0.6, 0.6);  // Higher cap
  }

  // 8. Career trajectory boost: Young players on upward trajectory
  const careerTrajectoryBoost = (age <= 26 && fpTrajectory > 0.6)
    ? (fpTrajectory - 0.5) * 0.5
    : 0;

  // --- Veteran Decline Enhancement (Veterans 31+ over-predicted by +174 pts) ---

  // 9. Veteran steep decline: Much stronger penalty for 35+ players
  let veteranSteepDecline = 0;
  if (age >= 35) {
    const basePenalty = (age - 35) / 5;
    let declineAmplifier = 1.0;
    if (rawFpChange && rawFpChange < 0) {
      declineAmplifier = 1.5;
    }
    if (isRb) {
      declineAmplifier *= 2.0;
    } else if (isQb) {
      declineAmplifier *= 0.7;
    }
    veteranSteepDecline = Math.min(basePenalty * declineAmplifier, 1.0);
  }

  // 10. Veteran QB over-prediction fix: QBs 38+ severely over-predicted
  const veteranQbCliff = (isQb && age >= 38)
    ? Math.min((age - 38) / 3, 1.0)
    : 0;

  // 11. Aging value compression: Older players lose value faster
  let agingValueCompression = 0;
  if (age >= 30) {
    const agePenaltyForCompression = (age - 30) / 8;
    const valueFactor = startKtcNorm > 0.3 ? startKtcNorm * 2 : 0.5;
    agingValueCompression = Math.min(agePenaltyForCompression * valueFactor, 0.8);
  }

  // 12. Position-age interaction: Combines position-specific aging with production
  let positionAgeInteraction = 0;
  const positionCliffAge = AGE_CLIFFS[position] || 30;
  if (age >= positionCliffAge) {
    const yearsOver = age - positionCliffAge;
    if (yearsOver <= 2) {
      positionAgeInteraction = yearsOver * 0.2;
    } else {
      positionAgeInteraction = 0.4 + (yearsOver - 2) * 0.15;
    }
    positionAgeInteraction = Math.min(positionAgeInteraction, 0.8);
  }

  // =====================================================
  // PHASE 4: ELITE REGRESSION + BREAKOUT/CRASH ENHANCEMENT
  // =====================================================

  // 1. ELITE POSITIVE CHANGE DAMPENER (Fix elite over-prediction)
  // ADJUSTED: Only dampen TRUE elite (8000+), not Tier-1 (6000-8000)
  // Also REDUCED intensity (0.8 -> 0.3) to fix -386 pts elite under-prediction
  let elitePositiveChangeDampener = 0;
  if (startKtcNorm >= 0.8) {  // CHANGED: Only TRUE elite (8000+ KTC)
    const eliteTierFactor = Math.min((startKtcNorm - 0.8) * 5.0, 1.0);  // Only 8000-10000
    // CHANGED: Only dampen if VERY strong trajectory AND high momentum
    if (fpTrajectory > 0.6 && ktcMomentum > 0.1) {  // Higher threshold
      const trajectoryOvershoot = (fpTrajectory - 0.6) * 2.5;
      elitePositiveChangeDampener = eliteTierFactor * trajectoryOvershoot * 0.3;  // REDUCED from 0.8
    }
  }

  // 2. YOUNG BREAKOUT CEILING (Enhanced breakout detection)
  let youngBreakoutCeiling = 0;
  if (age <= 26) {
    const ktcRising = ktcMomentum > 0.1 ? ktcMomentum : 0;
    const ktcMomentumSignal = Math.min(ktcRising * 2.0, 0.4);

    const fpImproving = fpTrajectory > 0.6 ? fpTrajectory : 0;
    const fpTrajectorySignal = Math.min((fpImproving - 0.6) * 2.5, 0.3);

    let snapBreakthrough = 0;
    if (snapPctNorm > 0.7) {
      snapBreakthrough = 0.2;
    } else if (snapPctNorm > 0.6) {
      snapBreakthrough = 0.1;
    }

    const youthPremium = ((27 - age) / 7) * 0.2;

    youngBreakoutCeiling = Math.min(
      ktcMomentumSignal + fpTrajectorySignal + snapBreakthrough + youthPremium,
      0.9
    );
  }

  // 3. VETERAN CRASH AMPLIFIER (Better crash detection)
  let veteranCrashAmplifier = 0;
  if (age >= positionCliffAge) {
    const yearsOverCliff = age - positionCliffAge;
    const ageCrashRisk = Math.min(yearsOverCliff / 3, 1.0);

    let perfDeclineAmp = 1.0;
    if (rawFpChange < -0.1) {
      perfDeclineAmp = 1.0 + Math.abs(rawFpChange) * 2.0;
    }

    let injuryAmp = 1.0;
    if (projectedGames < 12) {
      injuryAmp = 1.0 + ((17 - projectedGames) / 17) * 0.8;
    }

    let positionCrashMult = 1.0;
    if (isRb && yearsOverCliff >= 1) {
      positionCrashMult = 2.0;  // RBs crash hard at 28+
    } else if (isWr && yearsOverCliff >= 2) {
      positionCrashMult = 1.5;
    } else if (isQb && yearsOverCliff >= 5) {
      positionCrashMult = 1.8;
    }

    veteranCrashAmplifier = Math.min(
      ageCrashRisk * perfDeclineAmp * injuryAmp * positionCrashMult,
      1.0
    );
  }

  // =====================================================
  // PHASE 5: LARGE VALUE CHANGE IMPROVEMENTS
  // =====================================================

  // 4. ELITE CRASH RISK (Feature 151)
  // Enhanced crash detection for elite players
  let eliteCrashRisk = 0;
  if (startKtcNorm > 0.6) {  // Above 6000 KTC
    // 1. Age over position cliff
    const crashCliffAges: Record<string, number> = { 'QB': 33, 'RB': 27, 'WR': 30, 'TE': 31 };
    const crashCliff = crashCliffAges[position] || 30;
    const yearsOverCrashCliff = Math.max(0, age - crashCliff);
    if (yearsOverCrashCliff > 0) {
      eliteCrashRisk += yearsOverCrashCliff * 0.15;
    }

    // 2. Negative momentum amplifier
    if (ktcMomentum < -0.02) {
      eliteCrashRisk += Math.abs(ktcMomentum) * 3.0;
    }

    // 3. Games missed penalty
    if (projectedGames < 14) {
      eliteCrashRisk += (17 - projectedGames) / 17 * 0.3;
    }

    // 4. YoY fantasy point decline
    if (rawFpChange < -0.15) {
      eliteCrashRisk += Math.abs(rawFpChange) * 0.5;
    }

    eliteCrashRisk = Math.min(eliteCrashRisk, 1.0);
  }

  // 5. BREAKOUT SCORE ENHANCED (Feature 152)
  // More comprehensive breakout detection
  let breakoutScoreEnhanced = 0;

  // 1. Young player momentum (strongest signal)
  if (age <= 26) {
    const youthBreakoutFactor = (27 - age) / 5;  // 0.2 to 1.0
    if (ktcMomentum > 0.03) {  // Rising 3%+ per month
      const momentumBoost = Math.min(ktcMomentum * 10, 0.5);
      breakoutScoreEnhanced += youthBreakoutFactor * momentumBoost * 2.0;
    }
  }

  // 2. Second-year breakout pattern
  if (yearsExp === 2 && startKtcNorm > 0.4) {
    breakoutScoreEnhanced += 0.25;
  }

  // 3. Prior year trajectory (was ascending)
  if (rawFpChange > 0.15) {
    const trajectorySignal = Math.min(rawFpChange, 0.4);
    breakoutScoreEnhanced += trajectorySignal;
  }

  // 4. Snap share increase indicator
  if (snapPctNorm > 0.7) {
    breakoutScoreEnhanced += 0.2;
  }

  breakoutScoreEnhanced = Math.min(breakoutScoreEnhanced, 1.0);

  // 6. POSITION CRASH RISK (Feature 153)
  // Position-specific crash multipliers
  let positionCrashRisk = 0;
  const crashRates: Record<string, number> = { 'QB': 0.15, 'RB': 0.25, 'WR': 0.12, 'TE': 0.10 };
  const posCrashCliffs: Record<string, number> = { 'QB': 33, 'RB': 27, 'WR': 30, 'TE': 31 };

  const posCliff = posCrashCliffs[position] || 30;
  const posRate = crashRates[position] || 0.15;
  const yearsOverPosCliff = Math.max(0, age - posCliff);

  if (yearsOverPosCliff > 0 && startKtcNorm > 0.4) {
    positionCrashRisk = Math.min(yearsOverPosCliff * posRate, 0.4);
  }

  // =====================================================
  // PHASE 6: TIER-1 AND MAGNITUDE IMPROVEMENTS
  // =====================================================

  // 7. TIER-1 CRASH RISK (Feature 154)
  // Tier-1 players (6000-8000 KTC) have highest MAE and +634 bias
  let tier1CrashRisk = 0;
  if (startKtcNorm >= 0.6 && startKtcNorm < 0.8) {
    // Base crash risk for tier-1 volatility
    tier1CrashRisk = 0.15;

    // Amplify if negative KTC momentum
    if (ktc90d < 0) {
      tier1CrashRisk += Math.abs(ktc90d) * 2.0;
    }

    // Amplify if FP trajectory declining
    if (fpTrajectory < 0.5) {
      tier1CrashRisk += (0.5 - fpTrajectory) * 0.3;
    }

    // Position-specific amplifiers
    if (isRb && age >= 27) {
      tier1CrashRisk *= 1.5;
    }
    if (isQb && age >= 32) {
      tier1CrashRisk *= 1.3;
    }

    tier1CrashRisk = Math.min(tier1CrashRisk, 1.0);
  }

  // 8. CRASH MAGNITUDE AMPLIFIER (Feature 155)
  // Model detects crashes (90%) but under-estimates severity (+911 bias)
  let crashMagnitudeAmplifier = 0;
  if (age >= cliffAge && fpTrajectory < 0.4) {
    const yearsOverForCrash = age - cliffAge;
    let baseSignal = (yearsOverForCrash / 3) * (0.5 - fpTrajectory);

    // Amplify for injury history (games missed)
    if (projectedGames < 12) {
      baseSignal *= 1.5;
    }

    // Amplify for negative KTC momentum
    if (ktcMomentum < 0) {
      baseSignal *= (1 + Math.abs(ktcMomentum) * 5);
    }

    // Amplify for tier-1
    if (startKtcNorm >= 0.6 && startKtcNorm < 0.8) {
      baseSignal *= 1.3;
    }

    crashMagnitudeAmplifier = Math.min(baseSignal, 1.0);
  }

  // 9. BREAKOUT CEILING BOOST (Feature 156)
  // Model detects breakouts (89.9%) but under-estimates magnitude (-281 bias)
  // ENHANCED: Extended age/KTC range, higher multipliers, added FP bonus
  let breakoutCeilingBoost = 0;
  if (age <= 26 && startKtcNorm >= 0.35) {  // EXPANDED: age 25→26, KTC 0.4→0.35
    // Strong positive momentum = breakout potential
    if (ktcMomentum > 0.03) {  // LOWERED threshold from 0.05
      let momentumSignal = Math.min(ktcMomentum * 15, 0.65);  // INCREASED: 10→15, cap 0.5→0.65

      // Amplify for production growth
      if (fpTrajectory > 0.55) {  // LOWERED from 0.6
        momentumSignal *= 1.8;  // INCREASED from 1.5
      }

      // NEW: High FP bonus for top producers
      if (fpNorm > 0.6) {
        momentumSignal *= 1.4;
      }

      // Youth premium - steeper curve
      const youthFactor = (27 - age) / 4;  // CHANGED: (26-age)/5 → (27-age)/4

      breakoutCeilingBoost = momentumSignal * youthFactor;
      breakoutCeilingBoost = Math.min(breakoutCeilingBoost, 0.9);  // INCREASED cap from 0.7
    }
  }

  // =====================================================
  // ROUND 4: ELITE CRASH AND PLATEAU DETECTION (11 features)
  // =====================================================

  // 10. ELITE REGRESSION RISK (Feature 157)
  let eliteRegressionRisk = 0;
  if (startKtcNorm >= 0.6) {  // 6000+ KTC
    // Post-breakout regression (year 2-3 after big gain)
    if ([2, 3].includes(yearsExp) && ktcMomentum > 0.05) {
      eliteRegressionRisk += 0.25;
    }
    // Declining PFF grade
    if (pffHasData && pffGradeTrajectory < 0.4) {
      eliteRegressionRisk += (0.5 - pffGradeTrajectory) * 0.5;
    }
    // Overvaluation signal
    if (fpNorm < startKtcNorm - 0.15) {
      eliteRegressionRisk += 0.3;
    }
    // RB 27+ highest risk
    if (isRb && age >= 27) {
      eliteRegressionRisk *= 2.0;
    }
    eliteRegressionRisk = Math.min(eliteRegressionRisk, 1.0);
  }

  // 11. MOMENTUM REVERSAL SIGNAL (Feature 158)
  let momentumReversalSignal = 0;
  if (ktcMomentum > 0.05 && fpTrajectory < 0.45) {
    momentumReversalSignal = ktcMomentum * (0.5 - fpTrajectory) * 3.0;
  }
  if (isQb && age >= 32 && ktcMomentum > 0.03) {
    momentumReversalSignal += 0.2;
  }
  if (isRb && age >= 27 && ktcMomentum > 0.03) {
    momentumReversalSignal += 0.4;
  }
  momentumReversalSignal = Math.min(momentumReversalSignal, 1.0);

  // 12. POST-BREAKOUT REGRESSION (Feature 159)
  let postBreakoutRegression = 0;
  if (yearsExp <= 3 && startKtcNorm >= 0.5) {
    // First big season = regression candidate
    if (fpNorm > 0.5 && priorFpNorm < 0.3) {
      postBreakoutRegression = 0.4;
    }
    // Second big season but now age 25+ = plateau risk
    if (yearsExp === 3 && age >= 25 && fpTrajectory > 0.5) {
      postBreakoutRegression = 0.3;
    }
    // QB-specific regression
    if (isQb && yearsExp <= 2) {
      postBreakoutRegression += 0.2;
    }
  }
  postBreakoutRegression = Math.min(postBreakoutRegression, 0.8);

  // 13. AGE 25-26 PLATEAU RISK (Feature 160)
  let age2526PlateauRisk = 0;
  if (age === 25 || age === 26) {
    age2526PlateauRisk = 0.15;
    if (isQb) {
      age2526PlateauRisk += 0.25;
      if (startKtcNorm >= 0.7) {
        age2526PlateauRisk += 0.2;
      }
    }
    if (isTe) {
      age2526PlateauRisk += 0.2;
      if (startKtcNorm >= 0.5) {
        age2526PlateauRisk += 0.15;
      }
    }
    if (fpTrajectory > 0.55) {
      age2526PlateauRisk *= 1.3;
    }
    age2526PlateauRisk = Math.min(age2526PlateauRisk, 0.8);
  }

  // 14. QB AGE DANGER ZONE (Feature 161)
  let qbAgeDangerZone = 0;
  if (isQb) {
    if (age === 25 || age === 26) {
      qbAgeDangerZone = 0.4;
    } else if (age >= 27 && age <= 30) {
      qbAgeDangerZone = 0.2;
    } else if (age >= 31 && age <= 32) {
      qbAgeDangerZone = 0.3;
    }
    if (startKtcNorm >= 0.7) {
      qbAgeDangerZone *= 1.5;
    }
    qbAgeDangerZone = Math.min(qbAgeDangerZone, 0.7);
  }

  // 15. DEPTH PLAYER CEILING (Feature 162)
  let depthPlayerCeiling = 0;
  if (startKtcNorm < 0.1) {  // Under 1000 KTC
    depthPlayerCeiling = 0.5;
    if (age >= 28) {
      depthPlayerCeiling += 0.3;
    }
    if (snapPct < 0.4) {
      depthPlayerCeiling += 0.2;
    }
    if (yearsExp <= 2 && draftRoundValue > 0.7) {
      depthPlayerCeiling *= 0.5;
    }
    depthPlayerCeiling = Math.min(depthPlayerCeiling, 0.9);
  }

  // 16. BACKUP REGRESSION RISK (Feature 163)
  let backupRegressionRisk = 0;
  if (startKtcNorm < 0.2 && fpNorm > 0.3) {
    backupRegressionRisk = (fpNorm - startKtcNorm) * 0.8;
    if (age >= 28) {
      backupRegressionRisk *= 1.5;
    }
    backupRegressionRisk = Math.min(backupRegressionRisk, 0.8);
  }

  // 17. PFF GRADE DECLINE RATE (Feature 164)
  // Note: For projections, pffHasData = 0, so this uses defaults
  // In chart data generation (Python), actual PFF data is used
  let pffGradeDeclineRate = 0;
  // pffHasData is 0 for projections, so this won't execute
  // When actual PFF data is available, pff_prior_year_grade would be passed

  // 18. PFF AGE-GRADE INTERACTION (Feature 165)
  let pffAgeGradeInteraction = 0;
  if (pffHasData) {
    if (age <= 25 && pffGradeNorm > 0.6) {
      pffAgeGradeInteraction = (0.6 - (age / 50)) * pffGradeNorm;
    } else if (age >= 29 && pffGradeTrajectory < 0.4) {
      pffAgeGradeInteraction = -1 * (ageFactor * (0.5 - pffGradeTrajectory));
    }
  }

  // 19. TE GRADE-PRODUCTION MISMATCH (Feature 166)
  let teGradeProductionMismatch = 0;
  if (isTe && pffHasData) {
    if (pffGradeNorm > 0.6 && fpNorm < 0.3) {
      teGradeProductionMismatch = (pffGradeNorm - fpNorm) * 0.8;
    } else if (pffGradeNorm < 0.4 && fpNorm > 0.4) {
      teGradeProductionMismatch = -1 * (fpNorm - pffGradeNorm) * 0.6;
    }
  }

  // 20. PFF SNAP EFFICIENCY (Feature 167)
  // Note: For projections, uses default. Chart data (Python) uses actual PFF snaps
  let pffSnapEfficiency = 0.5;
  if (pffHasData) {
    // pffHasData = 0 for projections, so uses default 0.5
    // When actual data available, would calculate: pffGradeNorm * (snaps/1000)
    const snapFullness = Math.min(snapPctNorm, 1.0);
    pffSnapEfficiency = pffGradeNorm * snapFullness;
    if (pffGradeNorm > 0.7 && snapFullness > 0.8) {
      pffSnapEfficiency += 0.15;
    }
    pffSnapEfficiency = Math.min(pffSnapEfficiency, 1.0);
  }

  // Return all 168 features in exact order matching Python model (Round 4)
  return [
    startKtcNorm,           // 0: start_ktc
    ktc30d,                 // 1: ktc_30d_trend
    ktc90d,                 // 2: ktc_90d_trend
    ageFactor,              // 3: age_factor
    yearsExpNorm,           // 4: years_exp_normalized
    fpNorm,                 // 5: fp_normalized
    gamesFactor,            // 6: games_played_factor
    fpPerGame,              // 7: fp_per_game
    priorFpNorm,            // 8: prior_fp_normalized
    priorFpPerGame,         // 9: prior_fp_per_game (NEW)
    fpPerGameChange,        // 10: fp_per_game_change (NEW)
    fpChangeYoy,            // 11: fp_change_yoy
    positionRankNorm,       // 12: position_rank_normalized
    ktcVolatility,          // 13: ktc_volatility
    isBreakoutCandidate,    // 14: is_breakout_candidate
    isQb,                   // 15: is_qb
    isRb,                   // 16: is_rb
    isWr,                   // 17: is_wr
    isTe,                   // 18: is_te
    receptionsNorm,         // 19: receptions_normalized
    targetsNorm,            // 20: targets_normalized
    receivingYardsNorm,     // 21: receiving_yards_normalized
    receivingTdsNorm,       // 22: receiving_tds_normalized
    yardsPerTarget,         // 23: yards_per_target
    targetShare,            // 24: target_share
    carriesNorm,            // 25: carries_normalized
    rushingYardsNorm,       // 26: rushing_yards_normalized
    rushingTdsNorm,         // 27: rushing_tds_normalized
    yardsPerCarry,          // 28: yards_per_carry
    passingYardsNorm,       // 29: passing_yards_normalized
    passingTdsNorm,         // 30: passing_tds_normalized
    interceptionsNorm,      // 31: interceptions_normalized
    draftRoundValue,        // 32: draft_round_value
    draftPickValue,         // 33: draft_pick_value
    ageFpInteraction,       // 34: age_fp_interaction
    cliffYearsPenalty,      // 35: cliff_years_penalty
    ageExpGap,              // 36: age_exp_gap
    snapPctNorm,            // 37: snap_pct_normalized
    fpPerSnap,              // 38: fp_per_snap
    eliteYouthPremium,      // 39: elite_youth_premium
    fpTrajectory,           // 40: fp_trajectory
    qbTdIntRatio,           // 41: qb_td_int_ratio
    qbRushingBonus,         // 42: qb_rushing_bonus
    qbAgePremium,           // 43: qb_age_premium
    qbEfficiency,           // 44: qb_efficiency
    isEliteTier,            // 45: is_elite_tier
    eliteAgeInteraction,    // 46: elite_age_interaction
    eliteTrajectoryInteraction, // 47: elite_trajectory_interaction
    eliteVolatilityDampener,// 48: elite_volatility_dampener
    efficiencyVolume,       // 49: efficiency_volume
    workloadIntensity,      // 50: workload_intensity
    tdConversionRate,       // 51: td_conversion_rate
    trajectoryCliffInteraction, // 52: trajectory_cliff_interaction
    draftPerformanceRatio,  // 53: draft_performance_ratio
    yoyDeclineSeverity,     // 54: yoy_decline_severity
    gamesPlayedCollapse,    // 55: games_played_collapse
    gapYearPenalty,         // 56: gap_year_penalty
    qbAgeCliff40plus,       // 57: qb_age_cliff_40plus
    elitePartialSeasonResilience, // 58: elite_partial_season_resilience
    // Rookie year and red zone features (4)
    careerPrimeFactor,      // 59: career_prime_factor
    redZoneTargetsNorm,     // 60: red_zone_targets_norm
    redZoneTouchesNorm,     // 61: red_zone_touches_norm
    redZoneEfficiencyNorm,  // 62: red_zone_efficiency_norm
    // Advanced receiving features (6)
    airYardsNorm,           // 63: air_yards_normalized
    yacNorm,                // 64: yac_normalized
    yacPerRecNorm,          // 65: yac_per_rec_norm
    airYardsPerTgtNorm,     // 66: air_yards_per_tgt_norm
    dropRateNorm,           // 67: drop_rate_normalized
    receivingFdNorm,        // 68: receiving_fd_norm
    // Advanced rushing features (3)
    rushingFdNorm,          // 69: rushing_fd_norm
    brokenTacklesNorm,      // 70: broken_tackles_norm
    rushShareNorm,          // 71: rush_share_norm
    // Advanced passing features (3)
    completionRateNorm,     // 72: completion_rate_norm
    sackRateNorm,           // 73: sack_rate_norm
    passingFdNorm,          // 74: passing_fd_norm
    // Weekly-derived features (7)
    weeklyFpCv,             // 75: weekly_fp_cv
    momentumRatio,          // 76: momentum_ratio
    boomRate,               // 77: boom_rate
    bustRate,               // 78: bust_rate
    last4VsSeason,          // 79: last_4_vs_season
    maxGamesMissedStreak,   // 80: max_games_missed_streak
    ktcWeeklyVolatility,    // 81: ktc_weekly_volatility
    // Team volume features (5)
    teamPassFactor,         // 82: team_pass_factor
    teamRushFactor,         // 83: team_rush_factor
    opportunityCeiling,     // 84: opportunity_ceiling
    rushOpportunity,        // 85: rush_opportunity
    teamVolumeCombined,     // 86: team_volume_combined
    // Snap trend features (3)
    snapTrend,              // 87: snap_trend
    snapCollapse,           // 88: snap_collapse
    snapConsistency,        // 89: snap_consistency
    // Weekly KTC market features (3)
    ktcTrendAcceleration,   // 90: ktc_trend_acceleration
    midSeasonCorrection,    // 91: mid_season_correction
    ktcMomentum,            // 92: ktc_momentum
    // PFF features (20)
    pffGradeNorm,           // 93: pff_grade_normalized
    pffHasData,             // 94: pff_has_data
    pffGradeConfidence,     // 95: pff_grade_confidence
    pffPositionGrade,       // 96: pff_position_grade
    pffGradeDivergence,     // 97: pff_grade_divergence
    pffGradeTrajectory,     // 98: pff_grade_trajectory
    pffWrSeparation,        // 99: pff_wr_separation
    pffWrContestedCatch,    // 100: pff_wr_contested_catch
    pffRbElusiveRating,     // 101: pff_rb_elusive_rating
    pffRbReceivingGrade,    // 102: pff_rb_receiving_grade
    pffQbAccuracy,          // 103: pff_qb_accuracy
    pffQbPressureGrade,     // 104: pff_qb_pressure_grade
    pffGradeVolatility,     // 105: pff_grade_volatility
    pffYouthPremium,        // 106: pff_youth_premium
    pffDeclineAlert,        // 107: pff_decline_alert
    pffGradeSnapDivergence, // 108: pff_grade_snap_divergence
    pffEliteIndicator,      // 109: pff_elite_indicator
    pffBustRisk,            // 110: pff_bust_risk
    pffBreakoutProbability, // 111: pff_breakout_probability
    pffDynastyScore,        // 112: pff_dynasty_score
    // Bias correction features (11)
    veteranDeclineRisk,     // 113: veteran_decline_risk
    rbAgePenalty,           // 114: rb_age_penalty
    wrTeAgePenalty,         // 115: wr_te_age_penalty
    age31PlusFlag,          // 116: age_31_plus_flag
    ageDeclineSignal,       // 117: age_decline_signal
    valueDepreciationRisk,  // 118: value_depreciation_risk
    veteranWithDecliningFp, // 119: veteran_with_declining_fp
    midTierDepreciationSignal, // 120: mid_tier_depreciation_signal
    snapPctDecline,         // 121: snap_pct_decline
    starterToBackupRisk,    // 122: starter_to_backup_risk
    midTierRegressionFactor, // 123: mid_tier_regression_factor
    // Phase 2 calibration features (12)
    qbStabilityPremium,     // 124: qb_stability_premium
    qbScarcityFactor,       // 125: qb_scarcity_factor
    rbAcceleratedDecline,   // 126: rb_accelerated_decline
    positionCliffMultiplier, // 127: position_cliff_multiplier
    eliteYoungUpside,       // 128: elite_young_upside
    eliteMomentumAmplifier, // 129: elite_momentum_amplifier
    breakoutTrajectory,     // 130: breakout_trajectory
    tier2HopeDiscount,      // 131: tier2_hope_discount
    nonStarterDepreciation, // 132: non_starter_depreciation
    oneHitWonderRisk,       // 133: one_hit_wonder_risk
    peakSeasonRisk,         // 134: peak_season_risk
    buyLowRecovery,         // 135: buy_low_recovery
    // Phase 3 calibration features (12)
    teUpsideAmplifier,      // 136: te_upside_amplifier
    teEliteCeiling,         // 137: te_elite_ceiling
    teBreakoutIndicator,    // 138: te_breakout_indicator
    breakoutPotentialCeiling, // 139: breakout_potential_ceiling
    rookieDraftCapitalCeiling, // 140: rookie_draft_capital_ceiling
    momentumCeilingAmplifier, // 141: momentum_ceiling_amplifier
    youngEliteCeilingBoost, // 142: young_elite_ceiling_boost
    careerTrajectoryBoost,  // 143: career_trajectory_boost
    veteranSteepDecline,    // 144: veteran_steep_decline
    veteranQbCliff,         // 145: veteran_qb_cliff
    agingValueCompression,  // 146: aging_value_compression
    positionAgeInteraction, // 147: position_age_interaction
    // PHASE 4 ENHANCEMENTS (3 new features)
    elitePositiveChangeDampener, // 148: elite_positive_change_dampener
    youngBreakoutCeiling,        // 149: young_breakout_ceiling
    veteranCrashAmplifier,       // 150: veteran_crash_amplifier
    // PHASE 5: LARGE VALUE CHANGE IMPROVEMENTS (3 new features)
    eliteCrashRisk,              // 151: elite_crash_risk
    breakoutScoreEnhanced,       // 152: breakout_score_enhanced
    positionCrashRisk,           // 153: position_crash_risk
    // PHASE 6: TIER-1 AND MAGNITUDE IMPROVEMENTS (3 new features)
    tier1CrashRisk,              // 154: tier1_crash_risk
    crashMagnitudeAmplifier,     // 155: crash_magnitude_amplifier
    breakoutCeilingBoost,        // 156: breakout_ceiling_boost
    // ROUND 4: ELITE CRASH AND PLATEAU DETECTION (11 new features)
    eliteRegressionRisk,         // 157: elite_regression_risk
    momentumReversalSignal,      // 158: momentum_reversal_signal
    postBreakoutRegression,      // 159: post_breakout_regression
    age2526PlateauRisk,          // 160: age_25_26_plateau_risk
    qbAgeDangerZone,             // 161: qb_age_danger_zone
    depthPlayerCeiling,          // 162: depth_player_ceiling
    backupRegressionRisk,        // 163: backup_regression_risk
    pffGradeDeclineRate,         // 164: pff_grade_decline_rate
    pffAgeGradeInteraction,      // 165: pff_age_grade_interaction
    teGradeProductionMismatch,   // 166: te_grade_production_mismatch
    pffSnapEfficiency,           // 167: pff_snap_efficiency
  ];
}

// Get confidence level based on prediction interval width
function getConfidence(intervalWidth: number): 'high' | 'medium' | 'low' {
  if (intervalWidth < 500) return 'high';
  if (intervalWidth < 1000) return 'medium';
  return 'low';
}

// Calculate baseline FP from player's historical seasons
function calculateBaselineFP(player: PlayerChartData): number {
  if (player.seasons.length === 0) return 0;

  const totalFP = player.seasons.reduce((sum, s) => sum + s.fantasyPoints, 0);
  const totalGames = player.seasons.reduce((sum, s) => sum + s.gamesPlayed, 0);
  const avgFpPerGame = totalGames > 0 ? totalFP / totalGames : 0;

  return avgFpPerGame * GAMES_PER_SEASON;
}

interface PredictionWithUncertainty {
  predictedKtc: number;
  predictedKtcLow: number | null;
  predictedKtcHigh: number | null;
  intervalWidth: number | null;
  confidence: 'high' | 'medium' | 'low' | null;
}

// Prediction function using projection model for smooth curves
function predictKtcForFPAndGamesWithUncertainty(
  player: PlayerChartData,
  baselineFP: number,
  projectedFP: number,
  projectedGames: number,
  modelYear: number = 2026,
  priorKtcChange: number = 0,
  priorStartKtc: number = 0,
  fpChangeYoy: number | null = null
): PredictionWithUncertainty {
  // Use projection model for smooth predictions
  const predictedKtc = predictWithProjection(
    player,
    projectedFP,
    projectedGames,
    player.latestKtc,
    player.currentAge,
    player.yearsExp,
    modelYear
  );

  // Estimate uncertainty based on player characteristics
  const baseUncertainty = 150; // Base uncertainty in KTC points
  const ageUncertainty = player.currentAge > 30 ? 100 : 0;
  const expUncertainty = player.yearsExp < 3 ? 100 : 0;

  const totalUncertainty = baseUncertainty + ageUncertainty + expUncertainty;
  const predictedKtcLow = Math.max(0, predictedKtc - totalUncertainty);
  const predictedKtcHigh = Math.min(KTC_MAX_VALUE, predictedKtc + totalUncertainty);
  const intervalWidth = predictedKtcHigh - predictedKtcLow;
  const confidence = getConfidence(intervalWidth);

  return {
    predictedKtc,
    predictedKtcLow,
    predictedKtcHigh,
    intervalWidth,
    confidence,
  };
}

// ROUND 10: Apply prediction corrections (same as generate_chart_data_pff.py)
// FP-gated corrections: absolute FP predicts breakouts/crashes better than FP change
function applyPredictionCorrections(
  predictedChange: number,
  startKtc: number,
  position: string,
  age: number,
  yearsExp: number,
  fpChangeYoy: number | null,
  priorKtcChange: number,
  priorStartKtc: number,
  ktc90dTrend: number = 0,
  fantasyPoints: number = 0  // Round 10: absolute FP for gating
): number {
  const KTC_MAX = 9999;

  // RB CLIFF: RBs 28+ should expect decline, not gains
  if (position === 'RB' && age >= 28 && startKtc >= 4000) {
    if (predictedChange > 0) {
      const declineFactor = Math.min((age - 27) * 0.08, 0.30);
      return -declineFactor;
    }
  }

  // ROUND 10: ELITE (8000+) - FP-gated corrections
  // Decision tree: Post-breakout → Rookie elite → High FP → Low FP → Established elite → Standard
  if (startKtc >= 8000) {
    const fp = fantasyPoints;
    const isPostBreakout = priorKtcChange > 0.2;  // Gained 2000+ prior year
    const wasElitePrior = priorStartKtc >= 7500;

    let eliteMean: number;
    let baseRegression: number;

    // 1. POST-BREAKOUT: 87.5% crash regardless of FP
    if (isPostBreakout) {
      eliteMean = 6500;
      baseRegression = 0.60;
    }
    // 2. ROOKIE ELITE: First-year players at elite are overpriced
    else if (yearsExp <= 1 && !wasElitePrior) {
      eliteMean = 6500;
      baseRegression = 0.45;
    }
    // 3. HIGH FP (>=350): Strong maintainer/gainer signal
    else if (fp >= 350) {
      eliteMean = 8500;
      baseRegression = 0.15;  // Light regression
    }
    // 4. LOW FP (<200): High crash risk regardless of prior status
    else if (fp < 200) {
      eliteMean = 6500;
      baseRegression = 0.50;
    }
    // 5. ESTABLISHED ELITE with decent FP (200-350)
    else if (wasElitePrior && fp >= 200) {
      eliteMean = 7500;
      baseRegression = 0.25;
    }
    // 6. STANDARD: Position-specific regression
    else {
      if (position === 'RB') {
        eliteMean = 6000;
        baseRegression = 0.55;
      } else if (position === 'TE') {
        eliteMean = 6200;
        baseRegression = 0.50;
      } else if (position === 'QB') {
        eliteMean = 7200;
        baseRegression = 0.35;
      } else {
        eliteMean = 7000;
        baseRegression = 0.30;
      }
    }

    const predictedEnd = startKtc + (eliteMean - startKtc) * baseRegression;
    return (predictedEnd - startKtc) / KTC_MAX;
  }

  // ROUND 10: TIER-1 (6000-8000) - FP-gated breakout detection for young players
  // Data: FP >= 280 -> 53% breakout, 0% crash, avg +1458
  //       FP 180-280 -> 5% breakout, 38% crash, avg -244
  //       FP < 180 -> 0% breakout, 41% crash, avg -772
  if (startKtc >= 6000) {
    const fp = fantasyPoints;

    // YOUNG (<=25): FP-gated breakout detection
    if (age <= 25) {
      if (fp >= 280) {
        // HIGH FP: Allow breakout (53% breakout rate, 0% crash)
        const tier1Target = Math.min(startKtc + 1500, 9000);
        return (tier1Target - startKtc) / KTC_MAX;
      } else if (fp >= 180) {
        // MED FP: Conservative (5% breakout, 38% crash)
        const tier1Target = startKtc - 200;
        return (tier1Target - startKtc) / KTC_MAX;
      } else {
        // LOW FP: Predict decline (0% breakout, 41% crash)
        const tier1Target = Math.max(startKtc - 700, 5000);
        return (tier1Target - startKtc) / KTC_MAX;
      }
    }
    // PRIME (26-29): Position-specific moderate regression
    else if (age <= 29) {
      let tier1Mean: number;
      if (position === 'QB') {
        tier1Mean = 6200;
      } else if (position === 'TE') {
        tier1Mean = 6000;
      } else {
        tier1Mean = 5500;
      }
      return (tier1Mean - startKtc) * 0.15 / KTC_MAX;
    }
    // AGING (30+): Aggressive regression
    else {
      let change = (5000 - startKtc) * 0.25 / KTC_MAX;
      if (ktc90dTrend < -0.03) {
        change -= 0.05;
      }
      return change;
    }
  }

  // Lower tiers: use model prediction as-is
  return predictedChange;
}

// Prediction function using the ensemble model (backward compatible)
function predictKtcForFPAndGames(
  player: PlayerChartData,
  baselineFP: number,
  projectedFP: number,
  projectedGames: number
): number {
  return predictKtcForFPAndGamesWithUncertainty(player, baselineFP, projectedFP, projectedGames).predictedKtc;
}

// Historical prediction function with uncertainty - uses projection model
function predictKtcForFPAndGamesHistoricalWithUncertainty(
  player: PlayerChartData,
  season: SeasonData,
  baselineFP: number,
  projectedFP: number,
  projectedGames: number,
  ageAtSeason: number,
  yearsExpAtSeason: number,
  historicalYear: number = 2026,
  priorKtcChange: number = 0,
  priorStartKtc: number = 0,
  fpChangeYoy: number | null = null
): PredictionWithUncertainty {
  // Get prior season data for context
  const trainingData = loadTrainingData();
  const playerData = trainingData?.players.find(
    p => p.player_id === player.playerId || p.name === player.name
  );

  // Find prior season for FP context
  const priorSeasons = playerData?.seasons
    ?.filter(s => s.year < historicalYear)
    ?.sort((a, b) => b.year - a.year);

  const priorSeason = priorSeasons?.[0];
  const priorSeasonFp = priorSeason?.fantasy_points || 0;
  const priorSeasonGames = priorSeason?.games_played || 0;

  // Calculate PPG
  const ppg = projectedGames > 0 ? projectedFP / projectedGames : 0;

  // Build projection input
  const input: ProjectionInput = {
    position: player.position,
    age: ageAtSeason,
    yearsExp: yearsExpAtSeason,
    currentKtc: season.startKtc,
    draftRound: 4, // Default if unknown
    priorSeasonFp,
    priorSeasonGames,
    snapPct: player.historicalSnapPct || 0.8,
    games: projectedGames,
    ppg,
  };

  const predictedKtc = predictProjection(input, historicalYear);

  // Estimate uncertainty based on player characteristics
  const baseUncertainty = 150;
  const ageUncertainty = ageAtSeason > 30 ? 100 : 0;
  const expUncertainty = yearsExpAtSeason < 3 ? 100 : 0;

  const totalUncertainty = baseUncertainty + ageUncertainty + expUncertainty;
  const predictedKtcLow = Math.max(0, predictedKtc - totalUncertainty);
  const predictedKtcHigh = Math.min(KTC_MAX_VALUE, predictedKtc + totalUncertainty);
  const intervalWidth = predictedKtcHigh - predictedKtcLow;
  const confidence = getConfidence(intervalWidth);

  return {
    predictedKtc,
    predictedKtcLow,
    predictedKtcHigh,
    intervalWidth,
    confidence,
  };
}

// Historical prediction function (backward compatible)
function predictKtcForFPAndGamesHistorical(
  player: PlayerChartData,
  season: SeasonData,
  baselineFP: number,
  projectedFP: number,
  projectedGames: number,
  ageAtSeason: number,
  yearsExpAtSeason: number,
  modelYear: number = 2026,
  priorKtcChange: number = 0,
  priorStartKtc: number = 0,
  fpChangeYoy: number | null = null
): number {
  return predictKtcForFPAndGamesHistoricalWithUncertainty(
    player, season, baselineFP, projectedFP, projectedGames, ageAtSeason, yearsExpAtSeason,
    modelYear, priorKtcChange, priorStartKtc, fpChangeYoy
  ).predictedKtc;
}

// ============================================================================
// API Handler
// ============================================================================

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const playerId = searchParams.get('playerId');
  const gamesParam = searchParams.get('games');
  const yearParam = searchParams.get('year');

  if (!playerId) {
    return NextResponse.json({ error: 'playerId is required' }, { status: 400 });
  }

  const projectedGames = gamesParam ? parseInt(gamesParam, 10) : 17;
  const historicalYear = yearParam ? parseInt(yearParam, 10) : null;

  if (isNaN(projectedGames) || projectedGames < 0 || projectedGames > 17) {
    return NextResponse.json({ error: 'games must be between 0 and 17' }, { status: 400 });
  }

  try {
    const chartData: ChartDataOutput = JSON.parse(fs.readFileSync(chartDataPath, 'utf-8'));
    const player = chartData.players.find(p => p.playerId === playerId);

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const baselineFP = calculateBaselineFP(player);

    // Generate predictions for FP/game range
    const rangeMax = 25;
    const fpPerGameRange: number[] = [];
    for (let fp = 0; fp <= rangeMax; fp += 0.5) {
      fpPerGameRange.push(fp);
    }

    const historicalSeason = historicalYear
      ? player.seasons.find(s => s.year === historicalYear)
      : null;

    const latestSeasonYear = player.seasons.length > 0
      ? Math.max(...player.seasons.map(s => s.year))
      : 2025;
    const yearsDiff = historicalYear ? latestSeasonYear - historicalYear + 1 : 0;
    const ageAtSeason = historicalSeason ? player.currentAge - yearsDiff : player.currentAge;
    const yearsExpAtSeason = historicalSeason ? Math.max(0, player.yearsExp - yearsDiff) : player.yearsExp;

    const baseKtc = historicalSeason ? historicalSeason.startKtc : player.latestKtc;

    const historicalAvgGames = player.seasons.length > 0
      ? Math.round(player.seasons.reduce((sum, s) => sum + s.gamesPlayed, 0) / player.seasons.length)
      : 17;

    // Determine which model year to use
    const modelYear = historicalYear || 2026;

    // Calculate prior year data for corrections (Round 9)
    // This applies to both historical and current predictions
    let priorKtcChange = 0;
    let priorStartKtc = 0;
    let fpChangeYoy: number | null = null;

    // Sort seasons by year
    const sortedSeasons = [...player.seasons].sort((a, b) => a.year - b.year);

    if (historicalSeason && historicalYear) {
      // For historical predictions, use the season before the requested year
      const seasonIndex = sortedSeasons.findIndex(s => s.year === historicalYear);

      if (seasonIndex > 0) {
        const priorSeason = sortedSeasons[seasonIndex - 1];
        priorStartKtc = priorSeason.startKtc;
        if (priorSeason.actualEndKtc && priorSeason.startKtc) {
          priorKtcChange = (priorSeason.actualEndKtc - priorSeason.startKtc) / KTC_MAX_VALUE;
        }
        // Calculate FP change YoY
        if (priorSeason.fantasyPoints > 0 && historicalSeason.fantasyPoints > 0) {
          fpChangeYoy = (historicalSeason.fantasyPoints - priorSeason.fantasyPoints) / priorSeason.fantasyPoints;
        }
      }
    } else if (sortedSeasons.length > 0) {
      // For current/2026 predictions, use the most recent season as prior
      const latestSeason = sortedSeasons[sortedSeasons.length - 1];
      priorStartKtc = latestSeason.startKtc;
      if (latestSeason.actualEndKtc && latestSeason.startKtc) {
        priorKtcChange = (latestSeason.actualEndKtc - latestSeason.startKtc) / KTC_MAX_VALUE;
      }
      // For current predictions, use latest season's FP change if available
      if (sortedSeasons.length > 1) {
        const prevSeason = sortedSeasons[sortedSeasons.length - 2];
        if (prevSeason.fantasyPoints > 0 && latestSeason.fantasyPoints > 0) {
          fpChangeYoy = (latestSeason.fantasyPoints - prevSeason.fantasyPoints) / prevSeason.fantasyPoints;
        }
      }
    }

    const predictions = fpPerGameRange.map(fpPerGame => {
      const totalFP = fpPerGame * projectedGames;

      let predResult: PredictionWithUncertainty;
      if (historicalSeason && historicalYear) {
        predResult = predictKtcForFPAndGamesHistoricalWithUncertainty(
          player, historicalSeason, baselineFP, totalFP, projectedGames,
          ageAtSeason, yearsExpAtSeason, historicalYear,
          priorKtcChange, priorStartKtc, fpChangeYoy
        );
      } else {
        predResult = predictKtcForFPAndGamesWithUncertainty(
          player, baselineFP, totalFP, projectedGames, modelYear,
          priorKtcChange, priorStartKtc, fpChangeYoy
        );
      }

      return {
        projectedFPPerGame: fpPerGame,
        predictedKtc: predResult.predictedKtc,
        predictedKtcLow: predResult.predictedKtcLow,
        predictedKtcHigh: predResult.predictedKtcHigh,
      };
    });

    // Get uncertainty info for the baseline prediction (at average FP/game)
    const baselineUncertainty = historicalSeason && historicalYear
      ? predictKtcForFPAndGamesHistoricalWithUncertainty(
          player, historicalSeason, baselineFP, baselineFP, projectedGames,
          ageAtSeason, yearsExpAtSeason, historicalYear,
          priorKtcChange, priorStartKtc, fpChangeYoy
        )
      : predictKtcForFPAndGamesWithUncertainty(
          player, baselineFP, baselineFP, projectedGames, modelYear,
          priorKtcChange, priorStartKtc, fpChangeYoy
        );

    // Binary search for breakeven
    let breakevenFPPerGame: number | null = null;
    const targetKtc = baseKtc;
    const maxFpPerGame = fpPerGameRange[fpPerGameRange.length - 1];
    let low = 0;
    let high = maxFpPerGame * 1.5;

    for (let i = 0; i < 20; i++) {
      const mid = (low + high) / 2;
      const totalFP = mid * projectedGames;

      const predictedKtc = historicalSeason && historicalYear
        ? predictKtcForFPAndGamesHistorical(
            player, historicalSeason, baselineFP, totalFP, projectedGames,
            ageAtSeason, yearsExpAtSeason, historicalYear,
            priorKtcChange, priorStartKtc, fpChangeYoy
          )
        : predictKtcForFPAndGames(player, baselineFP, totalFP, projectedGames);

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

    if (breakevenFPPerGame !== null && !predictions.some(p => Math.abs(p.projectedFPPerGame - breakevenFPPerGame!) < 0.5)) {
      // Get uncertainty for breakeven point
      const totalFP = breakevenFPPerGame * projectedGames;
      const breakevenUncertainty = historicalSeason && historicalYear
        ? predictKtcForFPAndGamesHistoricalWithUncertainty(
            player, historicalSeason, baselineFP, totalFP, projectedGames,
            ageAtSeason, yearsExpAtSeason, historicalYear,
            priorKtcChange, priorStartKtc, fpChangeYoy
          )
        : predictKtcForFPAndGamesWithUncertainty(
            player, baselineFP, totalFP, projectedGames, modelYear,
            priorKtcChange, priorStartKtc, fpChangeYoy
          );

      predictions.push({
        projectedFPPerGame: breakevenFPPerGame,
        predictedKtc: targetKtc,
        predictedKtcLow: breakevenUncertainty.predictedKtcLow,
        predictedKtcHigh: breakevenUncertainty.predictedKtcHigh,
      });
      predictions.sort((a, b) => a.projectedFPPerGame - b.projectedFPPerGame);
    }

    const response: Record<string, unknown> = {
      playerId: player.playerId,
      name: player.name,
      position: player.position,
      currentAge: historicalSeason ? ageAtSeason : player.currentAge,
      yearsExp: historicalSeason ? yearsExpAtSeason : player.yearsExp,
      latestKtc: baseKtc,
      projectedGames,
      historicalAvgGames,
      confidenceScore: player.confidenceScore,
      confidenceFactors: player.confidenceFactors,
      breakevenFPPerGame,
      predictions,
      // Uncertainty estimation from quantile models
      uncertainty: baselineUncertainty.intervalWidth !== null ? {
        predictionIntervalWidth: baselineUncertainty.intervalWidth,
        confidence: baselineUncertainty.confidence,
        lowBound: baselineUncertainty.predictedKtcLow,
        highBound: baselineUncertainty.predictedKtcHigh,
        description: baselineUncertainty.confidence === 'high'
          ? 'High confidence prediction (narrow interval)'
          : baselineUncertainty.confidence === 'medium'
            ? 'Moderate uncertainty in prediction'
            : 'High uncertainty - prediction range is wide',
      } : null,
      modelInfo: {
        type: 'projection',
        components: ['feedforward-nn'],
        features: 14,  // 14 input features (games, ppg, position, age, etc.)
        modelYear,
        trainYears: modelYear === 2022 ? '2020-2021' :
                    modelYear === 2023 ? '2020-2022' :
                    modelYear === 2024 ? '2020-2023' :
                    modelYear === 2025 ? '2020-2024' : '2020-2025',
        predictionType: 'end_ktc',  // Model predicts end-of-season KTC directly
      },
    };

    if (historicalSeason) {
      const actualFpPerGame = historicalSeason.gamesPlayed > 0
        ? historicalSeason.fantasyPoints / historicalSeason.gamesPlayed
        : 0;

      // Get prediction at actual FP/game
      // First check for exact point we injected (which uses table value)
      let predictedAtActualFP: number;
      const exactPoint = predictions.find(
        p => Math.abs(p.projectedFPPerGame - actualFpPerGame) < 0.01
      );

      if (exactPoint) {
        // Use the exact point (which is the table value)
        predictedAtActualFP = exactPoint.predictedKtc;
      } else {
        // Interpolate between curve points
        const lowerIdx = predictions.findIndex(p => p.projectedFPPerGame > actualFpPerGame) - 1;
        const upperIdx = lowerIdx + 1;

        if (lowerIdx >= 0 && upperIdx < predictions.length) {
          const lower = predictions[lowerIdx];
          const upper = predictions[upperIdx];
          const t = (actualFpPerGame - lower.projectedFPPerGame) /
                    (upper.projectedFPPerGame - lower.projectedFPPerGame);
          predictedAtActualFP = Math.round(lower.predictedKtc + t * (upper.predictedKtc - lower.predictedKtc));
        } else if (lowerIdx < 0 && predictions.length > 0) {
          // Below curve range - use first point
          predictedAtActualFP = predictions[0].predictedKtc;
        } else if (predictions.length > 0) {
          // Above curve range - use last point
          predictedAtActualFP = predictions[predictions.length - 1].predictedKtc;
        } else {
          // Fallback to stored prediction
          predictedAtActualFP = historicalSeason.predictedEndKtc;
        }
      }

      response.isHistorical = true;
      response.historicalYear = historicalYear;
      response.actualPerformance = {
        gamesPlayed: historicalSeason.gamesPlayed,
        fpPerGame: Math.round(actualFpPerGame * 10) / 10,
        actualEndKtc: historicalSeason.actualEndKtc,
        predictedAtActualFP,
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in ktc-predict API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
