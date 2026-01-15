import { SearchOption } from "@/lib/types/common-types";
import { useEffect, useMemo, useRef, useState } from "react";
import { FixedSizeList as List } from "react-window";

const ROW_HEIGHT = 50;
const MAX_MENU_HEIGHT = 260;

const Search = ({
  searched,
  setSearched,
  options,
  placeholder,
  disabled,
}: {
  searched: string;
  setSearched: (searched: string) => void;
  options: SearchOption[];
  placeholder: string;
  disabled?: boolean;
}) => {
  const searchRef = useRef<HTMLDivElement>(null);
  const [searchText, setSearchText] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (input: string) => {
    const match = options.find(
      (x) => x.text.trim().toLowerCase() === input.trim().toLowerCase()
    );

    if (input.trim() === "") {
      setSearchText("");
      setSearched("");
      setIsOpen(false);
    } else if (match) {
      setSearchText(match.text);
      setSearched(match.id);
      setIsOpen(false);
    } else {
      setSearchText(input);
      setIsOpen(true);
    }
  };

  const formatSearch = (text: string) => {
    return text
      .replace(/[^a-zA-Z0-9.$]/g, "")
      .toLowerCase()
      .trim();
  };

  const searchOptions = useMemo(() => {
    const filteredOptions: SearchOption[] = options
      .filter((option) =>
        formatSearch(option.text).includes(formatSearch(searchText))
      )
      .sort((a, b) => {
        const getTextMinIndex = (text: string) => {
          return Math.min(
            ...text
              .split(" ")
              .map((word) =>
                formatSearch(word).indexOf(formatSearch(searchText))
              )
              .filter((index) => index !== -1)
          );
        };

        return (
          getTextMinIndex(a.text) - getTextMinIndex(b.text) ||
          (formatSearch(a.text) > formatSearch(b.text) ? 1 : -1)
        );
      });

    return filteredOptions;
  }, [searchText, options]);

  const buttonClassName =
    "w-[10%] h-full absolute right-[0%]  text-[2rem] flex justify-center items-center z-13 ";

  return (
    <div
      className={
        "flex flex-col justify-center items-center w-full h-full relative shadow-[0_0_1.5rem_white] " +
        (disabled ? " opacity-[.5]" : "")
      }
      ref={searchRef}
    >
      <div className="relative h-full w-full flex justify-center items-center">
        <input
          className={
            "text-black text-[2rem] bg-[var(--color1)] text-center " +
            "outline-double outline-[var(--color3)] outline-[.5rem] rounded " +
            "shadow-[inset_0_0_2.5rem_black] placeholder:opacity-50 relative z-13   text-overflow "
          }
          type="text"
          value={searchText}
          onChange={(e) => !disabled && handleSearch(e.target.value)}
          placeholder={placeholder}
          autoFocus={false}
        />
        {((isOpen || searchText) && (
          <button
            className={buttonClassName + " bg-red-600"}
            onClick={() => handleSearch("")}
          >
            {"\u2716\uFE0E"}
          </button>
        )) || (
          <button
            className={buttonClassName}
            onClick={() => !disabled && setIsOpen(true)}
          >
            <i className="fa-solid fa-caret-down"></i>
          </button>
        )}
      </div>

      {isOpen && (
        <List
          className="bg-[var(--color5)] outline-double outline-[var(--color3)] outline-[.5rem] my-[.5rem] !absolute top-full z-14 shadow-[0_0_1.5rem_white] w-full rounded "
          height={MAX_MENU_HEIGHT}
          itemCount={searchOptions.length}
          itemSize={ROW_HEIGHT}
          width="100%"
          itemData={searchOptions}
          innerElementType="ul"
          itemKey={(i: number, data: SearchOption[]) => data[i].id}
          overscanCount={5}
        >
          {({ index, style, data }) => {
            const option = searchOptions[index];

            return (
              <li
                key={`${option.id}`}
                style={style}
                onClick={() => handleSearch(data[index].text)}
                className="shadow-[inset_0_0_2rem_black] text-[1.5rem] text-overflow px-2 flex items-center hover:bg-[var(--color3)] cursor-pointer list-none h-full font-score text-[1.75rem]"
              >
                {data[index].display}
              </li>
            );
          }}
        </List>
      )}
    </div>
  );
};

export default Search;
