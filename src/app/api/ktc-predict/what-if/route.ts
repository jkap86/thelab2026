import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

import {
  predictProjection,
  ProjectionInput,
  getProjectionModelInfo,
} from '../projection-inference';

// ============================================================================
// Types
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
  snap_pct?: number;
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

interface WhatIfResponse {
  playerId: string;
  name: string;
  position: string;
  year: number;
  inputPpg: number;
  inputGames: number;
  predictedEndKtc: number;
  actualEndKtc: number;
  actualPpg: number;
  actualGames: number;
  modelTrainedOn: string;
  startKtc: number;
  error: number;
  actualTotalFp: number;
  inputTotalFp: number;
  age: number;
  yearsExp: number;
}

// ============================================================================
// Cache and Data Loading
// ============================================================================

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
// What-If Prediction Logic
// ============================================================================

/**
 * Run what-if prediction using the projection model.
 * Takes PPG and games directly - much simpler than LSTM approach.
 */
function runWhatIfPrediction(
  player: TrainingPlayer,
  season: TrainingSeason,
  inputPpg: number,
  inputGames: number,
  modelYear: number
): number {
  // Get prior season for context
  const sortedSeasons = [...player.seasons].sort((a, b) => a.year - b.year);
  const seasonIndex = sortedSeasons.findIndex(s => s.year === season.year);
  const priorSeason = seasonIndex > 0 ? sortedSeasons[seasonIndex - 1] : null;

  // Build projection input
  const input: ProjectionInput = {
    position: player.position,
    age: season.age,
    yearsExp: season.years_exp,
    currentKtc: season.start_ktc,
    draftRound: season.draft_round ?? 4,
    priorSeasonFp: priorSeason?.fantasy_points || 0,
    priorSeasonGames: priorSeason?.games_played || 0,
    snapPct: season.snap_pct ?? 0.8,
    games: inputGames,
    ppg: inputPpg,
  };

  return predictProjection(input, modelYear);
}

// ============================================================================
// API Handler
// ============================================================================

/**
 * GET /api/ktc-predict/what-if
 *
 * Historical what-if prediction endpoint.
 *
 * Query params:
 * - playerId: Player ID (required)
 * - year: Historical year (2022-2025, required)
 * - ppg: Fantasy points per game (required)
 * - games: Games played (required)
 *
 * Returns what the rolling-window model would have predicted for the given
 * PPG/games combination, along with what actually happened.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const playerId = searchParams.get('playerId');
  const yearParam = searchParams.get('year');
  const ppgParam = searchParams.get('ppg');
  const gamesParam = searchParams.get('games');

  // Validate required params
  if (!playerId) {
    return NextResponse.json({ error: 'playerId is required' }, { status: 400 });
  }
  if (!yearParam) {
    return NextResponse.json({ error: 'year is required (2022-2025)' }, { status: 400 });
  }
  if (!ppgParam) {
    return NextResponse.json({ error: 'ppg is required' }, { status: 400 });
  }
  if (!gamesParam) {
    return NextResponse.json({ error: 'games is required' }, { status: 400 });
  }

  const year = parseInt(yearParam, 10);
  const ppg = parseFloat(ppgParam);
  const games = parseInt(gamesParam, 10);

  // Validate ranges
  if (year < 2022 || year > 2025) {
    return NextResponse.json({ error: 'year must be between 2022 and 2025' }, { status: 400 });
  }
  if (isNaN(ppg) || ppg < 0 || ppg > 40) {
    return NextResponse.json({ error: 'ppg must be between 0 and 40' }, { status: 400 });
  }
  if (isNaN(games) || games < 0 || games > 17) {
    return NextResponse.json({ error: 'games must be between 0 and 17' }, { status: 400 });
  }

  try {
    // Load training data
    const trainingData = loadTrainingData();
    if (!trainingData) {
      return NextResponse.json({ error: 'Training data not available' }, { status: 500 });
    }

    // Find player in training data
    const player = trainingData.players.find(p => p.player_id === playerId);
    if (!player) {
      return NextResponse.json({ error: 'Player not found in training data' }, { status: 404 });
    }

    // Find the requested season
    const season = player.seasons.find(s => s.year === year);
    if (!season) {
      return NextResponse.json({
        error: `No data for ${player.name} in ${year}`,
        availableYears: player.seasons.map(s => s.year),
      }, { status: 404 });
    }

    // Get model info for this year
    const modelInfo = getProjectionModelInfo(year);

    // Run the what-if prediction
    const predictedEndKtc = runWhatIfPrediction(player, season, ppg, games, year);

    // Calculate actual stats
    const actualTotalFp = season.weekly_stats.reduce((sum, w) => sum + (w.fantasy_points || 0), 0);
    const actualGames = season.weekly_stats.reduce((sum, w) => sum + (w.games_played || 0), 0);
    const actualPpg = actualGames > 0 ? actualTotalFp / actualGames : 0;

    const response: WhatIfResponse = {
      playerId: player.player_id,
      name: player.name,
      position: player.position,
      year,
      inputPpg: ppg,
      inputGames: games,
      predictedEndKtc,
      actualEndKtc: season.end_ktc,
      actualPpg: Math.round(actualPpg * 10) / 10,
      actualGames,
      modelTrainedOn: modelInfo.trainYears,
      startKtc: season.start_ktc,
      error: predictedEndKtc - season.end_ktc,
      actualTotalFp: Math.round(actualTotalFp),
      inputTotalFp: Math.round(ppg * games),
      age: season.age,
      yearsExp: season.years_exp,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('What-if prediction error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
