import { ColumnOption } from "@/lib/types/common-types";
import { getTextColor } from "../common/get-text-color";

export const leaguesColumnOptions = [
  {
    label: "KTC Starters Rank",
    abbrev: "KTC S Rk",
    desc: "KeepTradeCut total optimal starters value rank.",
    key: "optimal_starters_ktc_rank",
    className: "font-pulang text-[2.5rem]",
    style: (
      value: number,
      min: number,
      max: number,
      avg: number,
      reverse?: boolean,
    ) => getTextColor(value, min, max, avg, reverse),
  },
  {
    label: "KTC Bench Rank",
    abbrev: "KTC B Rk",
    desc: "KeepTradeCut total optimal bench value rank.",
    key: "optimal_bench_ktc_rank",
    className: "font-pulang text-[2.5rem]",
    style: (
      value: number,
      min: number,
      max: number,
      avg: number,
      reverse?: boolean,
    ) => getTextColor(value, min, max, avg, reverse),
  },
  {
    label: "KTC QB Starters Rank",
    abbrev: "KTC QB S Rk",
    desc: "KeepTradeCut total optimal qb starters value rank",
    key: "optimal_qb_starters_ktc_rank",
    className: "font-pulang text-[2.5rem]",
    style: (
      value: number,
      min: number,
      max: number,
      avg: number,
      reverse?: boolean,
    ) => getTextColor(value, min, max, avg, reverse),
  },
  {
    label: "KTC QB Bench Rank",
    abbrev: "KTC QB B Rk",
    desc: "KeepTradeCut total optimal qb bench value rank",
    key: "optimal_qb_bench_ktc_rank",
    className: "font-pulang text-[2.5rem]",
    style: (
      value: number,
      min: number,
      max: number,
      avg: number,
      reverse?: boolean,
    ) => getTextColor(value, min, max, avg, reverse),
  },
  {
    label: "KTC RB Starters Rank",
    abbrev: "KTC RB S Rk",
    desc: "KeepTradeCut total optimal rb starters value rank",
    key: "optimal_rb_starters_ktc_rank",
    className: "font-pulang text-[2.5rem]",
    style: (
      value: number,
      min: number,
      max: number,
      avg: number,
      reverse?: boolean,
    ) => getTextColor(value, min, max, avg, reverse),
  },
  {
    label: "KTC RB Bench Rank",
    abbrev: "KTC RB B Rk",
    desc: "KeepTradeCut total optimal rb bench value rank",
    key: "optimal_rb_bench_ktc_rank",
    className: "font-pulang text-[2.5rem]",
    style: (
      value: number,
      min: number,
      max: number,
      avg: number,
      reverse?: boolean,
    ) => getTextColor(value, min, max, avg, reverse),
  },
  {
    label: "KTC WR Starters Rank",
    abbrev: "KTC WR S Rk",
    desc: "KeepTradeCut total optimal wr starters value rank",
    key: "optimal_wr_starters_ktc_rank",
    className: "font-pulang text-[2.5rem]",
    style: (
      value: number,
      min: number,
      max: number,
      avg: number,
      reverse?: boolean,
    ) => getTextColor(value, min, max, avg, reverse),
  },
  {
    label: "KTC WR Bench Rank",
    abbrev: "KTC WR B Rk",
    desc: "KeepTradeCut total optimal wr bench value rank",
    key: "optimal_wr_bench_ktc_rank",
    className: "font-pulang text-[2.5rem]",
    style: (
      value: number,
      min: number,
      max: number,
      avg: number,
      reverse?: boolean,
    ) => getTextColor(value, min, max, avg, reverse),
  },
  {
    label: "KTC TE Starters Rank",
    abbrev: "KTC TE S Rk",
    desc: "KeepTradeCut total optimal te starters value rank",
    key: "optimal_te_starters_ktc_rank",
    className: "font-pulang text-[2.5rem]",
    style: (
      value: number,
      min: number,
      max: number,
      avg: number,
      reverse?: boolean,
    ) => getTextColor(value, min, max, avg, reverse),
  },
  {
    label: "KTC TE Bench Rank",
    abbrev: "KTC TE B Rk",
    desc: "KeepTradeCut total optimal te bench value rank",
    key: "optimal_te_bench_ktc_rank",
    className: "font-pulang text-[2.5rem]",
    style: (
      value: number,
      min: number,
      max: number,
      avg: number,
      reverse?: boolean,
    ) => getTextColor(value, min, max, avg, reverse),
  },
] as const satisfies readonly ColumnOption[];

export const LEAGUE_COLUMN_KEYS = leaguesColumnOptions.map((o) => o.key);

export type LeagueColumnKey = (typeof LEAGUE_COLUMN_KEYS)[number];

export const playersColumnOptions = [
  {
    label: "Number of Shares Owned",
    abbrev: "# Own",
    desc: "",
    key: "num_own",
    className: "font-metal text-[2.5rem]",
    style: (
      value: number,
      min: number,
      max: number,
      avg: number,
      reverse?: boolean,
    ) => getTextColor(value, min, max, avg, reverse),
  },
  {
    label: "KTC Dynasty Value",
    abbrev: "KTC D",
    desc: "KeepTradeCut Dynasty Value",
    key: "ktc_d",
    className: "font-pulang text-[2.25rem]",
    style: (
      value: number,
      min: number,
      max: number,
      avg: number,
      reverse?: boolean,
    ) => getTextColor(value, min, max, avg, reverse),
  },
  {
    label: "Age",
    abbrev: "Age",
    desc: "Player age",
    key: "age",
    className: "font-pulang text-[2.5rem]",
    style: (
      value: number,
      min: number,
      max: number,
      avg: number,
      reverse?: boolean,
    ) => getTextColor(value, min, max, avg, reverse),
  },
  {
    label: "Draft Class",
    abbrev: "Draft Class",
    desc: "The year player was drafted.",
    key: "draft_class",
    className: "font-pulang text-[2.25rem]",
    style: (
      value: number,
      min: number,
      max: number,
      avg: number,
      reverse?: boolean,
    ) => getTextColor(value, min, max, avg, reverse),
  },
  {
    label: "ADP Dynasty",
    abbrev: "ADP D",
    desc: "Average Draft Position Dynasty",
    key: "adp_d",
    className: "font-pulang text-[2.25rem]",
    style: (
      value: number,
      min: number,
      max: number,
      avg: number,
      reverse?: boolean,
    ) => getTextColor(value, min, max, avg, reverse),
  },
  {
    label: "ADP Redraft",
    abbrev: "ADP R",
    desc: "Average Draft Position Redraft",
    key: "adp_r",
    className: "font-pulang text-[2.25rem]",
    style: (
      value: number,
      min: number,
      max: number,
      avg: number,
      reverse?: boolean,
    ) => getTextColor(value, min, max, avg, reverse),
  },
  {
    label: "Auction Budget Percentage Dynasty",
    abbrev: "Budget % D",
    desc: "Avg percentage of total auction budget spent on player in dynasty leagues.",
    key: "auction_budget_percentage_d",
    className: "font-pulang text-[2.25rem]",
    style: (
      value: number,
      min: number,
      max: number,
      avg: number,
      reverse?: boolean,
    ) => getTextColor(value, min, max, avg, reverse),
  },
] as const satisfies readonly ColumnOption[];

export const PLAYER_COLUMN_KEYS = playersColumnOptions.map((o) => o.key);

export type PlayerColumnKey = (typeof PLAYER_COLUMN_KEYS)[number];

export type LeaguemateColumnKey = "num_common";

export const leaguemateColumnOptions = [
  {
    label: "Number of Common Leagues",
    abbrev: "# Common",
    desc: "Number of leagues both are in",
    key: "num_common",
    className: "font-metal text-[2.5rem]",
    style: (
      value: number,
      min: number,
      max: number,
      avg: number,
      reverse?: boolean,
    ) => getTextColor(value, min, max, avg, reverse),
  },
  ...leaguesColumnOptions.flatMap((option) => [
    {
      ...option,
      abbrev: "Avg " + option.abbrev,
      label: "Average " + option.label,
      desc: "Average " + option.desc,
      key: "avg_" + option.key,
    },
    {
      ...option,
      abbrev: "Lm Avg " + option.abbrev,
      label: "Leaguemate Average " + option.label,
      desc: "Leaguemate Average " + option.desc,
      key: "lm_avg_" + option.key,
    },
    {
      ...option,
      abbrev: "Avg " + option.abbrev + " \u0394",
      label: "Average " + option.label + " Delta",
      desc: "Average difference in " + option.desc,
      key: "avg_delta_" + option.key,
    },
  ]),
];

export const leaguemateLeaguesColumnOptions = [
  ...leaguesColumnOptions,
  ...leaguesColumnOptions.map((option) => ({
    ...option,
    label: "Leaguemate " + option.label,
    abbrev: "Lm " + option.abbrev,
    desc: "Leaguemate " + option.desc,
    key: "lm_" + option.key,
  })),
] as const satisfies readonly ColumnOption[];

export const LEAGUEMATE_LEAGUES_COLUMN_KEYS =
  leaguemateLeaguesColumnOptions.map((o) => o.key);

export type LeaguemateLeaguesColumnKey =
  (typeof LEAGUEMATE_LEAGUES_COLUMN_KEYS)[number];

export type TeamsColumnKey =
  | "optimal_starters_ktc_total"
  | "optimal_bench_ktc_total";

export const teamsColumnOptions: ColumnOption[] = [
  {
    label: "KTC Starters",
    abbrev: "KTC S",
    desc: "KeepTradeCut total optimal starters value",
    key: "optimal_starters_ktc_total",
    className: "font-pulang text-[1.5rem]",
    style: (
      value: number,
      min: number,
      max: number,
      avg: number,
      reverse?: boolean,
    ) => getTextColor(value, min, max, avg, reverse),
  },
  {
    label: "KTC Bench",
    abbrev: "KTC B",
    desc: "KeepTradeCut total optimal bench value",
    key: "optimal_bench_ktc_total",
    className: "font-pulang text-[1.5rem]",
    style: (
      value: number,
      min: number,
      max: number,
      avg: number,
      reverse?: boolean,
    ) => getTextColor(value, min, max, avg, reverse),
  },
];
