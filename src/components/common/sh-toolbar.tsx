import Link from "next/link";

export default function SHToolbar() {
  const nav_items = [
    {
      text: "South Harmon Home",
      link: "https://www.southharmonff.com/",
    },
    {
      text: "ADP",
      link: "https://www.southharmonff.com/adp",
    },
    {
      text: "WoRP",
      link: "https://www.southharmonff.com/worp",
    },
    {
      text: "Patreon",
      link: "https://www.patreon.com/SouthHarmon",
    },
    {
      text: "Articles",
      link: "https://www.southharmonff.com/articles",
    },
    {
      text: "Dynasty MindWoRPed",
      link: "https://www.southharmonff.com/mindworped",
    },
    {
      text: "Store",
      link: "https://www.southharmonff.com/store",
    },
    {
      text: "Team Reviews",
      link: "https://www.southharmonff.com/team-reviews",
    },
  ];

  return (
    <div className="flex justify-evenly flex-wrap bg-black text-white shadow-[0_0_1rem_white]">
      {nav_items.map((item) => (
        <Link
          key={item.text}
          rel="noreferrer"
          target={item.link.includes("southharmonff.com") ? "_self" : "_blank"}
          href={item.link}
          className="py-2 px-4 text-[1.25rem] font-bold hover:text-[var(--color1)]"
        >
          {item.text}
        </Link>
      ))}
    </div>
  );
}
