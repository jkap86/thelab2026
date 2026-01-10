const PlayersFilters = ({
  filter,
  setFilter,
  options,
  label,
}: {
  filter: string;
  setFilter: (value: string) => void;
  options: string[];
  label: string;
}) => {
  return (
    <div
      className={
        "flex flex-col items-center bg-[var(--color11)] p-[.25rem] rounded-[1rem] " +
        "outline-double outline-[.25rem] outline-gray-400 shadow-[inset_0_0_2rem_black]"
      }
    >
      <label className="font-metal font-black text-[var(--color7)]">
        {label}
      </label>
      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="font-score font-black w-full text-center"
      >
        {options.map((option) => (
          <option key={option} value={option} className="bg-black">
            {option}
          </option>
        ))}
      </select>
    </div>
  );
};

export default PlayersFilters;
