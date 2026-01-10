import { SleeperLeagueSettings } from "./sleeper-types";

type Roster = {
  roster_id: number;
  username: string;
  user_id: string;
  avatar: string | null;
  players: string[];
};

type League = {
  league_id: string;
  name: string;
  avatar: string | null;
  roster_positions: string[];
  scoring_settings: { [key: string]: number };
  settings: SleeperLeagueSettings;
};

export type Trade = {
  transaction_id: string;
  status_updated: number;
  adds: { [key: string]: string };
  drops: { [key: string]: string };
  draft_picks: {
    season: string;
    round: number;
    order: number | undefined;
    original: string;
    old: string;
    new: string;
  }[];
  league: League;
  rosters: Roster[];
  league_id: string;
  tips?: {
    for: { league_id: string; leaguemate_id: string; player_id: string }[];
    away: { league_id: string; leaguemate_id: string; player_id: string }[];
  };
};
