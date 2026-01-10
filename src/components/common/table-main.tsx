"use client";

import { Header, Row } from "@/lib/types/common-types";
import PageNumbers from "./page-numbers";
import { useEffect, useMemo, useState } from "react";
import SortIcon from "./sort-icon";
import Search from "./search";

const TableMain = ({
  type,
  headers,
  data,
  itemsPerPage,
  sortBy,
  setSortBy,
  half,
  placeholder,
  sendActive,
}: {
  type: number;
  headers: Header[];
  data: Row[];
  itemsPerPage?: number;
  sortBy?: {
    column: number;
    direction: "asc" | "desc";
  };
  setSortBy?: (column: number, direction: "asc" | "desc") => void;
  half?: boolean;
  placeholder?: string;
  sendActive?: (active: string | null) => void;
}) => {
  const [page, setPage] = useState(1);
  const [active, setActive] = useState<string | null>(null);
  const [searched, setSearched] = useState("");

  const pageNumbers = (
    <PageNumbers
      data={data}
      itemsPerPage={itemsPerPage}
      page={page}
      setPage={setPage}
    />
  );

  const body = itemsPerPage
    ? data
        .filter((d) => !searched || d.id === searched)
        .sort((a, b) => {
          if (!sortBy) return 0;

          const aValue = a.columns[sortBy.column].sort!;
          const bValue = b.columns[sortBy.column].sort!;
          if (aValue === bValue) return 0;

          if (sortBy!.direction === "asc") {
            return aValue > bValue ? 1 : -1;
          } else {
            return aValue < bValue ? 1 : -1;
          }
        })
        .slice(
          (page - 1) * itemsPerPage,
          (page - 1) * itemsPerPage + itemsPerPage
        )
    : data
        .filter((d) => !searched || d.id === searched)
        .sort((a, b) => {
          if (!sortBy) return 0;

          const aValue = a.columns[sortBy.column].sort!;
          const bValue = b.columns[sortBy.column].sort!;
          if (aValue === bValue) return 0;

          if (sortBy!.direction === "asc") {
            return aValue > bValue ? 1 : -1;
          } else {
            return aValue < bValue ? 1 : -1;
          }
        });

  useEffect(() => {
    setPage(1);
  }, [sortBy, searched, data.length]);

  useEffect(() => {
    if (sendActive) sendActive(active);
  }, [active, sendActive]);

  return (
    <>
      {data.some((d) => d.search) && (
        <div className="flex justify-center items-center">
          <div className=" m-8 h-[3rem]">
            <Search
              searched={searched}
              setSearched={setSearched}
              options={data
                .filter((d) => d.search)
                .map((d) => ({
                  id: d.id,
                  text: d.search!.text,
                  display: d.search!.display,
                }))}
              placeholder={placeholder ?? ""}
            />
          </div>
        </div>
      )}
      {pageNumbers}
      <table
        className={
          "text-white " +
          (half ? "text-[1.5rem] " : "text-[1.5rem] ") +
          (half ? "inline-table align-top !w-[50%] " : "") +
          (half
            ? type === 2
              ? "sticky top-[10rem] z-7"
              : type === 3
              ? "sticky top-[20rem] z-4"
              : ""
            : "")
        }
      >
        <thead className="">
          {sortBy && setSortBy ? (
            <tr>
              {headers.map((header, headerIndex) => (
                <th
                  key={headerIndex}
                  colSpan={header.colspan}
                  className={
                    "h-[2rem] bg-radial-gray2 text-[1rem] p-0 " +
                    (sortBy.column === headerIndex ? " sort icon " : "")
                  }
                >
                  {header.sort ? (
                    <SortIcon
                      colNum={headerIndex}
                      sortBy={sortBy}
                      setSortBy={(column, direction) =>
                        setSortBy(column, direction)
                      }
                    />
                  ) : null}
                </th>
              ))}
            </tr>
          ) : null}
          <tr
            className={
              "shadow-[0_0_1rem_white] sticky " +
              (type === 1
                ? "top-0 z-10"
                : type === 2
                ? "top-[10rem] z-7"
                : type === 3
                ? "top-[20rem] z-4"
                : "")
            }
          >
            {headers.map((header, headerIndex) => (
              <th
                key={headerIndex}
                colSpan={header.colspan}
                className={
                  (header.classname ?? "") +
                  " h-[5rem] bg-radial-gray2 text-[1rem] p-[.25rem] font-chill" +
                  (sortBy?.column === headerIndex ? "sort" : "")
                }
              >
                {header.text}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.length === 0 ? (
            <tr>
              <td colSpan={headers.reduce((acc, cur) => acc + cur.colspan, 0)}>
                <table className="">
                  <tbody>
                    <tr>
                      <td className={`text-center p-2 bg-radial-table${type}`}>
                        ---
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          ) : (
            body.map((row, rowIndex) => (
              <tr
                key={row.id}
                className={
                  (active === row.id ? "bg-radial-active " : "") +
                  (half && active === row.id
                    ? type === 2
                      ? "sticky top-[15rem] z-6"
                      : type === 3
                      ? "sticky top-[25rem] z-3"
                      : ""
                    : "")
                }
              >
                <td
                  colSpan={row.columns.reduce(
                    (acc, cur) => acc + cur.colspan,
                    0
                  )}
                >
                  <table>
                    <tbody>
                      <tr
                        onClick={() =>
                          (row.detail || sendActive) &&
                          (active === row.id
                            ? setActive(null)
                            : setActive(row.id))
                        }
                      >
                        {row.columns.map((column, columnIndex) => (
                          <td
                            key={rowIndex + "_" + columnIndex}
                            className={
                              (column.className ?? "") +
                              " h-[5rem] p-2 " +
                              (sortBy?.column === columnIndex ? " sort " : "") +
                              (active === row.id
                                ? type === 1
                                  ? "bg-radial-active sticky top-[5rem] z-9"
                                  : type === 2
                                  ? "bg-radial-active sticky top-[15rem] z-6"
                                  : type === 3
                                  ? "bg-radial-active sticky top-[25rem] z-3"
                                  : "bg-radial-active"
                                : `bg-radial-table${type}`)
                            }
                            style={column.style}
                            colSpan={column.colspan}
                          >
                            {column.text.props.children === "INDEX"
                              ? rowIndex + 1
                              : column.text}
                          </td>
                        ))}
                      </tr>
                      {active === row.id && row.detail && (
                        <tr>
                          <td
                            colSpan={row.columns.reduce(
                              (acc, cur) => acc + cur.colspan,
                              0
                            )}
                          >
                            {row.detail}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {pageNumbers}
    </>
  );
};

export default TableMain;
