/**
 * KTC Ensemble Predictor
 *
 * Combines Neural Network and XGBoost predictions using tier-specific weights.
 * The ensemble approach leverages the strengths of each model:
 * - XGBoost: Better for elite tier players (0.7 weight)
 * - NN: Better for low tier players and interactive projections (0.6 weight)
 *
 * Also provides uncertainty estimates based on model disagreement.
 */

import { KTCProjectionModel, type PlayerContext, type ProjectionInput } from './ktc-projection';

// Tier thresholds (matching validation tier definitions)
export const TIER_THRESHOLDS = {
  elite: 8000,   // 8000+ KTC
  tier1: 6000,   // 6000-8000 KTC
  tier2: 4000,   // 4000-6000 KTC
  mid: 2000,     // 2000-4000 KTC
  low: 0,        // 0-2000 KTC
} as const;

// Tier-specific weights based on validation performance
// XGBoost MAE: 221, NN MAE: 380 overall
// But performance varies by tier - XGBoost dominates elite, NN is competitive on low tier
const TIER_WEIGHTS: Record<string, { nn: number; xgb: number }> = {
  elite: { nn: 0.3, xgb: 0.7 },  // XGBoost much better for elite (R2 0.50 vs poor NN)
  tier1: { nn: 0.4, xgb: 0.6 },  // XGBoost still better
  tier2: { nn: 0.5, xgb: 0.5 },  // Roughly equal
  mid:   { nn: 0.5, xgb: 0.5 },  // Roughly equal
  low:   { nn: 0.6, xgb: 0.4 },  // NN slightly better (R2 0.83)
};

// Confidence levels based on model agreement
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface EnsemblePrediction {
  /** Final ensemble prediction (weighted average) */
  prediction: number;
  /** Neural network prediction */
  nnPrediction: number;
  /** XGBoost prediction (if available) */
  xgbPrediction: number | null;
  /** Weights used for this tier */
  weights: { nn: number; xgb: number };
  /** Player's tier based on current KTC */
  tier: string;
  /** Confidence level based on model agreement */
  confidence: ConfidenceLevel;
  /** Prediction range based on confidence */
  predictionRange: { low: number; high: number };
  /** Model disagreement (absolute difference) */
  disagreement: number;
}

/**
 * Determine tier based on current KTC value
 */
export function getTier(ktc: number): string {
  if (ktc >= TIER_THRESHOLDS.elite) return 'elite';
  if (ktc >= TIER_THRESHOLDS.tier1) return 'tier1';
  if (ktc >= TIER_THRESHOLDS.tier2) return 'tier2';
  if (ktc >= TIER_THRESHOLDS.mid) return 'mid';
  return 'low';
}

/**
 * Determine confidence level based on model disagreement
 * Disagreement is expressed as a percentage of the average prediction
 */
function getConfidenceFromDisagreement(disagreement: number, avgPrediction: number): ConfidenceLevel {
  if (avgPrediction <= 0) return 'low';

  const disagreementPct = (disagreement / avgPrediction) * 100;

  if (disagreementPct <= 10) return 'high';   // Models agree within 10%
  if (disagreementPct <= 25) return 'medium'; // Models agree within 25%
  return 'low';                                // Models disagree significantly
}

/**
 * Get prediction range based on confidence level
 */
function getPredictionRange(
  prediction: number,
  confidence: ConfidenceLevel,
  tier: string
): { low: number; high: number } {
  // Base ranges by confidence
  const rangeMultipliers = {
    high: 0.10,   // ±10%
    medium: 0.20, // ±20%
    low: 0.35,    // ±35%
  };

  // Tier adjustments (elite has more downside risk)
  const tierAdjustments: Record<string, { lowMult: number; highMult: number }> = {
    elite: { lowMult: 1.3, highMult: 0.8 },   // More downside risk for elite
    tier1: { lowMult: 1.2, highMult: 0.9 },
    tier2: { lowMult: 1.0, highMult: 1.0 },
    mid:   { lowMult: 1.0, highMult: 1.0 },
    low:   { lowMult: 0.8, highMult: 1.5 },   // More upside potential for low tier
  };

  const baseRange = rangeMultipliers[confidence];
  const adjustment = tierAdjustments[tier] || { lowMult: 1.0, highMult: 1.0 };

  const lowRange = prediction * (1 - baseRange * adjustment.lowMult);
  const highRange = prediction * (1 + baseRange * adjustment.highMult);

  return {
    low: Math.max(0, Math.round(lowRange)),
    high: Math.min(9999, Math.round(highRange)),
  };
}

export class KTCEnsemblePredictor {
  private nnModel: KTCProjectionModel | null = null;
  private xgbPredictFn: ((input: ProjectionInput) => number) | null = null;

  /**
   * Initialize with the NN projection model
   * XGBoost can be optionally set via setXGBoostPredictor
   */
  async initialize(): Promise<void> {
    this.nnModel = new KTCProjectionModel();
    await this.nnModel.loadWeights();
  }

  /**
   * Set a custom XGBoost prediction function
   * This allows the caller to provide their own XGBoost integration
   */
  setXGBoostPredictor(predictFn: (input: ProjectionInput) => number): void {
    this.xgbPredictFn = predictFn;
  }

  /**
   * Get ensemble prediction for a player
   */
  predict(input: ProjectionInput): EnsemblePrediction {
    if (!this.nnModel) {
      throw new Error('Ensemble predictor not initialized. Call initialize() first.');
    }

    // Get NN prediction
    const nnPrediction = this.nnModel.predict(input);

    // Get tier and weights
    const tier = getTier(input.currentKtc);
    const weights = TIER_WEIGHTS[tier] || { nn: 0.5, xgb: 0.5 };

    // Get XGBoost prediction if available
    let xgbPrediction: number | null = null;
    let ensemblePrediction: number;
    let disagreement: number;

    if (this.xgbPredictFn) {
      xgbPrediction = this.xgbPredictFn(input);
      ensemblePrediction = Math.round(
        weights.nn * nnPrediction + weights.xgb * xgbPrediction
      );
      disagreement = Math.abs(nnPrediction - xgbPrediction);
    } else {
      // Fall back to NN-only prediction
      ensemblePrediction = nnPrediction;
      disagreement = 0;
    }

    // Determine confidence based on model agreement
    const avgPrediction = xgbPrediction !== null
      ? (nnPrediction + xgbPrediction) / 2
      : nnPrediction;
    const confidence = getConfidenceFromDisagreement(disagreement, avgPrediction);

    // Get prediction range
    const predictionRange = getPredictionRange(ensemblePrediction, confidence, tier);

    return {
      prediction: ensemblePrediction,
      nnPrediction,
      xgbPrediction,
      weights,
      tier,
      confidence,
      predictionRange,
      disagreement,
    };
  }

  /**
   * Generate ensemble PPG curve (like NN's generatePPGCurve but with ensemble predictions)
   */
  generatePPGCurve(
    playerContext: PlayerContext,
    games: number,
    ppgRange: number[] = [0, 5, 10, 12, 15, 18, 20, 25, 30]
  ): { ppg: number; prediction: EnsemblePrediction }[] {
    return ppgRange.map((ppg) => ({
      ppg,
      prediction: this.predict({ ...playerContext, games, ppg }),
    }));
  }

  /**
   * Compare NN vs XGBoost predictions for analysis
   */
  compareModels(input: ProjectionInput): {
    nn: number;
    xgb: number | null;
    difference: number;
    percentDifference: number;
    recommendation: string;
  } {
    const result = this.predict(input);
    const avg = result.xgbPrediction !== null
      ? (result.nnPrediction + result.xgbPrediction) / 2
      : result.nnPrediction;

    const percentDiff = result.xgbPrediction !== null
      ? (result.disagreement / avg) * 100
      : 0;

    let recommendation: string;
    if (percentDiff <= 5) {
      recommendation = 'Models strongly agree - high confidence prediction';
    } else if (percentDiff <= 15) {
      recommendation = 'Models moderately agree - reasonable confidence';
    } else if (percentDiff <= 30) {
      recommendation = 'Models disagree - consider additional context';
    } else {
      recommendation = 'Models significantly disagree - prediction highly uncertain';
    }

    return {
      nn: result.nnPrediction,
      xgb: result.xgbPrediction,
      difference: result.disagreement,
      percentDifference: percentDiff,
      recommendation,
    };
  }
}

/**
 * Singleton instance for easy use
 */
let _ensembleInstance: KTCEnsemblePredictor | null = null;

export async function getEnsemblePredictor(): Promise<KTCEnsemblePredictor> {
  if (!_ensembleInstance) {
    _ensembleInstance = new KTCEnsemblePredictor();
    await _ensembleInstance.initialize();
  }
  return _ensembleInstance;
}
