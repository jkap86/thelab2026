/**
 * Interactive KTC Projection Model - TypeScript Inference
 *
 * This module provides browser-based inference for the KTC projection model.
 * Users can adjust games played and PPG to see predicted KTC values.
 *
 * Usage:
 *   const predictor = new KTCProjectionModel();
 *   await predictor.loadWeights();
 *   const ktc = predictor.predict({ games: 15, ppg: 18, ...playerContext });
 */

// Model configuration
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

export interface PlayerContext {
  position: 'QB' | 'RB' | 'WR' | 'TE';
  age: number;
  yearsExp: number;
  currentKtc: number;
  draftRound: number;
  priorSeasonFp: number;
  priorSeasonGames: number;
  snapPct: number;
  // Optional: for trend calculation
  priorPriorFp?: number;
  // Optional: for breakout detection (Phase 2)
  priorSnapPct?: number;
  lateSeasonSurge?: number; // Pre-computed from weekly stats, range [-1, 1]
  // Optional: for market sentiment (v3)
  ktcMomentum?: number; // Average of 30d and 90d trends, normalized [-1, 1]
  marketConfidence?: number; // Inverse volatility, normalized [0, 1]
  // Optional: for efficiency (v3)
  consistencyScore?: number; // 1 - weekly_fp_cv, range [0, 1]
  touchesPerGame?: number; // (targets + carries) / games, normalized [0, 1]
  // Optional: for weekly/red zone data (v5)
  ktcTrajectory?: number; // In-season KTC change (second half vs first half), normalized [-1, 1]
  redZoneEfficiency?: number; // TDs / red zone opportunities, range [0, 1]
  opportunityShare?: number; // Target/rush share based on position, range [0, 1]
  elitePeak?: number; // Elite + elite PPG indicator, 0 or 1
  // Optional: for TE elite fix (v6)
  teEliteIndicator?: number; // TE-specific elite indicator with lower thresholds, 0 or 1
  // Optional: v7 comprehensive improvements
  boomRate?: number; // % of games with boom performance, range [0, 1]
  bustRate?: number; // % of games with bust performance, range [0, 1]
  last4VsSeason?: number; // Late season vs full season FP ratio, typically ~1.0
  yardsPerTarget?: number; // For WR/TE efficiency
  yardsPerCarry?: number; // For RB efficiency
  weeklyKtc?: Array<{ week: number; ktc: number }>; // Weekly KTC data for momentum
}

export interface ProjectionInput extends PlayerContext {
  games: number; // User-adjustable: 0-17
  ppg: number; // User-adjustable: 0-30
}

interface ModelWeights {
  // v3 architecture: 30 → 128 → 64 → 32 → 16 → 1
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
  'fc3.weight': number[][];
  'fc3.bias': number[];
  'bn3.weight': number[];
  'bn3.bias': number[];
  'bn3.running_mean': number[];
  'bn3.running_var': number[];
  'fc4.weight': number[][];
  'fc4.bias': number[];
  'bn4.weight': number[];
  'bn4.bias': number[];
  'bn4.running_mean': number[];
  'bn4.running_var': number[];
  'fc_out.weight': number[][];
  'fc_out.bias': number[];
  config: {
    input_size: number;
    hidden1: number;
    hidden2: number;
    hidden3?: number;
    hidden4?: number;
    output_size: number;
    feature_names: string[];
    ktc_max: number;
    version?: string;
  };
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
function linear(
  x: number[],
  weight: number[][],
  bias: number[]
): number[] {
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

export class KTCProjectionModel {
  private weights: ModelWeights | null = null;
  private loadedYear: number | null = null;

  /**
   * Load model weights from JSON file (default/latest model)
   */
  async loadWeights(weightsPath?: string): Promise<void> {
    const path =
      weightsPath || '/models/ktc/projection-model-weights.json';
    const response = await fetch(path);
    this.weights = await response.json();
    this.loadedYear = 2026; // Default model is trained on all data
  }

  /**
   * Load year-specific model weights for historical predictions.
   * Each year's model is trained only on data from prior years,
   * so historical views show what the model "would have predicted" at that time.
   *
   * @param year - The year to load (2022-2026). Years >= 2026 use the latest model.
   */
  async loadWeightsForYear(year: number): Promise<void> {
    // If already loaded for this year, skip
    if (this.loadedYear === year && this.weights) {
      return;
    }

    // Determine which model to use
    // 2022-2025: use year-specific model
    // 2026+: use the latest model (trained on all data)
    // < 2022: use 2022 model as fallback
    let modelYear: number;
    if (year >= 2026) {
      modelYear = 2026;
    } else if (year < 2022) {
      modelYear = 2022;
    } else {
      modelYear = year;
    }

    const path = `/models/ktc/projection-model-${modelYear}-weights.json`;
    const response = await fetch(path);
    this.weights = await response.json();
    this.loadedYear = modelYear;
  }

  /**
   * Get the currently loaded model year
   */
  getLoadedYear(): number | null {
    return this.loadedYear;
  }

  /**
   * Set weights directly (for server-side usage)
   */
  setWeights(weights: ModelWeights, year?: number): void {
    this.weights = weights;
    this.loadedYear = year || null;
  }

  /**
   * Prepare input features from player context and user inputs (51 features - v8)
   *
   * v3 additions:
   * - Market sentiment (2): ktc_momentum, market_confidence
   * - Efficiency (2): consistency_score, touches_per_game
   *
   * v5 additions:
   * - Weekly/Red Zone (4): ktc_trajectory, red_zone_efficiency, opportunity_share, elite_peak
   *
   * v6 additions:
   * - TE Elite fix (1): te_elite_indicator
   *
   * v7 additions:
   * - Comprehensive improvements (8): backup_qb_penalty, weekly_ktc_momentum, ktc_surge_indicator,
   *   boom_rate, bust_rate, late_season_ratio, efficiency_score, rookie_tier
   */
  private prepareFeatures(input: ProjectionInput): number[] {
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
      // v3 features - default to neutral values
      ktcMomentum = 0, // No trend by default
      marketConfidence = 0.5, // Middle confidence by default
      consistencyScore = 0.5, // Average consistency by default
      touchesPerGame = 0.5, // Average touches by default
      // v5 features - default to neutral values
      ktcTrajectory = 0, // No in-season change by default
      redZoneEfficiency = 0, // No red zone data by default
      opportunityShare = 0, // No share data by default
      elitePeak = 0, // Not elite peak by default
      // v6 features - TE elite fix
      teEliteIndicator, // Will be computed if not provided
      // v7 features - comprehensive improvements
      boomRate = 0, // No boom data by default
      bustRate = 0, // No bust data by default
      last4VsSeason = 1.0, // Neutral by default
      yardsPerTarget = 0, // No YPT data by default
      yardsPerCarry = 0, // No YPC data by default
      weeklyKtc = [], // No weekly KTC data by default
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
    const priorTrend =
      priorPriorFp > 0 ? (priorSeasonFp - priorPriorFp) / FP_MAX_SEASON : 0;

    // === Position-Specific Interaction Features ===
    const rbAgeInteraction = (isRb * (age - 25)) / 10;
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
    // QB Backup Detector - backup QBs produce stats but market doesn't value them
    const priorPpg = priorSeasonGames > 0 ? priorSeasonFp / priorSeasonGames : 0;
    let qbBackupSignal = 0;
    if (isQb) {
      const isLowPrior = priorPpg < 12 && priorSeasonGames > 0;
      const isLatePickVet = draftRound >= 4 && yearsExp > 1;
      if (isLowPrior || isLatePickVet) {
        qbBackupSignal = 1;
      }
    }

    // Elite Sustain Bonus - elite players maintaining elite production
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
    // Problem: Backup QBs with <10 games are overpredicted by +2000
    let backupQbPenalty = 0;
    if (isQb && games < 10) {
      backupQbPenalty = (10 - games) / 10; // 0-1 scale, higher = more penalty
    }

    // Feature 40: Weekly KTC Momentum
    // Problem: Missing in-season breakouts
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
    // Problem: Missing explosive breakout signals
    let ktcSurgeIndicator = 0;
    if (weeklyKtc && weeklyKtc.length >= 4) {
      let surgeWeeks = 0;
      for (let i = 1; i < weeklyKtc.length; i++) {
        const prevKtc = weeklyKtc[i - 1].ktc;
        const currKtc = weeklyKtc[i].ktc;
        if (prevKtc > 0 && currKtc > prevKtc * 1.05) { // 5% gain
          surgeWeeks++;
        }
      }
      ktcSurgeIndicator = surgeWeeks / Math.max(weeklyKtc.length - 1, 1);
    }

    // Feature 44: Late Season Ratio (normalized)
    // Problem: Missing late-season momentum signal
    const lateSeasonRatio = Math.max(0.5, Math.min(1.5, last4VsSeason));
    const lateSeasonRatioNorm = (lateSeasonRatio - 0.5) / 1.0; // Normalize to 0-1

    // Feature 45: Efficiency Score (Position-Specific)
    // Problem: Volume conflated with quality
    let efficiencyScore = 0.5; // Default neutral
    if (isWr || isTE) {
      efficiencyScore = Math.min(1, yardsPerTarget / 12); // 12 YPT = elite
    } else if (isRb) {
      efficiencyScore = Math.min(1, yardsPerCarry / 5); // 5 YPC = elite
    }

    // Feature 46: Rookie Tier
    // Problem: Single rookie adjustment inadequate
    let rookieTier = 0;
    if (yearsExp === 0) { // True rookie
      if (draftRound <= 2) {
        rookieTier = 1.0; // Elite prospect, expect gains
      } else if (draftRound <= 4) {
        rookieTier = 0.5; // Good prospect
      } else {
        rookieTier = -0.5; // Late pick, less upside
      }
    }

    // ============================================================
    // v8 Features: Validation Analysis Improvements (Feb 2026)
    // Based on deep analysis showing:
    // - Elite (>6000 KTC): -1,567 bias (severe underprediction)
    // - Low games (0-8): +457 bias (severe overestimation)
    // - 20+ PPG: MAE 1,604 (2x worse than 10-15 PPG)
    // ============================================================

    // Feature 47: Low-Games Penalty (ALL POSITIONS)
    // Problem: 0-8 games overpredicted by +457 bias
    let lowGamesPenalty = 0;
    if (games < 10) {
      lowGamesPenalty = ((10 - games) / 10) * 0.5; // 0-0.5 scale
    }

    // Feature 48: Elite Value Anchor
    // Problem: Elite (>6000 KTC) underpredicted by -1,567 bias
    // Counter elite_ceiling_pressure for proven elite performers
    let eliteValueAnchor = 0;
    if (currentKtc >= 6000 && ppg >= 15) {
      eliteValueAnchor = 1.0; // Strong anchor to maintain value
    } else if (currentKtc >= 7000) {
      eliteValueAnchor = 0.5; // Even without high PPG, elite tier is sticky
    }

    // Feature 49: PPG Nonlinearity Signal
    // Problem: 20+ PPG has 2x worse accuracy (MAE 1,604 vs 821 for 10-15 PPG)
    let ppgNonlinearity = 0;
    if (ppg >= 20) {
      ppgNonlinearity = 1.0; // Elite scorer flag
    } else if (ppg >= 15) {
      ppgNonlinearity = (ppg - 15) / 5; // Gradual ramp 0-1
    }

    // Feature 50: Opportunity Increase Signal
    // Problem: Breakouts correlate with opportunity increase
    // Amplified snap trajectory signal
    let opportunityIncrease = 0;
    if (priorSnapPct !== undefined && snapPct > priorSnapPct) {
      opportunityIncrease = Math.min(1.0, (snapPct - priorSnapPct) * 2); // Amplified signal
    }

    // Build feature vector (51 features - v8 with Validation Analysis Improvements)
    return [
      // User inputs (2)
      games / GAMES_MAX, // 0: games normalized
      ppg / 25, // 1: ppg normalized
      // Position one-hot (3 - is_te removed)
      isQb, // 2
      isRb, // 3
      isWr, // 4
      // Demographics (4)
      age / 40, // 5: age normalized
      yearsExp / 15, // 6: experience normalized
      startKtcNorm, // 7: starting KTC normalized
      (8 - draftRound) / 7, // 8: draft capital (higher = better)
      // Historical (3)
      priorSeasonFp / FP_MAX_SEASON, // 9: prior year production
      priorSeasonGames / GAMES_MAX, // 10: prior year availability
      snapPct, // 11: snap percentage (already 0-1)
      // Age decay (2)
      yearsPastCliff, // 12: accelerating post-cliff decline
      ageDecayFactor, // 13: non-linear veteran decay
      // Breakout detection (2)
      rookieWithCapital, // 14: high-capital rookie flag
      priorTrend, // 15: improvement trajectory
      // Position-specific (2)
      rbAgeInteraction, // 16: RB-specific age effect
      qbUpsideInteraction, // 17: QB breakout potential
      // Elite calibration (3 - Phase 1)
      eliteCeilingPressure, // 18: ceiling pressure for high KTC
      eliteAgeRisk, // 19: elite + aging crash risk
      ktcUpsideCap, // 20: room to grow (inverse of KTC)
      // Breakout detection Phase 2 (5)
      snapTrajectory, // 21: change in snap % from prior year
      youngRisingSnap, // 22: young + rising snaps flag
      efficiencyVsSnap, // 23: production efficiency vs opportunity
      teDevelopmentStage, // 24: TE in breakout years (2-4)
      lateSeasonSurge, // 25: momentum from late vs early season
      // Market sentiment (2 - v3)
      ktcMomentum, // 26: KTC trend direction
      marketConfidence, // 27: inverse volatility (stability signal)
      // Efficiency (2 - v3)
      consistencyScore, // 28: inverse of weekly FP variance
      touchesPerGame, // 29: opportunity signal (targets + carries)
      // Analysis insights (4 - v4)
      qbBackupSignal, // 30: backup QB detector
      eliteSustain, // 31: elite players maintaining elite PPG
      sampleConfidence, // 32: confidence based on games played
      ageMarketPenalty, // 33: market ages players faster than perf
      // Weekly/Red Zone insights (4 - v5)
      ktcTrajectory, // 34: in-season KTC change (market reaction)
      redZoneEfficiency, // 35: TD scoring efficiency in red zone
      opportunityShare, // 36: target/rush share (opportunity signal)
      elitePeak, // 37: elite + elite PPG counter-signal
      // TE Elite fix (1 - v6)
      teEliteIndicatorValue, // 38: TE-specific elite indicator
      // v7 Comprehensive Improvements (8)
      backupQbPenalty, // 39: penalize backup QBs with <10 games
      weeklyKtcMomentum, // 40: in-season KTC momentum (late vs early)
      ktcSurgeIndicator, // 41: proportion of weeks with >5% KTC gain
      boomRate, // 42: % of games with boom performance
      bustRate, // 43: % of games with bust performance
      lateSeasonRatioNorm, // 44: late season vs full season FP ratio
      efficiencyScore, // 45: position-specific yards/target or yards/carry
      rookieTier, // 46: differentiate elite vs late-round rookies
      // v8 Validation Analysis Improvements (4)
      lowGamesPenalty, // 47: penalize ALL positions with <10 games
      eliteValueAnchor, // 48: counter elite_ceiling_pressure for proven elite
      ppgNonlinearity, // 49: flag for elite scorers (20+ PPG)
      opportunityIncrease, // 50: amplified snap trajectory for breakouts
    ];
  }

  /**
   * Run forward pass through the neural network
   * v3: 4 hidden layers (128 → 64 → 32 → 16 → output)
   */
  private forward(features: number[]): number {
    if (!this.weights) {
      throw new Error('Model weights not loaded. Call loadWeights() first.');
    }

    // Detect model version based on available weights
    const isV3 = 'fc_out.weight' in this.weights;

    // Layer 1: Linear + BatchNorm + ReLU
    let x = linear(
      features,
      this.weights['fc1.weight'],
      this.weights['fc1.bias']
    );
    x = batchNorm(
      x,
      this.weights['bn1.weight'],
      this.weights['bn1.bias'],
      this.weights['bn1.running_mean'],
      this.weights['bn1.running_var']
    );
    x = relu(x);

    // Layer 2: Linear + BatchNorm + ReLU
    x = linear(x, this.weights['fc2.weight'], this.weights['fc2.bias']);
    x = batchNorm(
      x,
      this.weights['bn2.weight'],
      this.weights['bn2.bias'],
      this.weights['bn2.running_mean'],
      this.weights['bn2.running_var']
    );
    x = relu(x);

    if (isV3) {
      // v3: Layers 3-4 + output
      // Layer 3: Linear + BatchNorm + ReLU
      x = linear(x, this.weights['fc3.weight'], this.weights['fc3.bias']);
      x = batchNorm(
        x,
        this.weights['bn3.weight'],
        this.weights['bn3.bias'],
        this.weights['bn3.running_mean'],
        this.weights['bn3.running_var']
      );
      x = relu(x);

      // Layer 4: Linear + BatchNorm + ReLU
      x = linear(x, this.weights['fc4.weight'], this.weights['fc4.bias']);
      x = batchNorm(
        x,
        this.weights['bn4.weight'],
        this.weights['bn4.bias'],
        this.weights['bn4.running_mean'],
        this.weights['bn4.running_var']
      );
      x = relu(x);

      // Output layer: Linear (no activation)
      x = linear(x, this.weights['fc_out.weight'], this.weights['fc_out.bias']);
    } else {
      // v2: Direct output from layer 2
      x = linear(x, this.weights['fc3.weight'], this.weights['fc3.bias']);
    }

    return x[0];
  }

  /**
   * Predict KTC value for given inputs
   *
   * @param input - Player context and user-adjustable inputs (games, ppg)
   * @returns Predicted KTC value (0-9999)
   */
  predict(input: ProjectionInput): number {
    const features = this.prepareFeatures(input);

    // Debug: Check for NaN in features
    const nanIndex = features.findIndex(f => isNaN(f));
    if (nanIndex !== -1) {
      console.warn(`NaN found in feature at index ${nanIndex}, input:`, input);
      return input.currentKtc;
    }

    const normalizedKtc = this.forward(features);

    // Handle NaN result from forward pass
    if (isNaN(normalizedKtc)) {
      console.warn('NaN result from forward pass, returning current KTC');
      return input.currentKtc;
    }

    const ktc = normalizedKtc * KTC_MAX;
    return Math.max(0, Math.min(KTC_MAX, Math.round(ktc)));
  }

  /**
   * Generate a curve of KTC predictions across different PPG values
   *
   * @param playerContext - Player context (position, age, etc.)
   * @param games - Fixed number of games
   * @param ppgRange - Array of PPG values to evaluate
   * @returns Array of {ppg, ktc} points
   */
  generatePPGCurve(
    playerContext: PlayerContext,
    games: number,
    ppgRange: number[] = [0, 5, 10, 12, 15, 18, 20, 25, 30]
  ): { ppg: number; ktc: number }[] {
    return ppgRange.map((ppg) => ({
      ppg,
      ktc: this.predict({ ...playerContext, games, ppg }),
    }));
  }

  /**
   * Generate a surface of KTC predictions across games and PPG
   *
   * @param playerContext - Player context
   * @param gamesRange - Array of games values
   * @param ppgRange - Array of PPG values
   * @returns 2D array of KTC predictions
   */
  generateSurface(
    playerContext: PlayerContext,
    gamesRange: number[] = [5, 10, 13, 15, 17],
    ppgRange: number[] = [5, 10, 15, 20, 25]
  ): { games: number; ppg: number; ktc: number }[] {
    const surface: { games: number; ppg: number; ktc: number }[] = [];

    for (const games of gamesRange) {
      for (const ppg of ppgRange) {
        surface.push({
          games,
          ppg,
          ktc: this.predict({ ...playerContext, games, ppg }),
        });
      }
    }

    return surface;
  }
}

/**
 * Cache of year-specific model instances
 */
const modelCache: Map<number, KTCProjectionModel> = new Map();

/**
 * Get a projection model for a specific year.
 * Models are cached by year for efficient reuse.
 *
 * @param year - The year to get the model for (2022-2026+)
 * @returns Promise<KTCProjectionModel> - The loaded model
 */
export async function getProjectionModelForYear(
  year: number
): Promise<KTCProjectionModel> {
  // Normalize year to model year
  const modelYear = year >= 2026 ? 2026 : year < 2022 ? 2022 : year;

  // Check cache
  if (modelCache.has(modelYear)) {
    return modelCache.get(modelYear)!;
  }

  // Load new model
  const model = new KTCProjectionModel();
  await model.loadWeightsForYear(modelYear);
  modelCache.set(modelYear, model);

  return model;
}

/**
 * Get the default projection model (latest, trained on all data)
 * @deprecated Use getProjectionModelForYear(2026) for explicit year selection
 */
export async function getProjectionModel(): Promise<KTCProjectionModel> {
  return getProjectionModelForYear(2026);
}
