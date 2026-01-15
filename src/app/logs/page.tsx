"use client";

import TableMain from "@/components/common/table-main";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import "./logs.css";
import Link from "next/link";
import Search from "@/components/common/search";

type LogDb = {
  ip: string;
  route: string;
  created_at: string;
};

type Log = {
  ip: string;
  route: string;
  created_at: string;
  tool: string;
  username: string;
  league_id: string;
  tab: string;
};

const LogsPage = () => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [ip, setIp] = useState("");
  const [tool, setTool] = useState("");
  const [username, setUsername] = useState("");
  const [league_id, setLeague_id] = useState("");
  const [tab, setTab] = useState("");

  useEffect(() => {
    const fetchLogs = async () => {
      const logs: { data: LogDb[] } = await axios.get("/api/common/logs/fetch");

      setLogs(
        logs.data.map((l) => {
          const route_array = l.route.split("/");

          const tool = route_array[1].toLowerCase();

          let username = "";
          let league_id = "";
          let tab = "";

          if (["manager", "lineupchecker"].includes(tool) && route_array[2]) {
            username = route_array[2].toLowerCase();

            if (route_array[3]) {
              tab = route_array[3].toLowerCase();
            }
          } else if (tool === "picktracker") {
            league_id = route_array[2];
          }

          return {
            ...l,
            tool,
            username,
            league_id,
            tab,
          };
        })
      );
    };
    fetchLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      return (
        (tool === "" || l.tool === tool) &&
        (ip === "" || l.ip === ip) &&
        (username === "" || l.username === username) &&
        (league_id === "" || l.league_id === league_id) &&
        (tab === "" || l.tab === tab)
      );
    });
  }, [logs, ip, tool, username, league_id, tab]);

  const { tools, usernames, league_ids, tabs, ips } = useMemo(() => {
    const tools: string[] = [];
    const usernames: string[] = [];
    const league_ids: string[] = [];
    const tabs: string[] = [];
    const ips: string[] = [];

    filteredLogs.forEach((log) => {
      if (!tools.includes(log.tool)) tools.push(log.tool);

      if (log.username && !usernames.includes(log.username))
        usernames.push(log.username);

      if (log.league_id && !league_ids.includes(log.league_id))
        league_ids.push(log.league_id);

      if (log.tab && !tabs.includes(log.tab)) tabs.push(log.tab);

      if (!ips.includes(log.ip)) ips.push(log.ip);
    });

    return { tools, usernames, league_ids, tabs, ips };
  }, [filteredLogs]);

  const filters = [
    {
      label: "IP Address",
      id: "ip",
      list: ips,
      state: ip,
      setState: setIp,
    },
    {
      label: "Tool",
      id: "tools",
      list: tools,
      state: tool,
      setState: setTool,
    },
    {
      label: "Username",
      id: "username",
      list: usernames,
      state: username,
      setState: setUsername,
    },
    {
      label: "League Id",
      id: "league_id",
      list: league_ids,
      state: league_id,
      setState: setLeague_id,
    },
    {
      label: "Tab",
      id: "manager_tab",
      list: tabs,
      state: tab,
      setState: setTab,
    },
  ];

  const totals = [
    {
      label: "Entries",
      array: filteredLogs,
    },
    {
      label: "IP Addresses",
      array: ips,
    },
    {
      label: "Usernames",
      array: usernames,
    },
    {
      label: "League Ids",
      array: league_ids,
    },
  ];

  const headers = [
    { text: <div>Tool</div>, colspan: 1, classname: "" },
    { text: <div>Username/League Id</div>, colspan: 1, classname: "" },
    { text: <div>Tab</div>, colspan: 1, classname: "" },
    { text: <div>IP Address</div>, colspan: 1, classname: "" },
    {
      text: <div>Date</div>,
      colspan: 1,
      classname: "font-score !break-all p-4",
    },
  ];

  return (
    <div className="h-dvh">
      <Link
        href={"/tools"}
        className="m-8 float-left text-yellow-600 !text-[1.5rem] font-score"
      >
        Tools
      </Link>
      <h1 className="!text-[2rem] font-score text-blue-400 m-8">
        Logs - Last 24 hrs
      </h1>

      <div className="filters flex flex-col text-[1.5rem] items-center m-auto my-8 bg-gray-700 w-fit p-8 max-w-[100vw]">
        {filters.map((f) => {
          return (
            <div
              key={f.label}
              className="w-full flex justify-center items-center m-4"
            >
              <label className="w-[35%] text-left">{f.label}</label>
              <div className="text-[1.5rem] h-[3rem] w-[65%] m-auto">
                <Search
                  searched={f.state}
                  setSearched={f.setState}
                  options={f.list.map((item) => {
                    return {
                      id: item,
                      text: item,
                      display: (
                        <div className="flex justify-center font-score text-[1.5rem] w-full !overflow-hidden text-ellipsis whitespace-nowrap">
                          {item}
                        </div>
                      ),
                    };
                  })}
                  placeholder={f.label}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-[1.5rem] mx-auto my-8 w-[100vmin] flex justify-evenly">
        {totals.map((t) => {
          return (
            <div key={t.label}>
              <strong className="font-score text-yellow-600">
                {t.array.length}
              </strong>{" "}
              <em className="font-chill">{t.label}</em>
            </div>
          );
        })}
      </div>

      <TableMain
        type={1}
        headers={headers}
        data={filteredLogs
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          )
          .map((log, index) => {
            return {
              id: log.created_at + "__" + index,
              columns: [
                {
                  text: <div>{log.tool}</div>,
                  colspan: 1,
                  classname: "",
                },
                {
                  text: <div>{log.username || log.league_id || "-"}</div>,
                  colspan: 1,
                  classname: "",
                },
                {
                  text: <div>{log.tab || "-"}</div>,
                  colspan: 1,
                  classname: "",
                },
                {
                  text: <div>{log.ip}</div>,
                  colspan: 1,
                  classname: "",
                },
                {
                  text: (
                    <>
                      {new Date(log.created_at).toLocaleDateString("en-US")}
                      <br />
                      <em>
                        {new Date(log.created_at).toLocaleTimeString("en-US")}
                      </em>
                    </>
                  ),
                  colspan: 1,
                  classname: "text-[1rem] font-score !break-all p-4",
                },
              ],
            };
          })}
        placeholder=""
      />
    </div>
  );
};

export default LogsPage;
