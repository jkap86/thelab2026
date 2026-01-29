/**
 * LSTM Inference in TypeScript
 *
 * This module implements LSTM forward pass using exported PyTorch weights.
 * Used for KTC prediction based on weekly time-series data.
 */

import * as fs from 'fs';
import * as path from 'path';

// Constants
const KTC_MAX_VALUE = 9999;
const FP_MAX_WEEKLY = 40;
const FP_MAX_SEASON = 500;
const SEQUENCE_LENGTH = 18;

// Model configuration
interface LSTMConfig {
  seq_features: number;
  static_features: number;
  hidden_size: number;
  num_layers: number;
  sequence_length: number;
}

// Model weights structure
interface LSTMWeights {
  config: LSTMConfig;
  weights: {
    'lstm.weight_ih_l0': number[][];
    'lstm.weight_hh_l0': number[][];
    'lstm.bias_ih_l0': number[];
    'lstm.bias_hh_l0': number[];
    'lstm.weight_ih_l1': number[][];
    'lstm.weight_hh_l1': number[][];
    'lstm.bias_ih_l1': number[];
    'lstm.bias_hh_l1': number[];
    'fc1.weight': number[][];
    'fc1.bias': number[];
    'fc2.weight': number[][];
    'fc2.bias': number[];
    'fc3.weight': number[][];
    'fc3.bias': number[];
  };
}

// Weekly data input
export interface WeeklyKtcData {
  week: number;
  ktc: number;
  date?: string;
}

export interface WeeklyStatsData {
  week: number;
  fantasy_points: number;
  games_played: number;
  snap_pct: number;
}

// Player data for prediction
export interface LSTMPlayerInput {
  position: string;
  age: number;
  years_exp: number;
  start_ktc: number;
  draft_round: number | null;
  weekly_ktc: WeeklyKtcData[];
  weekly_stats: WeeklyStatsData[];
}

// Matrix/vector operations
function matmul(mat: number[][], vec: number[]): number[] {
  return mat.map(row => row.reduce((sum, val, i) => sum + val * vec[i], 0));
}

function add(a: number[], b: number[]): number[] {
  return a.map((v, i) => v + b[i]);
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function tanh(x: number): number {
  return Math.tanh(x);
}

function relu(x: number): number {
  return Math.max(0, x);
}

// LSTM cell forward pass
function lstmCell(
  input: number[],
  h_prev: number[],
  c_prev: number[],
  weight_ih: number[][],
  weight_hh: number[][],
  bias_ih: number[],
  bias_hh: number[]
): { h: number[]; c: number[] } {
  const hiddenSize = h_prev.length;

  // gates = input @ W_ih.T + bias_ih + h_prev @ W_hh.T + bias_hh
  const gates_ih = matmul(weight_ih, input);
  const gates_hh = matmul(weight_hh, h_prev);
  const gates = add(add(add(gates_ih, bias_ih), gates_hh), bias_hh);

  // Split into 4 gates: input, forget, cell, output
  const i_gate: number[] = [];
  const f_gate: number[] = [];
  const g_gate: number[] = [];
  const o_gate: number[] = [];

  for (let i = 0; i < hiddenSize; i++) {
    i_gate.push(sigmoid(gates[i]));
    f_gate.push(sigmoid(gates[hiddenSize + i]));
    g_gate.push(tanh(gates[2 * hiddenSize + i]));
    o_gate.push(sigmoid(gates[3 * hiddenSize + i]));
  }

  // c_new = f * c_prev + i * g
  const c_new = c_prev.map((c, i) => f_gate[i] * c + i_gate[i] * g_gate[i]);

  // h_new = o * tanh(c_new)
  const h_new = c_new.map((c, i) => o_gate[i] * tanh(c));

  return { h: h_new, c: c_new };
}

// Dense layer forward pass
function denseLayer(input: number[], weight: number[][], bias: number[], activation: 'relu' | 'sigmoid' | 'none' = 'none'): number[] {
  const output = add(matmul(weight, input), bias);
  if (activation === 'relu') {
    return output.map(relu);
  } else if (activation === 'sigmoid') {
    return output.map(sigmoid);
  }
  return output;
}

// Load model weights
let cachedWeights: LSTMWeights | null = null;

function loadWeights(): LSTMWeights {
  if (cachedWeights) return cachedWeights;

  const weightsPath = path.resolve(process.cwd(), 'src/app/api/ktc-predict/lstm-2025-weights.json');
  const data = fs.readFileSync(weightsPath, 'utf-8');
  cachedWeights = JSON.parse(data) as LSTMWeights;
  return cachedWeights;
}

// Prepare input sequence from player data
function prepareSequence(player: LSTMPlayerInput): { sequence: number[][]; static_features: number[] } {
  const sequence: number[][] = [];

  // Build week-to-stats mapping
  const statsByWeek: Record<number, WeeklyStatsData> = {};
  for (const ws of player.weekly_stats) {
    statsByWeek[ws.week] = ws;
  }

  let cumulativeFp = 0;
  let cumulativeGames = 0;
  let priorKtc = player.start_ktc || 1;

  for (let w = 0; w < SEQUENCE_LENGTH; w++) {
    const wkKtcData = player.weekly_ktc[w] || { ktc: priorKtc };
    const weekNum = w + 1;
    const wkStats = statsByWeek[weekNum] || { fantasy_points: 0, games_played: 0, snap_pct: 0 };

    const wkKtc = wkKtcData.ktc || priorKtc;
    const wkFp = wkStats.fantasy_points || 0;
    const wkGames = wkStats.games_played || 0;
    const wkSnap = wkStats.snap_pct || 0;

    cumulativeFp += wkFp;
    cumulativeGames += wkGames;
    const ktcChange = (wkKtc - priorKtc) / KTC_MAX_VALUE;

    sequence.push([
      wkKtc / KTC_MAX_VALUE,           // ktc_normalized
      ktcChange,                        // ktc_change
      wkFp / FP_MAX_WEEKLY,            // fp_normalized
      cumulativeFp / FP_MAX_SEASON,    // cumulative_fp
      wkGames,                          // games (0 or 1)
      wkSnap,                           // snap_pct
      cumulativeGames / 17,            // games_normalized
      (w + 1) / SEQUENCE_LENGTH,       // week_normalized
    ]);

    priorKtc = wkKtc;
  }

  // Static features
  const posOneHot = [
    player.position === 'QB' ? 1 : 0,
    player.position === 'RB' ? 1 : 0,
    player.position === 'WR' ? 1 : 0,
    player.position === 'TE' ? 1 : 0,
  ];

  const static_features = [
    ...posOneHot,
    player.age / 40,
    player.years_exp / 20,
    player.start_ktc / KTC_MAX_VALUE,
    (player.draft_round || 7) / 7,
  ];

  return { sequence, static_features };
}

// Full LSTM forward pass
export function predictLSTM(player: LSTMPlayerInput): number {
  const weights = loadWeights();
  const { sequence, static_features } = prepareSequence(player);

  const hiddenSize = weights.config.hidden_size;

  // Initialize hidden states for both layers
  let h0 = new Array(hiddenSize).fill(0);
  let c0 = new Array(hiddenSize).fill(0);
  let h1 = new Array(hiddenSize).fill(0);
  let c1 = new Array(hiddenSize).fill(0);

  // Process sequence through LSTM layers
  for (let t = 0; t < SEQUENCE_LENGTH; t++) {
    const input = sequence[t];

    // Layer 0
    const layer0 = lstmCell(
      input,
      h0,
      c0,
      weights.weights['lstm.weight_ih_l0'],
      weights.weights['lstm.weight_hh_l0'],
      weights.weights['lstm.bias_ih_l0'],
      weights.weights['lstm.bias_hh_l0']
    );
    h0 = layer0.h;
    c0 = layer0.c;

    // Layer 1 (takes h0 as input)
    const layer1 = lstmCell(
      h0,
      h1,
      c1,
      weights.weights['lstm.weight_ih_l1'],
      weights.weights['lstm.weight_hh_l1'],
      weights.weights['lstm.bias_ih_l1'],
      weights.weights['lstm.bias_hh_l1']
    );
    h1 = layer1.h;
    c1 = layer1.c;
  }

  // Concatenate final hidden state with static features
  const combined = [...h1, ...static_features];

  // Dense layers
  let x = denseLayer(combined, weights.weights['fc1.weight'], weights.weights['fc1.bias'], 'relu');
  x = denseLayer(x, weights.weights['fc2.weight'], weights.weights['fc2.bias'], 'relu');
  x = denseLayer(x, weights.weights['fc3.weight'], weights.weights['fc3.bias'], 'sigmoid');

  // Convert normalized output to KTC
  const predictedEndKtc = Math.round(x[0] * KTC_MAX_VALUE);
  return Math.min(Math.max(predictedEndKtc, 0), KTC_MAX_VALUE);
}

// Check if player has sufficient weekly data for LSTM prediction
export function hasWeeklyData(player: LSTMPlayerInput): boolean {
  return (
    player.weekly_ktc &&
    player.weekly_ktc.length >= SEQUENCE_LENGTH &&
    player.weekly_stats &&
    player.weekly_stats.length >= 1
  );
}
