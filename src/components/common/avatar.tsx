import userAvatar from "../../../public/images/user_avatar.jpeg";
import leagueAvatar from "../../../public/images/league_avatar.png";
import playerAvatar from "../../../public/images/player_avatar.png";
import React from "react";
import Image from "next/image";

const Avatar = ({
  avatar_id,
  type,
  name,
  centered,
}: {
  avatar_id: string | null;
  type: "user" | "league" | "player";
  name: string;
  centered?: boolean;
}) => {
  let alt, src, onerror;

  if (type === "user") {
    alt = "User Avatar";
    src = `https://sleepercdn.com/avatars/${avatar_id}`;
    onerror = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      e.currentTarget.src = userAvatar.src;
    };
  } else if (type === "league") {
    alt = "League Avatar";
    src = `https://sleepercdn.com/avatars/${avatar_id}`;
    onerror = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      e.currentTarget.src = leagueAvatar.src;
    };
  } else if (type === "player") {
    alt = "Player Avatar";
    src = `https://sleepercdn.com/content/nfl/players/thumb/${avatar_id}.jpg`;
    onerror = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      e.currentTarget.src = playerAvatar.src;
    };
  }

  return (
    alt &&
    src && (
      <div
        className={
          "flex items-center relative h-full " +
          (centered ? "justify-center" : "")
        }
      >
        <Image
          alt={alt}
          src={src}
          className="rounded-full shadow-[0_0_1rem_white] h-full w-auto absolute z-1 opacity-30"
          onError={onerror}
          width={1}
          height={1}
          unoptimized
        />
        <span
          className={
            "text-[inherit] whitespace-nowrap font-[inherit] relative z-2 text-overflow w-full" +
            (centered ? " text-center" : "")
          }
        >
          {name}
        </span>
      </div>
    )
  );
};

export default Avatar;
