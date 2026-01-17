import { JSX } from "react";

export type Reject = { message: string; status?: number };

export type NflState = {
  season: number;
  leg: number;
  week: number;
};

export type Allplayer = {
  player_id: string;
  position: string;
  team: string;
  full_name: string;
  first_name: string;
  last_name: string;
  age: number;
  fantasy_positions: string[];
  years_exp: number;
  active: boolean;
};

export type Header = {
  text: JSX.Element;
  colspan: number;
  classname?: string;
  sort?: boolean;
};

export type Row = {
  id: string;
  columns: {
    text: JSX.Element;
    colspan: number;
    className?: string;
    style?: React.CSSProperties;
    sort?: string | number;
  }[];
  search?: {
    text: string;
    display: JSX.Element;
  };
  detail?: JSX.Element;
};

export type Column = {
  key: string;
  value: string;
  setText: (text: string) => void;
};

export type ColumnOption = {
  label: string;
  abbrev: string;
  desc: string;
  key: string;
  className: string;
  style?: (
    value: number,
    min: number,
    max: number,
    avg: number,
    reverse?: boolean
  ) => React.CSSProperties;
};

export type SearchOption = { id: string; text: string; display: JSX.Element };

export type PlayerADP = {
  player_id: string;
  avg_pick: number;
  min_pick: number;
  max_pick: number;
  pick_stddev: number;
  pick_count: number;
  avg_amount: number | null;
  min_amount: number | null;
  max_amount: number | null;
  amount_stddev: number | null;
  amount_count: number;
};

export type ADPFilters = {
  startDate?: string;
  endDate?: string;
  leagueType?: string;
  draftType?: string;
  playerType?: string;
  rosterSlots?: string;
  scoring?: string;
  superflex?: boolean;
};

export type OptimalPlayer = {
  index: number;
  slot__index: string;
  optimal_player_id: string;
  player_position: string;
  value: number;
  playing?: boolean;
  result?: "W" | "L" | "T";
  is_in_progress?: boolean;
};
