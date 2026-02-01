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
}

export interface ProjectionInput extends PlayerContext {
  games: number; // User-adjustable: 0-17
  ppg: number; // User-adjustable: 0-30
}

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
   * Prepare input features from player context and user inputs (18 features - Experiment 1)
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
    const priorTrend =
      priorPriorFp > 0 ? (priorSeasonFp - priorPriorFp) / FP_MAX_SEASON : 0;

    // === Position-Specific Interaction Features ===
    const rbAgeInteraction = (isRb * (age - 25)) / 10;
    const qbUpsideInteraction = isQb * yearsBeforePeak;

    // Build feature vector (18 features - Experiment 1)
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
      currentKtc / KTC_MAX, // 7: starting KTC normalized
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
    ];
  }

  /**
   * Run forward pass through the neural network
   */
  private forward(features: number[]): number {
    if (!this.weights) {
      throw new Error('Model weights not loaded. Call loadWeights() first.');
    }

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

    // Output layer: Linear (no activation)
    x = linear(x, this.weights['fc3.weight'], this.weights['fc3.bias']);

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
    const normalizedKtc = this.forward(features);
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
