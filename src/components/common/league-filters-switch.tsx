const LeagueFiltersSwitch = ({
  type1,
  type2,
  setType1,
  setType2,
}: {
  type1: "Redraft" | "All" | "Dynasty";
  type2: "Bestball" | "All" | "Lineup";
  setType1: (value: "Redraft" | "All" | "Dynasty") => void;
  setType2: (value: "Bestball" | "All" | "Lineup") => void;
}) => {
  const getSwitch = (
    type: "Redraft" | "Bestball" | "Dynasty" | "Lineup" | "All",
    option1: "Redraft" | "Bestball",
    option2: "Dynasty" | "Lineup",
    setType: (
      value: "Redraft" | "Bestball" | "Dynasty" | "Lineup" | "All"
    ) => void
  ) => {
    return (
      <div className="rounded-[1rem] bg-radial-gray overflow-hidden outline-[var(--color3)] p-[.1rem] outline-[.1rem] outline-double relative z-1">
        {[option1, "All", option2].map((option) => (
          <button
            key={option}
            onClick={() =>
              setType(
                option as "Redraft" | "Bestball" | "Dynasty" | "Lineup" | "All"
              )
            }
            className={
              "text-[2rem] text-gray-400 font-chill p-2 text-center rounded-[1rem] relative z-10  font-black " +
              (option === "All" ? "w-[4rem]" : "w-[8rem]") +
              " " +
              (type === option
                ? "text-white bg-[var(--color3)] outline-double outline-[var(--color1)] outline-[.1rem] shadow-[0_0_1rem_white] shadow-[inset_0_0_3rem_var(--color2)]"
                : "")
            }
          >
            {option}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="flex justify-evenly items-center">
      {getSwitch(type1, "Redraft", "Dynasty", (value) =>
        setType1(value as "Redraft" | "All" | "Dynasty")
      )}
      {getSwitch(type2, "Bestball", "Lineup", (value) =>
        setType2(value as "Bestball" | "All" | "Lineup")
      )}
    </div>
  );
};

export default LeagueFiltersSwitch;
