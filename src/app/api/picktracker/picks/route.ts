import { NextRequest, NextResponse } from "next/server";
import axiosInstance from "@/lib/axios-instance";
import {
  SleeperDraft,
  SleeperDraftDraftPick,
  SleeperUser,
} from "@/lib/types/sleeper-types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const league_id = searchParams.get("league_id");

  if (!league_id)
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });

  try {
    const drafts: { data: SleeperDraft[] } = await axiosInstance.get(
      `https://api.sleeper.app/v1/league/${league_id}/drafts`
    );

    const activeDraft = drafts.data.find((d) => d.settings.slots_k > 0);

    if (!activeDraft) {
      return NextResponse.json(
        { error: "No draft set with Kicker slot" },
        { status: 400 }
      );
    }

    const [users, draftPicks] = await Promise.all([
      axiosInstance.get(`https://api.sleeper.app/v1/league/${league_id}/users`),
      axiosInstance.get(
        `https://api.sleeper.app/v1/draft/${activeDraft.draft_id}/picks`
      ),
    ]);

    const teamsCount = Object.keys(activeDraft.draft_order).length;

    const picks = draftPicks.data
      .filter((pick: SleeperDraftDraftPick) => pick.metadata.position === "K")
      .map((pick: SleeperDraftDraftPick, index: number) => ({
        pick:
          Math.floor(index / teamsCount) +
          1 +
          "." +
          ((index % teamsCount) + 1).toLocaleString("en-US", {
            minimumIntegerDigits: 2,
          }),
        player_name: pick.metadata.first_name + " " + pick.metadata.last_name,
        player_id: pick.player_id,
        picked_by: users.data.find(
          (u: SleeperUser) => u.user_id === pick.picked_by
        )?.display_name,
        picked_by_avatar: users.data.find(
          (u: SleeperUser) => u.user_id === pick.picked_by
        )?.avatar,
      }));

    const nextPick =
      Math.floor(picks.length / teamsCount) +
      1 +
      "." +
      ((picks.length % teamsCount) + 1).toLocaleString("en-US", {
        minimumIntegerDigits: 2,
      });

    return NextResponse.json({ picks, nextPick }, { status: 200 });
  } catch (err: unknown) {
    return NextResponse.json({ error: "Unkown Error", err }, { status: 400 });
  }
}
