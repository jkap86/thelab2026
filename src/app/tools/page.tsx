import LoadingIcon from "@/components/common/loading-icon";
import Link from "next/link";

export default function Tools() {
  const links = [
    { href: "/manager", text: "Manager" },
    { href: "/picktracker", text: "Pick Tracker" },
    { href: "/trades", text: "Trades" },
    { href: "/playoffs", text: "Playoffs Scoring" },
  ];

  return (
    <main className="relative h-full w-full">
      <div className="absolute h-full w-full flex items-center justify-center z-0 p-8">
        <div className="drop-shadow-[0_0_5rem_white] opacity-[0.25]">
          <LoadingIcon />
        </div>
      </div>
      <div className="flex flex-col items-center justify-center h-full w-full relative z-1 text-shadow-lg ">
        <div>
          <h1 className="text-[5rem] font-metal font-black text-[var(--color1)] ![text-shadow:0_0_1rem_red]">
            The Lab
          </h1>
        </div>
        <nav className="flex flex-col flex-1 justify-evenly items-center">
          {links.map((link) => {
            return (
              <Link
                key={link.href}
                href={link.href}
                className="font-pulang text-[2.5rem] text-[var(--color7)] text-shadow-sm hover:text-[var(--color1)]"
              >
                {link.text}
              </Link>
            );
          })}
        </nav>
      </div>
    </main>
  );
}
