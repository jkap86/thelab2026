import { DraftPick } from "@/lib/types/manager-types";

export const getDraftPickId = (draftPick: DraftPick) => {
  const order =
    draftPick.order &&
    draftPick.order.toLocaleString("en-US", {
      minimumIntegerDigits: 2,
    });

  return `${draftPick.season} ${draftPick.round}.${order}`;
};

export const getDraftPickDisplayText = (
  pickId: string,
  originalUsername?: string
) => {
  let displayText = pickId;

  if (pickId.endsWith(".undefined")) {
    const pickArray = pickId.split(" ");

    const season = pickArray[0];
    const round = pickArray[1].split(".")[0];

    displayText =
      `${season} Round ${round}` +
      (originalUsername ? ` (${originalUsername})` : "");
  }

  return displayText;
};

const getSuffix = (round: number) => {
  switch (round) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
};

export const getDraftPickKtcName = (pickId: string) => {
  const pickArray = pickId.split(" ");

  const season = pickArray[0];
  const round = parseInt(pickArray[1].split(".")[0]);
  const order = parseInt(pickArray[1].split(".")[1]) ?? 6;

  let type = "Mid";
  if (order <= 4) {
    type = "Early";
  } else if (order >= 9) {
    type = "Late";
  }

  return `${season} ${type} ${round + getSuffix(round)}`;
};
