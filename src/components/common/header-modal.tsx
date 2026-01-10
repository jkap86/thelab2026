import Modal from "./modal";
import { useEffect, useState } from "react";
import { Column, ColumnOption } from "@/lib/types/common-types";

const HeaderModal = ({
  options,
  columns,
  isOpen,
  setIsOpen,
}: {
  options: ColumnOption[];
  columns: Column[];
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}) => {
  const [activeColumnKey, setActiveColumnKey] = useState("");

  const activeColumn = columns.find((col) => col.key === activeColumnKey);
  const activeOption = options.find(
    (opt) => opt.abbrev === activeColumn?.value
  );

  useEffect(() => {
    if (isOpen && !columns.some((col) => col.key === activeColumnKey)) {
      setActiveColumnKey(columns[0].key);
    }
  }, [isOpen, columns, activeColumnKey]);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
        }}
      >
        <>
          <div className="text-center text-[1.5rem] font-black font-score">
            Columns
          </div>
          <div className="flex justify-evenly items-center text-[1.5rem] font-chill ">
            {columns.map((col, index) => (
              <div
                key={`${col.key}-${index}`}
                onClick={() => setActiveColumnKey(col.key)}
                className={
                  "bg-radial-gray w-full text-center py-4 px-2 whitespace-nowrap outline-solid outline-black outline-[.1rem] " +
                  (activeColumnKey === col.key ? "bg-radial-active" : "")
                }
              >
                {col.value}
              </div>
            ))}
          </div>

          <div className="max-h-[50%] w-[50%] text-[1.25rem] mx-auto my-[2rem] overflow-auto rounded font-chill ">
            <ul>
              {options.map((option) => (
                <li
                  key={option.label}
                  className={
                    "flex items-center justify-center p-[.75rem] " +
                    (activeColumn?.value === option.abbrev
                      ? "bg-radial-active sticky top-0 bottom-0"
                      : "bg-radial-gray")
                  }
                  onClick={() => activeColumn?.setText(option.abbrev)}
                >
                  {option.abbrev}
                </li>
              ))}
            </ul>
          </div>

          <div className="text-center">
            <strong>{activeOption?.label}</strong>
            <p className="w-fit m-auto">{activeOption?.desc}</p>
          </div>
        </>
      </Modal>
    </>
  );
};

export default HeaderModal;
