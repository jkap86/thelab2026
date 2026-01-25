import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

// Load elasticity model config and chart data
const elasticityModelPath = path.resolve(process.cwd(), 'src/app/ktc-predictor/elasticity-model.json');
const chartDataPath = path.resolve(process.cwd(), 'src/app/ktc-predictor/chart-data.json');

// Age cliffs by position (from model config)
const AGE_CLIFFS: Record<string, number> = {
  QB: 35,
  RB: 27,
  WR: 30,
  TE: 30,
};

// KTC tier thresholds
const KTC_TIERS = {
  elite: 6000,
  mid: 3000,
  low: 1000,
};

interface ElasticityModelConfig {
  version: string;
  model_type: string;
  metrics: {
    mae_pct: number;
    r2: number;
  };
  cohort_stats: {
    [key: string]: {
      mean: number;
      std: number;
      min: number;
      max: number;
      n: number;
    };
  };
  age_cliffs: Record<string, number>;
  elasticity_features: string[];
}

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
  seasons: SeasonData[];
}

interface ChartDataOutput {
  players: PlayerChartData[];
  metadata: {
    generatedAt: string;
    totalPlayers: number;
  };
}

// Cached model and data
let cachedModel: ElasticityModelConfig | null = null;
let cachedChartData: ChartDataOutput | null = null;

function loadElasticityModel(): ElasticityModelConfig {
  if (!cachedModel) {
    cachedModel = JSON.parse(fs.readFileSync(elasticityModelPath, 'utf-8'));
  }
  return cachedModel!;
}

function loadChartData(): ChartDataOutput {
  if (!cachedChartData) {
    cachedChartData = JSON.parse(fs.readFileSync(chartDataPath, 'utf-8'));
  }
  return cachedChartData!;
}

// Get age cohort
function getAgeCohort(age: number): 'rookie' | 'prime' | 'veteran' | 'old' {
  if (age <= 23) return 'rookie';
  if (age <= 28) return 'prime';
  if (age <= 32) return 'veteran';
  return 'old';
}

// Get KTC tier
function getKtcTier(ktc: number): 'elite' | 'mid' | 'low' | 'depth' {
  if (ktc >= KTC_TIERS.elite) return 'elite';
  if (ktc >= KTC_TIERS.mid) return 'mid';
  if (ktc >= KTC_TIERS.low) return 'low';
  return 'depth';
}

// Calculate prediction confidence based on player profile
// Based on validation results: Prime-age ~21% MAE, Old ~31% MAE, Depth is unpredictable
function calculateConfidence(
  age: number,
  ktc: number,
  snapPct: number
): { level: 'HIGH' | 'MEDIUM' | 'LOW'; reason: string } {
  const cohort = getAgeCohort(age);
  const tier = getKtcTier(ktc);
  const isBackup = snapPct < 0.5;

  // LOW confidence scenarios (validation showed highest MAE)
  if (cohort === 'old') {
    return { level: 'LOW', reason: 'Old players have highest prediction variance' };
  }
  if (tier === 'depth') {
    return { level: 'LOW', reason: 'Depth players can have unpredictable breakouts' };
  }
  if (isBackup && cohort === 'rookie') {
    return { level: 'LOW', reason: 'Rookie backups have high variance' };
  }

  // HIGH confidence scenarios (validation showed lowest MAE)
  if (cohort === 'prime' && (tier === 'elite' || tier === 'mid') && !isBackup) {
    return { level: 'HIGH', reason: 'Prime-age starter with established value' };
  }
  if (cohort === 'prime' && tier === 'low' && !isBackup) {
    return { level: 'HIGH', reason: 'Prime-age player with stable role' };
  }

  // MEDIUM confidence (everything else)
  if (cohort === 'rookie') {
    return { level: 'MEDIUM', reason: 'Rookies have upside but limited track record' };
  }
  if (cohort === 'veteran') {
    return { level: 'MEDIUM', reason: 'Veterans approaching age cliff' };
  }

  return { level: 'MEDIUM', reason: 'Standard prediction confidence' };
}

// Calculate prediction range based on confidence
// Based on validation: HIGH ~±10%, MEDIUM ~±20%, LOW ~±40%
function calculatePredictionRange(
  pctChange: number,
  confidence: 'HIGH' | 'MEDIUM' | 'LOW',
  tier: 'elite' | 'mid' | 'low' | 'depth'
): { low: number; high: number } {
  let rangeWidth: number;
  switch (confidence) {
    case 'HIGH':
      rangeWidth = 0.10; // ±10%
      break;
    case 'MEDIUM':
      rangeWidth = 0.20; // ±20%
      break;
    case 'LOW':
      // Asymmetric for depth (higher upside uncertainty)
      if (tier === 'depth') {
        return {
          low: pctChange - 0.30,
          high: Math.min(pctChange + 1.50, 2.0), // Cap at +200% on high end
        };
      }
      rangeWidth = 0.40; // ±40%
      break;
  }

  return {
    low: pctChange - rangeWidth,
    high: pctChange + rangeWidth,
  };
}

// Cap predictions for depth players (can't reliably predict breakouts)
const DEPTH_CAP = 1.50; // +150% max for depth players
function capPrediction(
  pctChange: number,
  ktc: number
): { capped: number; wasCapped: boolean } {
  const tier = getKtcTier(ktc);
  if (tier === 'depth' && pctChange > DEPTH_CAP) {
    return { capped: DEPTH_CAP, wasCapped: true };
  }
  return { capped: pctChange, wasCapped: false };
}

// Calculate baseline FP from player's historical seasons
function calculateBaselineFP(player: PlayerChartData): number {
  if (player.seasons.length === 0) return 0;
  const totalFP = player.seasons.reduce((sum, s) => sum + s.fantasyPoints, 0);
  const totalGames = player.seasons.reduce((sum, s) => sum + s.gamesPlayed, 0);
  const avgFpPerGame = totalGames > 0 ? totalFP / totalGames : 0;
  return avgFpPerGame * 17;
}

// Calculate elasticity score based on player characteristics
function calculateElasticityScore(
  age: number,
  position: string,
  ktc: number,
  snapPct: number
): number {
  const cliffAge = AGE_CLIFFS[position] || 30;
  const tier = getKtcTier(ktc);

  // Age factor: young and old players are more elastic
  let ageFactor = 0;
  if (age <= 23) {
    ageFactor = 0.8; // Rookies - high upside elasticity
  } else if (age <= 28) {
    ageFactor = 0.4; // Prime - moderate elasticity
  } else if (age <= 32) {
    ageFactor = 0.5; // Veterans - some elasticity
  } else {
    ageFactor = 0.9; // Old - very high (mostly downside) elasticity
  }

  // Tier factor: depth players are more elastic than elite
  let tierFactor = 0;
  switch (tier) {
    case 'depth': tierFactor = 0.9; break;
    case 'low': tierFactor = 0.6; break;
    case 'mid': tierFactor = 0.4; break;
    case 'elite': tierFactor = 0.3; break;
  }

  // Snap factor: backups are more elastic
  const snapFactor = snapPct < 0.5 ? 0.7 : 0.3;

  // Position factor: RBs are most elastic
  let positionFactor = 0.5;
  if (position === 'RB') positionFactor = 0.8;
  else if (position === 'WR') positionFactor = 0.6;
  else if (position === 'TE') positionFactor = 0.5;
  else if (position === 'QB') positionFactor = 0.4;

  // Combine factors (weighted average)
  const score = (
    ageFactor * 0.35 +
    tierFactor * 0.25 +
    snapFactor * 0.15 +
    positionFactor * 0.25
  );

  return Math.round(score * 100) / 100;
}

// Predict % change for a given scenario
function predictPctChange(
  player: PlayerChartData,
  model: ElasticityModelConfig,
  fpChangePct: number, // e.g., 0.2 for +20%, -0.2 for -20%
  gamesPlayed: number = 17
): number {
  const age = player.currentAge;
  const cohort = getAgeCohort(age);
  const cohortStats = model.cohort_stats[cohort];
  const cliffAge = AGE_CLIFFS[player.position] || 30;

  // Base prediction from cohort mean
  let basePct = cohortStats.mean;

  // Adjust for FP change direction and magnitude
  // Historical data shows:
  // - FP improving >15%: avg +36.2% KTC change
  // - FP declining >15%: avg -11.5% KTC change
  // - Stable: avg +3.4% KTC change

  if (fpChangePct > 0.15) {
    // Improving FP - use amplified positive change
    // Age cohort modifiers (from analysis):
    // Rookie: +21%, Prime: +36%, Veteran: +51%, Old: +71%
    const ageMultiplier =
      cohort === 'rookie' ? 0.21 / 0.36 :
      cohort === 'prime' ? 1.0 :
      cohort === 'veteran' ? 1.4 :
      1.95; // old

    basePct = 0.36 * (fpChangePct / 0.15) * ageMultiplier;
  } else if (fpChangePct < -0.15) {
    // Declining FP - age amplifies negative change
    // Rookie: -12%, Prime: -9%, Veteran: -16%, Old: -29%
    const ageMultiplier =
      cohort === 'rookie' ? 1.33 :
      cohort === 'prime' ? 1.0 :
      cohort === 'veteran' ? 1.7 :
      3.1; // old

    basePct = -0.09 * (Math.abs(fpChangePct) / 0.15) * ageMultiplier;
  } else {
    // Stable performance - slight regression toward mean for tier
    const tier = getKtcTier(player.latestKtc);
    basePct =
      tier === 'elite' ? -0.05 : // Elite regresses down
      tier === 'mid' ? -0.04 :
      tier === 'low' ? 0.09 :
      0.53; // depth can pop
  }

  // Adjust for games played (injury impact)
  if (gamesPlayed < 8) {
    // Major injury - amplifies negative impact
    const injuryPenalty = (8 - gamesPlayed) / 8 * 0.15;
    basePct -= injuryPenalty;

    // Old players crash harder on injury
    if (age > cliffAge) {
      basePct -= injuryPenalty * 0.5;
    }
  }

  return Math.round(basePct * 1000) / 1000;
}

// API Handler
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const playerId = searchParams.get('playerId');
  const comparePlayerId = searchParams.get('comparePlayerId');

  if (!playerId) {
    return NextResponse.json({ error: 'playerId is required' }, { status: 400 });
  }

  try {
    const model = loadElasticityModel();
    const chartData = loadChartData();

    const player = chartData.players.find(p => p.playerId === playerId);
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const baselineFP = calculateBaselineFP(player);
    const cohort = getAgeCohort(player.currentAge);
    const cohortStats = model.cohort_stats[cohort];
    const tier = getKtcTier(player.latestKtc);
    const cliffAge = AGE_CLIFFS[player.position] || 30;

    // Calculate elasticity score
    const elasticityScore = calculateElasticityScore(
      player.currentAge,
      player.position,
      player.latestKtc,
      player.historicalSnapPct || 0.8
    );

    // Calculate confidence
    const confidence = calculateConfidence(
      player.currentAge,
      player.latestKtc,
      player.historicalSnapPct || 0.8
    );

    // Scenario predictions (with capping for depth players)
    const rawScenarios = {
      ifBreakout: predictPctChange(player, model, 0.30, 17),
      ifMildImprovement: predictPctChange(player, model, 0.15, 17),
      ifStable: predictPctChange(player, model, 0, 17),
      ifMildDecline: predictPctChange(player, model, -0.15, 17),
      ifDecline: predictPctChange(player, model, -0.30, 17),
      ifInjury: predictPctChange(player, model, -0.20, 6),
    };

    // Apply capping and calculate ranges
    const buildScenario = (rawPct: number) => {
      const { capped, wasCapped } = capPrediction(rawPct, player.latestKtc);
      const range = calculatePredictionRange(capped, confidence.level, tier);
      return {
        pctChange: capped,
        predictedKtc: Math.round(player.latestKtc * (1 + capped)),
        range: {
          low: Math.round(range.low * 100) / 100,
          high: Math.round(range.high * 100) / 100,
          lowKtc: Math.round(player.latestKtc * (1 + range.low)),
          highKtc: Math.round(player.latestKtc * (1 + range.high)),
        },
        wasCapped,
      };
    };

    const scenariosWithKtc = {
      ifBreakout: buildScenario(rawScenarios.ifBreakout),
      ifMildImprovement: buildScenario(rawScenarios.ifMildImprovement),
      ifStable: buildScenario(rawScenarios.ifStable),
      ifMildDecline: buildScenario(rawScenarios.ifMildDecline),
      ifDecline: buildScenario(rawScenarios.ifDecline),
      ifInjury: buildScenario(rawScenarios.ifInjury),
    };

    // Keep simple scenarios for comparison calculations
    const scenarios = {
      ifBreakout: scenariosWithKtc.ifBreakout.pctChange,
      ifMildImprovement: scenariosWithKtc.ifMildImprovement.pctChange,
      ifStable: scenariosWithKtc.ifStable.pctChange,
      ifMildDecline: scenariosWithKtc.ifMildDecline.pctChange,
      ifDecline: scenariosWithKtc.ifDecline.pctChange,
      ifInjury: scenariosWithKtc.ifInjury.pctChange,
    };

    // Elasticity factors breakdown
    const elasticityFactors = {
      ageElasticity: player.currentAge > cliffAge
        ? (player.currentAge - cliffAge) / 5
        : player.currentAge <= 23
          ? 0.8
          : 0.3,
      tierElasticity: tier === 'depth' ? 0.9 : tier === 'low' ? 0.6 : tier === 'mid' ? 0.4 : 0.3,
      positionElasticity: player.position === 'RB' ? 0.8 : player.position === 'WR' ? 0.6 : 0.5,
      snapElasticity: (1 - (player.historicalSnapPct || 0.8)),
    };

    // Build response
    const response: Record<string, unknown> = {
      playerId: player.playerId,
      playerName: player.name,
      position: player.position,
      currentAge: player.currentAge,
      currentKtc: player.latestKtc,
      yearsExp: player.yearsExp,

      // Cohort info
      cohort,
      cohortStats: {
        avgPctChange: cohortStats.mean,
        stdPctChange: cohortStats.std,
        sampleSize: cohortStats.n,
      },
      tier,
      cliffAge,
      yearsTillCliff: Math.max(0, cliffAge - player.currentAge),

      // Core elasticity metrics
      elasticityScore,
      elasticityLabel:
        elasticityScore >= 0.7 ? 'Very High' :
        elasticityScore >= 0.5 ? 'High' :
        elasticityScore >= 0.35 ? 'Moderate' :
        'Stable',

      // Prediction confidence (based on validation results)
      confidence: {
        level: confidence.level,
        reason: confidence.reason,
      },

      // Breakdown
      elasticityFactors,

      // Scenario predictions
      scenarios: scenariosWithKtc,

      // Comparison context
      comparison: {
        vsAgeAvg: elasticityScore - (cohort === 'old' ? 0.7 : cohort === 'rookie' ? 0.6 : 0.45),
        vsPositionAvg: elasticityScore - (player.position === 'RB' ? 0.6 : 0.5),
      },

      // Model info
      modelInfo: {
        version: model.version,
        mae: model.metrics.mae_pct,
        r2: model.metrics.r2,
      },
    };

    // Handle comparison player
    if (comparePlayerId) {
      const comparePlayer = chartData.players.find(p => p.playerId === comparePlayerId);
      if (comparePlayer) {
        const compareElasticityScore = calculateElasticityScore(
          comparePlayer.currentAge,
          comparePlayer.position,
          comparePlayer.latestKtc,
          comparePlayer.historicalSnapPct || 0.8
        );

        const compareScenarios = {
          ifBreakout: predictPctChange(comparePlayer, model, 0.30, 17),
          ifDecline: predictPctChange(comparePlayer, model, -0.30, 17),
          ifInjury: predictPctChange(comparePlayer, model, -0.20, 6),
        };

        response.comparison = {
          ...response.comparison as Record<string, number>,
          player: {
            name: player.name,
            elasticityScore,
            ifDecline: scenarios.ifDecline,
            ifInjury: scenarios.ifInjury,
          },
          comparePlayer: {
            playerId: comparePlayer.playerId,
            name: comparePlayer.name,
            position: comparePlayer.position,
            age: comparePlayer.currentAge,
            ktc: comparePlayer.latestKtc,
            elasticityScore: compareElasticityScore,
            cohort: getAgeCohort(comparePlayer.currentAge),
            ifDecline: compareScenarios.ifDecline,
            ifInjury: compareScenarios.ifInjury,
          },
          downsideRatio:
            scenarios.ifDecline !== 0
              ? Math.abs(compareScenarios.ifDecline / scenarios.ifDecline)
              : 1,
          injuryRatio:
            scenarios.ifInjury !== 0
              ? Math.abs(compareScenarios.ifInjury / scenarios.ifInjury)
              : 1,
        };
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in ktc-elasticity API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
