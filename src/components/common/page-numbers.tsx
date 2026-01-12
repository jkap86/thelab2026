import { Row } from "@/lib/types/common-types";

const PageNumbers = ({
  data,
  itemsPerPage,
  page,
  setPage,
  count,
  fetchMore,
}: {
  data: Row[];
  itemsPerPage?: number;
  page: number;
  setPage: (page: number) => void;
  count?: number;
  fetchMore?: () => void;
}) => {
  if (!itemsPerPage || data.length <= itemsPerPage) return null;

  return (
    <div className="mb-[1rem]">
      <ol className="flex justify-start items-center text-[2rem] text-white max-w-[80%] w-fit m-auto overflow-auto">
        {Array.from(Array(Math.ceil(data.length / itemsPerPage)).keys()).map(
          (i) => (
            <li
              key={i}
              className={
                "px-[1rem] py-[.5rem] bg-[var(--color4)] outline-[.25rem] outline-double m-[0.25rem] font-pulang shadow-[inset_0_0_2rem_silver] " +
                (i + 1 === page
                  ? "outline-[var(--color1)] bg-radial-active "
                  : "outline-transparent")
              }
              onClick={() => setPage(i + 1)}
            >
              {i + 1}
            </li>
          )
        )}
        {count && fetchMore && data.length < count && (
          <li
            className="px-[1rem] py-[.5rem] bg-[var(--color4)] outline-[.25rem] outline-double outline-transparent m-[0.25rem] font-pulang shadow-[inset_0_0_2rem_silver] "
            onClick={fetchMore}
          >
            ...
          </li>
        )}
      </ol>
    </div>
  );
};

export default PageNumbers;
