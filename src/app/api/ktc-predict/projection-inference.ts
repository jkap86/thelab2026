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

// Model weights structure
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
  'fc3.weight': number[][];
  'fc3.bias': number[];
  config: {
    input_size: number;
    hidden1: number;
    hidden2: number;
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
}

// Cache for year-specific model weights
const weightsCache: Record<number, ModelWeights | null> = {};

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

  if (weightsCache[modelYear] !== undefined) {
    return weightsCache[modelYear];
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
 * Prepare input features from player context (18 features - Experiment 1)
 *
 * Removed features (7 redundant):
 * - is_te: derivable from other position flags
 * - years_from_peak: redundant with age
 * - years_before_peak: perfect inverse of years_from_peak
 * - rb_games_interaction: redundant with base games
 * - rb_ppg_interaction: redundant with base ppg
 * - is_elite: arbitrary threshold on start_ktc
 * - games_premium: binary threshold loses continuous signal
 */
function prepareFeatures(input: ProjectionInput): number[] {
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

  // === Breakout Detection Features ===
  const isRookie = yearsExp <= 1 ? 1 : 0;
  const highDraftCapital = draftRound <= 2 ? 1 : 0;
  const rookieWithCapital = isRookie * highDraftCapital;
  const priorTrend = priorPriorFp > 0 ? (priorSeasonFp - priorPriorFp) / FP_MAX_SEASON : 0;

  // === Position-Specific Interaction Features ===
  const rbAgeInteraction = isRb * (age - 25) / 10;
  const qbUpsideInteraction = isQb * yearsBeforePeak;

  // Build feature vector (18 features - Experiment 1)
  return [
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
    currentKtc / KTC_MAX,                 // 7: starting KTC normalized
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
  ];
}

/**
 * Run forward pass through the neural network
 */
function forward(features: number[], weights: ModelWeights): number {
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

  // Output layer: Linear (no activation)
  x = linear(x, weights['fc3.weight'], weights['fc3.bias']);

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
  const weights = loadWeights(year);
  if (!weights) {
    console.warn(`No projection weights available for year ${year}, returning current KTC`);
    return input.currentKtc;
  }

  const features = prepareFeatures(input);
  const normalizedKtc = forward(features, weights);
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
