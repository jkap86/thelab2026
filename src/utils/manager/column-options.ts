import { ColumnOption } from "@/lib/types/common-types";
import { getTextColor } from "../common/get-text-color";

export type LeagueColumnKey =
  | "optimal_starters_ktc_rank"
  | "optimal_bench_ktc_rank"
  | "optimal_qb_starters_ktc_rank"
  | "optimal_qb_bench_ktc_rank"
  | "optimal_rb_starters_ktc_rank"
  | "optimal_rb_bench_ktc_rank"
  | "optimal_wr_starters_ktc_rank"
  | "optimal_wr_bench_ktc_rank"
  | "optimal_te_starters_ktc_rank"
  | "optimal_te_bench_ktc_rank";

export const leaguesColumnOptions: ColumnOption[] = [
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
      reverse?: boolean
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
      reverse?: boolean
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
      reverse?: boolean
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
      reverse?: boolean
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
      reverse?: boolean
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
      reverse?: boolean
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
      reverse?: boolean
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
      reverse?: boolean
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
      reverse?: boolean
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
      reverse?: boolean
    ) => getTextColor(value, min, max, avg, reverse),
  },
];

export type PlayerColumnKey = "num_own" | "ktc_d";

export const playersColumnOptions: ColumnOption[] = [
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
      reverse?: boolean
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
      reverse?: boolean
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
      reverse?: boolean
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
      reverse?: boolean
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
      reverse?: boolean
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
      reverse?: boolean
    ) => getTextColor(value, min, max, avg, reverse),
  },
];

export type TeamsColumnKey =
  | "optimal_starters_ktc_total"
  | "optimal_bench_ktc_total";

export const teamsColumnOptions: ColumnOption[] = [
  {
    label: "KTC Starters",
    abbrev: "KTC S",
    desc: "KeepTradeCut total optimal starters value",
    key: "optimal_starters_ktc_total",
    className: "font-pulang text-[1.25rem]",
    style: (
      value: number,
      min: number,
      max: number,
      avg: number,
      reverse?: boolean
    ) => getTextColor(value, min, max, avg, reverse),
  },
  {
    label: "KTC Bench",
    abbrev: "KTC B",
    desc: "KeepTradeCut total optimal bench value",
    key: "optimal_bench_ktc_total",
    className: "font-pulang text-[1.25rem]",
    style: (
      value: number,
      min: number,
      max: number,
      avg: number,
      reverse?: boolean
    ) => getTextColor(value, min, max, avg, reverse),
  },
];
