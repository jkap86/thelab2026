const SortIcon = ({
  colNum,
  sortBy,
  setSortBy,
}: {
  colNum: number;
  sortBy: { column: number; direction: "asc" | "desc" };
  setSortBy: (column: number, direction: "asc" | "desc") => void;
}) => {
  return (
    <div
      className={
        sortBy.column === colNum
          ? "text-[var(--color1)] bg-[var(--color9)] !shadow-[inset_0_0_1rem_black] h-full flex justify-center items-center"
          : "text-gray-400"
      }
      onClick={() =>
        setSortBy(
          colNum,
          sortBy.column === colNum
            ? sortBy.direction === "asc"
              ? "desc"
              : sortBy.direction === "desc"
              ? "asc"
              : sortBy.direction
            : sortBy.direction
        )
      }
    >
      {sortBy.direction === "asc" ? (
        <i className="fa-solid fa-caret-up scale-[2]"></i>
      ) : sortBy.direction === "desc" ? (
        <i className="fa-solid fa-caret-down scale-[2]"></i>
      ) : null}
    </div>
  );
};

export default SortIcon;
