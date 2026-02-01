/**
 * Server-side KTC Projection Model Inference
 *
 * This module provides server-side inference for the KTC projection model.
 * It loads weights from the filesystem (unlike the client-side version that uses fetch).
 *
 * The projection model is a simple feedforward neural network that takes:
 * - games: number of games played (0-17)
 * - ppg: fantasy points per game (0-30)
 * - player context: position, age, experience, current KTC, etc.
 *
 * And outputs: predicted end-of-season KTC value
 */

import * as fs from 'fs';
import * as path from 'path';

// Model configuration constants
const KTC_MAX = 9999;
const GAMES_MAX = 17;
const FP_MAX_SEASON = 500;

// Position peak ages for age-relative features
const POSITION_PEAK_AGES: Record<string, number> = {
  QB: 30,
  RB: 25,
  WR: 27,
  TE: 28,
};

// Position cliff ages for accelerating decline
const POSITION_CLIFF_AGES: Record<string, number> = {
  QB: 38,
  RB: 29,
  WR: 32,
  TE: 32,
};

// Model weights structure (supports v2 and v3 architectures)
interface ModelWeights {
  'fc1.weight': number[][];
  'fc1.bias': number[];
  'bn1.weight': number[];
  'bn1.bias': number[];
  'bn1.running_mean': number[];
  'bn1.running_var': number[];
  'fc2.weight': number[][];
  'fc2.bias': number[];
  'bn2.weight': number[];
  'bn2.bias': number[];
  'bn2.running_mean': number[];
  'bn2.running_var': number[];
  // v2 output (2 hidden layers)
  'fc3.weight'?: number[][];
  'fc3.bias'?: number[];
  // v3 architecture (4 hidden layers: 128→64→32→16→1)
  'bn3.weight'?: number[];
  'bn3.bias'?: number[];
  'bn3.running_mean'?: number[];
  'bn3.running_var'?: number[];
  'fc4.weight'?: number[][];
  'fc4.bias'?: number[];
  'bn4.weight'?: number[];
  'bn4.bias'?: number[];
  'bn4.running_mean'?: number[];
  'bn4.running_var'?: number[];
  'fc_out.weight'?: number[][];
  'fc_out.bias'?: number[];
  config: {
    input_size: number;
    hidden1: number;
    hidden2: number;
    hidden3?: number;
    hidden4?: number;
    output_size: number;
    feature_names: string[];
    ktc_max: number;
  };
}

// Input for projection prediction
export interface ProjectionInput {
  position: string;
  age: number;
  yearsExp: number;
  currentKtc: number;
  draftRound: number;
  priorSeasonFp: number;
  priorSeasonGames: number;
  snapPct: number;
  games: number;
  ppg: number;
  // Optional: for trend calculation
  priorPriorFp?: number;
  // Optional: for breakout detection (Phase 2)
  priorSnapPct?: number;
  lateSeasonSurge?: number; // Pre-computed from weekly stats, range [-1, 1]
  // Optional: v3 market sentiment features
  ktcMomentum?: number; // (ktc_30d_trend + ktc_90d_trend) / 2, normalized
  marketConfidence?: number; // 1 / sqrt(ktc_volatility + 0.01), normalized
  // Optional: v3 efficiency features
  consistencyScore?: number; // 1 - min(weekly_fp_cv, 1.0)
  touchesPerGame?: number; // (targets + carries) / games, normalized
  // Optional: v5 weekly/red zone features
  ktcTrajectory?: number; // In-season KTC change (second half vs first half), normalized [-1, 1]
  redZoneEfficiency?: number; // TDs / red zone opportunities, range [0, 1]
  opportunityShare?: number; // Target/rush share based on position, range [0, 1]
  elitePeak?: number; // Elite + elite PPG indicator, 0 or 1
  // Optional: v6 TE elite fix
  teEliteIndicator?: number; // TE-specific elite indicator with lower thresholds, 0 or 1
  // Optional: v7 comprehensive improvements
  boomRate?: number; // % of games with boom performance, range [0, 1]
  bustRate?: number; // % of games with bust performance, range [0, 1]
  last4VsSeason?: number; // Late season vs full season FP ratio, typically ~1.0
  yardsPerTarget?: number; // For WR/TE efficiency
  yardsPerCarry?: number; // For RB efficiency
  weeklyKtc?: Array<{ week: number; ktc: number }>; // Weekly KTC data for momentum
}

// Cache for year-specific model weights
// Note: This cache persists across requests in the same server process
const weightsCache: Record<number, ModelWeights | null> = {};

// Expected feature count for v9 model
const EXPECTED_INPUT_SIZE = 57;

// Force clear cache on module load to ensure fresh weights are loaded
// This helps when weights files are updated without server restart
Object.keys(weightsCache).forEach(key => delete weightsCache[Number(key)]);
console.log('[projection-inference] Module loaded, cache cleared, expecting v9 model with 57 features');

/**
 * Load model weights for a specific year
 */
function loadWeights(year: number = 2026): ModelWeights | null {
  // Normalize year to available model years
  let modelYear: number;
  if (year >= 2026) {
    modelYear = 2026;
  } else if (year < 2022) {
    modelYear = 2022;
  } else {
    modelYear = year;
  }

  // Check if cached weights have correct input size (invalidate stale v8 cache)
  if (weightsCache[modelYear] !== undefined) {
    const cached = weightsCache[modelYear];
    if (cached && cached.config?.input_size !== EXPECTED_INPUT_SIZE) {
      console.log(`Invalidating stale cache for year ${modelYear} (has ${cached.config?.input_size} features, expected ${EXPECTED_INPUT_SIZE})`);
      delete weightsCache[modelYear];
    } else {
      return weightsCache[modelYear];
    }
  }

  try {
    // Try multiple possible paths
    const possiblePaths = [
      path.resolve(process.cwd(), `public/models/ktc/projection-model-${modelYear}-weights.json`),
      path.resolve(process.cwd(), `../public/models/ktc/projection-model-${modelYear}-weights.json`),
      path.resolve(process.cwd(), `models/ktc/models/projection-model-${modelYear}-weights.json`),
    ];

    for (const weightsPath of possiblePaths) {
      if (fs.existsSync(weightsPath)) {
        const data = fs.readFileSync(weightsPath, 'utf-8');
        weightsCache[modelYear] = JSON.parse(data) as ModelWeights;
        return weightsCache[modelYear];
      }
    }

    console.warn(`Projection model weights not found for year ${modelYear}`);
    weightsCache[modelYear] = null;
    return null;
  } catch (error) {
    console.error(`Failed to load projection weights for year ${modelYear}:`, error);
    weightsCache[modelYear] = null;
    return null;
  }
}

/**
 * ReLU activation function
 */
function relu(x: number[]): number[] {
  return x.map((v) => Math.max(0, v));
}

/**
 * Matrix-vector multiplication: W @ x + b
 */
function linear(x: number[], weight: number[][], bias: number[]): number[] {
  const result: number[] = [];
  for (let i = 0; i < weight.length; i++) {
    let sum = bias[i];
    for (let j = 0; j < x.length; j++) {
      sum += weight[i][j] * x[j];
    }
    result.push(sum);
  }
  return result;
}

/**
 * Batch normalization (inference mode)
 */
function batchNorm(
  x: number[],
  gamma: number[],
  beta: number[],
  runningMean: number[],
  runningVar: number[],
  eps = 1e-5
): number[] {
  return x.map((xi, i) => {
    const normalized = (xi - runningMean[i]) / Math.sqrt(runningVar[i] + eps);
    return gamma[i] * normalized + beta[i];
  });
}

/**
 * Prepare input features from player context (57 features - v9 with Targeted Weakness Fixes)
 *
 * v2 additions:
 * - Elite calibration (3): ceiling_pressure, age_risk, upside_cap
 * - Breakout detection (5): snap_trajectory, young_rising_snap, efficiency_vs_snap,
 *                           te_development_stage, late_season_surge
 * v3 additions:
 * - Market sentiment (2): ktc_momentum, market_confidence
 * - Efficiency (2): consistency_score, touches_per_game
 * v5 additions:
 * - Weekly/Red Zone (4): ktc_trajectory, red_zone_efficiency, opportunity_share, elite_peak
 * v6 additions:
 * - TE Elite fix (1): te_elite_indicator
 * v7 additions:
 * - Comprehensive improvements (8): backup_qb_penalty, weekly_ktc_momentum, ktc_surge_indicator,
 *   boom_rate, bust_rate, late_season_ratio, efficiency_score, rookie_tier
 * v8 additions:
 * - Validation analysis (4): low_games_penalty, elite_value_anchor, ppg_nonlinearity, opportunity_increase
 * v9 additions:
 * - Targeted weakness fixes (6): qb_role_signal, young_ceiling_upside, snap_acceleration,
 *   wr_age_cliff, aging_wr_decline, opportunity_ceiling
 */
function prepareFeatures(input: ProjectionInput, isV3: boolean = false): number[] {
  const {
    games,
    ppg,
    position,
    age,
    yearsExp,
    currentKtc,
    draftRound,
    priorSeasonFp,
    priorSeasonGames,
    snapPct,
    priorPriorFp = 0,
    priorSnapPct = snapPct, // Default to current if not provided
    lateSeasonSurge = 0, // Default to 0 if not provided
    // v3 features with defaults
    ktcMomentum = 0,
    marketConfidence = 0.5,
    consistencyScore = 0.5,
    touchesPerGame = 0,
    // v5 features with defaults
    ktcTrajectory = 0,
    redZoneEfficiency = 0,
    opportunityShare = 0,
    elitePeak = 0,
    // v6 feature
    teEliteIndicator,
    // v7 features - comprehensive improvements
    boomRate = 0,
    bustRate = 0,
    last4VsSeason = 1.0,
    yardsPerTarget = 0,
    yardsPerCarry = 0,
    weeklyKtc = [],
  } = input;

  // Position one-hot encoding (3 features - is_te removed as derivable)
  const isQb = position === 'QB' ? 1 : 0;
  const isRb = position === 'RB' ? 1 : 0;
  const isWr = position === 'WR' ? 1 : 0;

  // Age relative to position peak (for qb_upside_interaction calculation)
  const peakAge = POSITION_PEAK_AGES[position] || 27;
  const cliffAge = POSITION_CLIFF_AGES[position] || 32;
  const yearsBeforePeak = Math.max(0, peakAge - age) / 10;

  // === Age Decay Features ===
  const yearsPastCliff = Math.max(0, age - cliffAge) / 10;
  const ageDecayFactor = age > 30 ? Math.pow((age - 30) / 10, 1.5) : 0;

  // === Breakout Detection Features (original) ===
  const isRookie = yearsExp <= 1 ? 1 : 0;
  const highDraftCapital = draftRound <= 2 ? 1 : 0;
  const rookieWithCapital = isRookie * highDraftCapital;
  const priorTrend = priorPriorFp > 0 ? (priorSeasonFp - priorPriorFp) / FP_MAX_SEASON : 0;

  // === Position-Specific Interaction Features ===
  const rbAgeInteraction = isRb * (age - 25) / 10;
  const qbUpsideInteraction = isQb * yearsBeforePeak;

  // === Elite Calibration Features (Phase 1) ===
  const startKtcNorm = currentKtc / KTC_MAX;
  // Elite ceiling pressure - high KTC players have less room to grow
  const eliteCeilingPressure = Math.max(0, startKtcNorm - 0.6) * 2.5;
  // Elite age risk - elite + aging = crash risk
  const isElite = currentKtc > 6000 ? 1 : 0;
  const eliteAgeRisk = isElite * Math.max(0, (age - peakAge) / 10);
  // KTC upside cap - diminishing returns at top
  const ktcUpsideCap = Math.max(0, 1 - startKtcNorm);

  // === Breakout Detection Features (Phase 2) ===
  // Snap trajectory - change from prior year
  const snapTrajectory = snapPct - priorSnapPct;
  // Young rising snap - binary flag for young players with increasing snaps
  const youngRisingSnap = yearsExp <= 3 && snapTrajectory > 0.15 ? 1 : 0;
  // Efficiency vs opportunity - high efficiency + low snaps = upside
  let efficiencyVsSnap = snapPct > 0 ? (ppg / 25) / Math.max(snapPct, 0.1) : 0;
  efficiencyVsSnap = Math.min(efficiencyVsSnap, 3.0); // Cap at 3x
  // TE development stage - TEs peak later (years 2-4 are breakout years)
  const teDevelopmentStage = position === 'TE' && yearsExp >= 2 && yearsExp <= 4 ? 1 : 0;

  // === Analysis Insights Features (v4) ===
  // QB Backup Detector
  const priorPpg = priorSeasonGames > 0 ? priorSeasonFp / priorSeasonGames : 0;
  let qbBackupSignal = 0;
  if (isQb) {
    const isLowPrior = priorPpg < 12 && priorSeasonGames > 0;
    const isLatePickVet = draftRound >= 4 && yearsExp > 1;
    if (isLowPrior || isLatePickVet) {
      qbBackupSignal = 1;
    }
  }

  // Elite Sustain Bonus
  let eliteSustain = 0;
  if (currentKtc >= 8000 && ppg >= 18) {
    eliteSustain = 1;
  } else if (currentKtc >= 6000 && ppg >= 20) {
    eliteSustain = 0.5;
  }

  // Sample Size Confidence
  const sampleConfidence = Math.min(1, games / 14);

  // Age-Market Penalty
  let ageMarketPenalty = 0;
  if (age >= 28) {
    let basePenalty = (age - 28) / 10;
    if (priorTrend < 0) {
      basePenalty *= 1.5;
    }
    ageMarketPenalty = Math.min(1, basePenalty);
  }

  // === TE Elite Indicator (v6) ===
  // TEs have lower KTC ceilings than QBs/WRs, so need lower thresholds
  // Addresses Kelce (-2123), Hockenson (-2617) underprediction
  const isTE = position === 'TE';
  let teEliteIndicatorValue = teEliteIndicator ?? 0;
  if (teEliteIndicator === undefined) {
    if (isTE && currentKtc >= 5000 && ppg >= 12) {
      teEliteIndicatorValue = 1;
    } else if (isTE && currentKtc >= 4000 && ppg >= 15) {
      teEliteIndicatorValue = 1;
    }
  }

  // ============================================================
  // v7 Features: Comprehensive Improvements
  // ============================================================

  // Feature 39: Backup QB Penalty
  let backupQbPenalty = 0;
  if (isQb && games < 10) {
    backupQbPenalty = (10 - games) / 10;
  }

  // Feature 40: Weekly KTC Momentum
  let weeklyKtcMomentum = 0;
  if (weeklyKtc && weeklyKtc.length >= 8) {
    const earlyKtcValues = weeklyKtc.slice(0, 4).filter(w => w.ktc > 0).map(w => w.ktc);
    const lateKtcValues = weeklyKtc.slice(-4).filter(w => w.ktc > 0).map(w => w.ktc);
    if (earlyKtcValues.length > 0 && lateKtcValues.length > 0) {
      const earlyAvg = earlyKtcValues.reduce((a, b) => a + b, 0) / earlyKtcValues.length;
      const lateAvg = lateKtcValues.reduce((a, b) => a + b, 0) / lateKtcValues.length;
      if (earlyAvg > 0) {
        weeklyKtcMomentum = Math.max(-1, Math.min(1, (lateAvg - earlyAvg) / Math.max(earlyAvg, 1000)));
      }
    }
  }

  // Feature 41: KTC Surge Indicator
  let ktcSurgeIndicator = 0;
  if (weeklyKtc && weeklyKtc.length >= 4) {
    let surgeWeeks = 0;
    for (let i = 1; i < weeklyKtc.length; i++) {
      const prevKtc = weeklyKtc[i - 1].ktc;
      const currKtc = weeklyKtc[i].ktc;
      if (prevKtc > 0 && currKtc > prevKtc * 1.05) {
        surgeWeeks++;
      }
    }
    ktcSurgeIndicator = surgeWeeks / Math.max(weeklyKtc.length - 1, 1);
  }

  // Feature 44: Late Season Ratio (normalized)
  const lateSeasonRatio = Math.max(0.5, Math.min(1.5, last4VsSeason));
  const lateSeasonRatioNorm = (lateSeasonRatio - 0.5) / 1.0;

  // Feature 45: Efficiency Score (Position-Specific)
  let efficiencyScore = 0.5;
  if (isWr || isTE) {
    efficiencyScore = Math.min(1, yardsPerTarget / 12);
  } else if (isRb) {
    efficiencyScore = Math.min(1, yardsPerCarry / 5);
  }

  // Feature 46: Rookie Tier
  let rookieTier = 0;
  if (yearsExp === 0) {
    if (draftRound <= 2) {
      rookieTier = 1.0;
    } else if (draftRound <= 4) {
      rookieTier = 0.5;
    } else {
      rookieTier = -0.5;
    }
  }

  // ============================================================
  // v8 Features: Validation Analysis Improvements
  // Based on deep analysis showing:
  // - Elite (>6000 KTC): -1,567 bias (severe underprediction)
  // - Low games (0-8): +457 bias (severe overestimation)
  // - 20+ PPG: MAE 1,604 (2x worse than 10-15 PPG)
  // ============================================================

  // Feature 47: Low-Games Penalty (ALL POSITIONS)
  let lowGamesPenalty = 0;
  if (games < 10) {
    lowGamesPenalty = ((10 - games) / 10) * 0.5;
  }

  // Feature 48: Elite Value Anchor
  let eliteValueAnchor = 0;
  if (currentKtc >= 6000 && ppg >= 15) {
    eliteValueAnchor = 1.0;
  } else if (currentKtc >= 7000) {
    eliteValueAnchor = 0.5;
  }

  // Feature 49: PPG Nonlinearity Signal
  let ppgNonlinearity = 0;
  if (ppg >= 20) {
    ppgNonlinearity = 1.0;
  } else if (ppg >= 15) {
    ppgNonlinearity = (ppg - 15) / 5;
  }

  // Feature 50: Opportunity Increase Signal
  let opportunityIncrease = 0;
  if (priorSnapPct !== undefined && snapPct > priorSnapPct) {
    opportunityIncrease = Math.min(1.0, (snapPct - priorSnapPct) * 2);
  }

  // ============================================================
  // v9 Features: Targeted Weakness Fixes (Feb 2026)
  // Based on analysis showing:
  // - Backup QBs: +326 KTC overprediction
  // - Young players (20-24): -700 MAE underprediction
  // - Aging WRs (30+): 79% overprediction rate
  // - Low-value (500-999 KTC): 82.5% overprediction rate
  // ============================================================

  // Feature 51: QB Role Signal
  let qbRoleSignal = 0;
  if (isQb) {
    if (games >= 14) {
      qbRoleSignal = -0.3;  // Proven starter boost
    } else if (games < 5) {
      qbRoleSignal = 1.0;   // Clear backup penalty
    } else if (games < 10 && ppg < 15) {
      qbRoleSignal = 0.8;   // Limited role penalty
    }
  }

  // Feature 52: Young Ceiling Upside
  let youngCeilingUpside = 0;
  if (age < 24 && currentKtc < 3000) {
    youngCeilingUpside = (24 - age) / 5;
  }

  // Feature 53: Snap Acceleration
  let snapAcceleration = 0;
  if (yearsExp <= 3 && snapTrajectory > 0.10) {
    snapAcceleration = Math.min(1.0, snapTrajectory * 3);
  }

  // Feature 54: WR Age Cliff
  let wrAgeCliff = 0;
  if (isWr && age >= 30) {
    wrAgeCliff = Math.min(1.0, Math.pow((age - 30) / 4, 1.3));
  }

  // Feature 55: Aging WR Decline
  let agingWrDecline = 0;
  if (isWr && age >= 30 && lateSeasonSurge < -0.15) {
    agingWrDecline = 1.0;
  }

  // Feature 56: Opportunity Ceiling
  let opportunityCeiling = 0;
  if (currentKtc < 1500) {
    const touchesNormalized = touchesPerGame / 15;
    if (snapPct < 0.3 && touchesNormalized < 0.15) {
      opportunityCeiling = 1.0;  // Stuck on bench
    } else if (snapPct < 0.5) {
      opportunityCeiling = 0.6;
    }
  }

  // Build base feature vector (26 features - v2 with Elite + Breakout)
  const baseFeatures = [
    // User inputs (2)
    games / GAMES_MAX,                    // 0: games normalized
    ppg / 25,                             // 1: ppg normalized
    // Position one-hot (3 - is_te removed)
    isQb,                                 // 2
    isRb,                                 // 3
    isWr,                                 // 4
    // Demographics (4)
    age / 40,                             // 5: age normalized
    yearsExp / 15,                        // 6: experience normalized
    startKtcNorm,                         // 7: starting KTC normalized
    (8 - draftRound) / 7,                 // 8: draft capital (higher = better)
    // Historical (3)
    priorSeasonFp / FP_MAX_SEASON,        // 9: prior year production
    priorSeasonGames / GAMES_MAX,         // 10: prior year availability
    snapPct,                              // 11: snap percentage (already 0-1)
    // Age decay (2)
    yearsPastCliff,                       // 12: accelerating post-cliff decline
    ageDecayFactor,                       // 13: non-linear veteran decay
    // Breakout detection (2)
    rookieWithCapital,                    // 14: high-capital rookie flag
    priorTrend,                           // 15: improvement trajectory
    // Position-specific (2)
    rbAgeInteraction,                     // 16: RB-specific age effect
    qbUpsideInteraction,                  // 17: QB breakout potential
    // Elite calibration (3 - Phase 1)
    eliteCeilingPressure,                 // 18: ceiling pressure for high KTC
    eliteAgeRisk,                         // 19: elite + aging crash risk
    ktcUpsideCap,                         // 20: room to grow (inverse of KTC)
    // Breakout detection Phase 2 (5)
    snapTrajectory,                       // 21: change in snap % from prior year
    youngRisingSnap,                      // 22: young + rising snaps flag
    efficiencyVsSnap,                     // 23: production efficiency vs opportunity
    teDevelopmentStage,                   // 24: TE in breakout years (2-4)
    lateSeasonSurge,                      // 25: momentum from late vs early season
  ];

  // Add v3/v4/v5/v6/v7/v8/v9/v10 features if using v3+ model (63 features total for v10)
  if (isV3) {
    baseFeatures.push(
      // Market sentiment (2 - v3)
      Math.max(-1, Math.min(1, ktcMomentum)),  // 26: KTC momentum (clamped)
      Math.min(1, marketConfidence),           // 27: market confidence (clamped)
      // Efficiency (2 - v3)
      Math.max(0, Math.min(1, consistencyScore)), // 28: consistency score
      Math.min(1, touchesPerGame / 15),        // 29: touches per game normalized
      // Analysis insights (4 - v4)
      qbBackupSignal,                          // 30: backup QB detector
      eliteSustain,                            // 31: elite sustain bonus
      sampleConfidence,                        // 32: games-based confidence
      ageMarketPenalty,                        // 33: age-market penalty
      // Weekly/Red Zone insights (4 - v5)
      Math.max(-1, Math.min(1, ktcTrajectory)), // 34: in-season KTC change
      Math.min(1, redZoneEfficiency),          // 35: red zone TD efficiency
      Math.min(1, opportunityShare),           // 36: target/rush share
      elitePeak,                               // 37: elite peak indicator
      // TE Elite fix (1 - v6)
      teEliteIndicatorValue,                   // 38: TE-specific elite indicator
      // v7 Comprehensive Improvements (8)
      backupQbPenalty,                         // 39: penalize backup QBs with <10 games
      weeklyKtcMomentum,                       // 40: in-season KTC momentum
      ktcSurgeIndicator,                       // 41: proportion of weeks with >5% KTC gain
      boomRate,                                // 42: % of games with boom performance
      bustRate,                                // 43: % of games with bust performance
      lateSeasonRatioNorm,                     // 44: late season vs full season FP ratio
      efficiencyScore,                         // 45: position-specific efficiency
      rookieTier,                              // 46: differentiate elite vs late-round rookies
      // v8 Validation Analysis Improvements (4)
      lowGamesPenalty,                         // 47: penalize ALL positions with <10 games
      eliteValueAnchor,                        // 48: counter elite_ceiling_pressure
      ppgNonlinearity,                         // 49: flag for elite scorers (20+ PPG)
      opportunityIncrease,                     // 50: amplified snap trajectory
      // v9 Targeted Weakness Fixes (6)
      qbRoleSignal,                            // 51: QB role confidence (backup vs starter)
      youngCeilingUpside,                      // 52: upside for young players with room to grow
      snapAcceleration,                        // 53: amplified snap trajectory for young breakouts
      wrAgeCliff,                              // 54: WR-specific aggressive age decay
      agingWrDecline,                          // 55: flag aging WRs with late-season decline
      opportunityCeiling,                      // 56: cap upside for low-value stuck players
    );
  }

  return baseFeatures;
}

/**
 * Run forward pass through the neural network
 * Supports both v2 (2 hidden layers) and v3 (4 hidden layers) architectures
 */
function forward(features: number[], weights: ModelWeights): number {
  // Detect v3 architecture (has fc_out layer)
  const isV3 = 'fc_out.weight' in weights && weights['fc_out.weight'] !== undefined;

  // Layer 1: Linear + BatchNorm + ReLU
  let x = linear(features, weights['fc1.weight'], weights['fc1.bias']);
  x = batchNorm(
    x,
    weights['bn1.weight'],
    weights['bn1.bias'],
    weights['bn1.running_mean'],
    weights['bn1.running_var']
  );
  x = relu(x);

  // Layer 2: Linear + BatchNorm + ReLU
  x = linear(x, weights['fc2.weight'], weights['fc2.bias']);
  x = batchNorm(
    x,
    weights['bn2.weight'],
    weights['bn2.bias'],
    weights['bn2.running_mean'],
    weights['bn2.running_var']
  );
  x = relu(x);

  if (isV3) {
    // v3 architecture: 4 hidden layers (128→64→32→16→1)
    // Layer 3: Linear + BatchNorm + ReLU
    x = linear(x, weights['fc3.weight']!, weights['fc3.bias']!);
    x = batchNorm(
      x,
      weights['bn3.weight']!,
      weights['bn3.bias']!,
      weights['bn3.running_mean']!,
      weights['bn3.running_var']!
    );
    x = relu(x);

    // Layer 4: Linear + BatchNorm + ReLU
    x = linear(x, weights['fc4.weight']!, weights['fc4.bias']!);
    x = batchNorm(
      x,
      weights['bn4.weight']!,
      weights['bn4.bias']!,
      weights['bn4.running_mean']!,
      weights['bn4.running_var']!
    );
    x = relu(x);

    // Output layer: Linear (no activation)
    x = linear(x, weights['fc_out.weight']!, weights['fc_out.bias']!);
  } else {
    // v2 architecture: 2 hidden layers (64→32→1)
    // Output layer: Linear (no activation)
    x = linear(x, weights['fc3.weight']!, weights['fc3.bias']!);
  }

  return x[0];
}

/**
 * Predict KTC value using the projection model
 *
 * @param input - Player context and prediction inputs (games, ppg)
 * @param year - Model year to use (2022-2026). Affects which model weights are loaded.
 * @returns Predicted KTC value (0-9999)
 */
export function predictProjection(input: ProjectionInput, year: number = 2026): number {
  let weights = loadWeights(year);
  if (!weights) {
    console.warn(`No projection weights available for year ${year}, returning current KTC`);
    return input.currentKtc;
  }

  // Validate model has correct input size
  const modelInputSize = weights.config?.input_size;
  if (modelInputSize !== EXPECTED_INPUT_SIZE) {
    console.error(`Model dimension mismatch! Expected ${EXPECTED_INPUT_SIZE} features, got ${modelInputSize}. Weights may be stale.`);
    // Force cache clear and retry once
    const modelYear = year >= 2026 ? 2026 : year < 2022 ? 2022 : year;
    delete weightsCache[modelYear];
    weights = loadWeights(year);
    if (!weights || weights.config?.input_size !== EXPECTED_INPUT_SIZE) {
      console.error(`Failed to load v9 weights. Returning current KTC.`);
      return input.currentKtc;
    }
    console.log(`Successfully reloaded v9 weights with ${weights.config?.input_size} features`);
  }

  // Detect v3 architecture (has fc_out layer)
  const isV3 = 'fc_out.weight' in weights && weights['fc_out.weight'] !== undefined;

  const features = prepareFeatures(input, isV3);

  // Validate feature count matches model expectation
  if (features.length !== EXPECTED_INPUT_SIZE) {
    console.error(`Feature count mismatch! Prepared ${features.length} features, model expects ${EXPECTED_INPUT_SIZE}`);
    return input.currentKtc;
  }

  // Debug: Check for NaN in features
  const nanIndex = features.findIndex(f => isNaN(f));
  if (nanIndex !== -1) {
    console.warn(`NaN found in feature at index ${nanIndex}, input:`, input);
    return input.currentKtc;
  }

  const normalizedKtc = forward(features, weights);

  // Handle NaN result from forward pass
  if (isNaN(normalizedKtc)) {
    console.warn(`NaN result from forward pass for year ${year}, returning current KTC`);
    return input.currentKtc;
  }

  const ktc = normalizedKtc * KTC_MAX;
  return Math.max(0, Math.min(KTC_MAX, Math.round(ktc)));
}

/**
 * Get model info for a specific year
 */
export function getProjectionModelInfo(year: number): { trainYears: string; available: boolean } {
  const weights = loadWeights(year);
  if (!weights) {
    return { trainYears: 'N/A', available: false };
  }

  // Determine training years based on model year
  const modelYear = year >= 2026 ? 2026 : year < 2022 ? 2022 : year;
  const trainYearsMap: Record<number, string> = {
    2022: '2020-2021',
    2023: '2020-2022',
    2024: '2020-2023',
    2025: '2020-2024',
    2026: '2020-2025',
  };

  return {
    trainYears: trainYearsMap[modelYear] || '2020-2025',
    available: true,
  };
}
