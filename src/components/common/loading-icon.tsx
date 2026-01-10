"use client";

import Image from "next/image";
import LoadingFlask from "../../../public/images/loading_flask.png";
import Bubble from "../../../public/images/bubble1.png";
import { useEffect, useState } from "react";

interface BubbleConfig {
  translate: string;
  zIndex: number;
  animationDelay: string;
  animationDuration: string;
}

export default function LoadingIcon() {
  const [bubbleConfigs, setBubbleConfigs] = useState<BubbleConfig[]>([]);

  useEffect(() => {
    const bubbles = Array.from(Array(25).keys()).map((key) => {
      return {
        translate: `translate(${(key % 2 === 0 ? -1 : 1) + 5}dvmin, ${
          key + 15
        }dvmin, ${key + 5}dvmin)`,
        zIndex: 25 - key,
        animationDelay: `${key / 10}s`,
        animationDuration: `${Math.max(key / 5, 3)}s`,
      };
    });

    setBubbleConfigs(bubbles);
  }, []);

  return (
    <div className="relative flex flex-1 m-auto">
      <Image src={LoadingFlask} alt="Loading Flask" />
      {bubbleConfigs.map((config, index) => (
        <Image
          key={index}
          src={Bubble}
          alt="bubble"
          className={
            "absolute bottom-[25%] left-[5%] right-0 m-auto opacity-70"
          }
          style={{
            transform: config.translate,
            zIndex: config.zIndex,
            animationDelay: config.animationDelay,
            animationDuration: config.animationDuration,
            width: "2rem",
            animationTimingFunction: "ease-in-out",
            animationIterationCount: "infinite",
            animationName: index % 2 === 0 ? "bubble1" : "bubble2",
            animationFillMode:
              index % 2 === 0
                ? "forwards"
                : index % 3 == 0
                ? "backwards"
                : "reverse",
          }}
        />
      ))}
    </div>
  );
}
