import { useState, useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import Modal from "./modal";
import { RootState, AppDispatch } from "@/redux/store";
import { updateAdpFilters, clearAdpCache } from "@/redux/common/common-slice";
import { fetchADP } from "@/redux/common/common-actions";
import { ADPFilters } from "@/lib/types/common-types";

const ROSTER_SLOT_OPTIONS = [
  "QB",
  "RB",
  "WR",
  "TE",
  "FLEX",
  "SUPER_FLEX",
  "REC_FLEX",
  "WRRB_FLEX",
  "K",
  "DEF",
  "BN",
  "QB+SF",
];

const SCORING_OPTIONS = [
  "pass_td",
  "pass_yd",
  "pass_int",
  "rush_td",
  "rush_yd",
  "rec",
  "rec_td",
  "rec_yd",
  "bonus_rec_te",
  "fum_lost",
];

const OPERATORS = ["=", ">", "<"] as const;

type RosterSlot = { position: string; count: number };
type ScoringFilter = { key: string; operator: string; value: number };

const parseRosterSlots = (str: string | undefined): RosterSlot[] => {
  if (!str) return [];
  return str
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((pair) => {
      const [position, countStr] = pair.split(":");
      return { position, count: parseInt(countStr, 10) || 1 };
    });
};

const serializeRosterSlots = (slots: RosterSlot[]): string | undefined => {
  if (slots.length === 0) return undefined;
  return slots.map((s) => `${s.position}:${s.count}`).join(",");
};

const parseScoringFilters = (str: string | undefined): ScoringFilter[] => {
  if (!str) return [];
  return str
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((pair) => {
      const match = pair.match(/^(\w+)(=|>|<)(.+)$/);
      if (match) {
        const [, key, operator, value] = match;
        return { key, operator, value: parseFloat(value) || 0 };
      }
      return null;
    })
    .filter((f): f is ScoringFilter => f !== null);
};

const serializeScoringFilters = (
  filters: ScoringFilter[]
): string | undefined => {
  if (filters.length === 0) return undefined;
  return filters.map((f) => `${f.key}${f.operator}${f.value}`).join(",");
};

const AdpModal = ({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}) => {
  const dispatch: AppDispatch = useDispatch();
  const { adpFilters, adpDraftCounts, isLoadingCommon } = useSelector(
    (state: RootState) => state.common
  );

  const [localFilters, setLocalFilters] = useState<ADPFilters>(adpFilters);
  const [rosterSlots, setRosterSlots] = useState<RosterSlot[]>([]);
  const [scoringFilters, setScoringFilters] = useState<ScoringFilter[]>([]);
  const [hasFetched, setHasFetched] = useState(false);

  // Track previous isOpen to only reset state when modal opens
  const prevIsOpenRef = useRef(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only reset when modal transitions from closed to open
    if (isOpen && !prevIsOpenRef.current) {
      setLocalFilters(adpFilters);
      setRosterSlots(parseRosterSlots(adpFilters.rosterSlots));
      setScoringFilters(parseScoringFilters(adpFilters.scoring));
      setHasFetched(false);
    }
    prevIsOpenRef.current = isOpen;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const isLoading = isLoadingCommon.includes("adp");
  const redraftCounts = adpDraftCounts.redraft;
  const dynastyCounts = adpDraftCounts.dynasty;

  // Scroll to results section when loading or when results appear
  useEffect(() => {
    if (isLoading || (hasFetched && (redraftCounts || dynastyCounts))) {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [isLoading, hasFetched, redraftCounts, dynastyCounts]);

  const handleFetch = () => {
    const filtersToSave = {
      ...localFilters,
      rosterSlots: serializeRosterSlots(rosterSlots),
      scoring: serializeScoringFilters(scoringFilters),
    };
    dispatch(updateAdpFilters(filtersToSave));
    dispatch(clearAdpCache());
    dispatch(
      fetchADP({
        key: "redraft",
        filters: { ...filtersToSave, leagueType: "0" },
      })
    );
    dispatch(
      fetchADP({
        key: "dynasty",
        filters: { ...filtersToSave, leagueType: "2" },
      })
    );
    setHasFetched(true);
  };

  const updateFilter = <K extends keyof ADPFilters>(
    key: K,
    value: ADPFilters[K]
  ) => {
    setLocalFilters((prev) => ({ ...prev, [key]: value }));
  };

  const addRosterSlot = () => {
    setRosterSlots((prev) => [...prev, { position: "QB", count: 1 }]);
  };

  const updateRosterSlot = (
    index: number,
    field: keyof RosterSlot,
    value: string | number
  ) => {
    setRosterSlots((prev) =>
      prev.map((slot, i) => (i === index ? { ...slot, [field]: value } : slot))
    );
  };

  const removeRosterSlot = (index: number) => {
    setRosterSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const addScoringFilter = () => {
    setScoringFilters((prev) => [
      ...prev,
      { key: "rec", operator: "=", value: 1 },
    ]);
  };

  const updateScoringFilter = (
    index: number,
    field: keyof ScoringFilter,
    value: string | number
  ) => {
    setScoringFilters((prev) =>
      prev.map((filter, i) =>
        i === index ? { ...filter, [field]: value } : filter
      )
    );
  };

  const removeScoringFilter = (index: number) => {
    setScoringFilters((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
      <div className="flex flex-col gap-4">
        <h1 className="text-[2rem] font-score text-center">ADP Filters</h1>

        {/* Date Range */}
        <div className="flex flex-col gap-2">
          <label className="font-bold">Date Range</label>
          <div className="flex gap-2 items-center">
            <input
              type="date"
              className="flex-1 p-2 rounded bg-[var(--color2)] text-white"
              value={localFilters.startDate || ""}
              onChange={(e) =>
                updateFilter("startDate", e.target.value || undefined)
              }
            />
            <span>to</span>
            <input
              type="date"
              className="flex-1 p-2 rounded bg-[var(--color2)] text-white"
              value={localFilters.endDate || ""}
              onChange={(e) =>
                updateFilter("endDate", e.target.value || undefined)
              }
            />
          </div>
        </div>

        {/* Draft Type */}
        <div className="flex flex-col gap-2">
          <label className="font-bold">Draft Type</label>
          <select
            className="p-2 rounded bg-[var(--color2)] text-white"
            value={localFilters.draftType || ""}
            onChange={(e) =>
              updateFilter("draftType", e.target.value || undefined)
            }
          >
            <option value="">All</option>
            <option value="snake">Snake</option>
            <option value="auction">Auction</option>
          </select>
        </div>

        {/* Format (Best Ball vs Lineup) */}
        <div className="flex flex-col gap-2">
          <label className="font-bold">Format</label>
          <select
            className="p-2 rounded bg-[var(--color2)] text-white"
            value={localFilters.bestBall || ""}
            onChange={(e) =>
              updateFilter("bestBall", e.target.value || undefined)
            }
          >
            <option value="">All</option>
            <option value="0">Lineup</option>
            <option value="1">Best Ball</option>
          </select>
        </div>

        {/* Player Type */}
        <div className="flex flex-col gap-2">
          <label className="font-bold">Player Type</label>
          <select
            className="p-2 rounded bg-[var(--color2)] text-white"
            value={localFilters.playerType || ""}
            onChange={(e) =>
              updateFilter("playerType", e.target.value || undefined)
            }
          >
            <option value="">All</option>
            <option value="0">All Players</option>
            <option value="1">Rookies Only</option>
            <option value="2">Veterans Only</option>
          </select>
        </div>

        {/* Teams */}
        <div className="flex flex-col gap-2">
          <label className="font-bold">League Size (Teams)</label>
          <input
            type="number"
            className="p-2 rounded bg-[var(--color2)] text-white"
            placeholder="Any"
            min={6}
            max={32}
            value={localFilters.teams || ""}
            onChange={(e) =>
              updateFilter(
                "teams",
                e.target.value ? parseInt(e.target.value, 10) : undefined
              )
            }
          />
        </div>

        {/* Roster Slots */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <label className="font-bold">Roster Slots</label>
            <button
              type="button"
              className="w-8 h-8 flex items-center justify-center rounded bg-[var(--color1)] text-white text-xl hover:opacity-80"
              onClick={addRosterSlot}
            >
              +
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {rosterSlots.map((slot, index) => (
              <div key={index} className="flex gap-2 items-center">
                <select
                  className="flex-1 p-2 rounded bg-[var(--color2)] text-white"
                  value={slot.position}
                  onChange={(e) =>
                    updateRosterSlot(index, "position", e.target.value)
                  }
                >
                  {ROSTER_SLOT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  className="w-16 p-2 rounded bg-[var(--color2)] text-white text-center"
                  min={0}
                  max={10}
                  value={slot.count}
                  onChange={(e) =>
                    updateRosterSlot(
                      index,
                      "count",
                      parseInt(e.target.value, 10) || 0
                    )
                  }
                />
                <button
                  type="button"
                  className="w-8 h-8 flex items-center justify-center rounded bg-red-600 text-white hover:opacity-80"
                  onClick={() => removeRosterSlot(index)}
                >
                  ×
                </button>
              </div>
            ))}
            {rosterSlots.length === 0 && (
              <div className="text-gray-400 text-sm italic">
                No roster slot filters. Click + to add.
              </div>
            )}
          </div>
        </div>

        {/* Scoring */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <label className="font-bold">Scoring Settings</label>
            <button
              type="button"
              className="w-8 h-8 flex items-center justify-center rounded bg-[var(--color1)] text-white text-xl hover:opacity-80"
              onClick={addScoringFilter}
            >
              +
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {scoringFilters.map((filter, index) => (
              <div key={index} className="flex gap-2 items-center">
                <select
                  className="flex-1 p-2 rounded bg-[var(--color2)] text-white"
                  value={filter.key}
                  onChange={(e) =>
                    updateScoringFilter(index, "key", e.target.value)
                  }
                >
                  {SCORING_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <select
                  className="w-14 p-2 rounded bg-[var(--color2)] text-white text-center"
                  value={filter.operator}
                  onChange={(e) =>
                    updateScoringFilter(index, "operator", e.target.value)
                  }
                >
                  {OPERATORS.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  className="w-20 p-2 rounded bg-[var(--color2)] text-white text-center"
                  step="0.1"
                  value={filter.value}
                  onChange={(e) =>
                    updateScoringFilter(
                      index,
                      "value",
                      parseFloat(e.target.value) || 0
                    )
                  }
                />
                <button
                  type="button"
                  className="w-8 h-8 flex items-center justify-center rounded bg-red-600 text-white hover:opacity-80"
                  onClick={() => removeScoringFilter(index)}
                >
                  ×
                </button>
              </div>
            ))}
            {scoringFilters.length === 0 && (
              <div className="text-gray-400 text-sm italic">
                No scoring filters. Click + to add.
              </div>
            )}
          </div>
        </div>

        {/* Fetch Button */}
        <button
          type="button"
          className="mt-4 p-3 rounded bg-[var(--color1)] text-white font-bold hover:opacity-80 disabled:opacity-50"
          onClick={(e) => {
            e.stopPropagation();
            handleFetch();
          }}
          disabled={isLoading}
        >
          {isLoading ? "Loading..." : "Fetch ADP"}
        </button>

        {/* Loading Spinner & Results */}
        <div ref={resultsRef}>
          {isLoading && (
            <div className="flex justify-center items-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
          )}

          {hasFetched && !isLoading && (redraftCounts || dynastyCounts) && (
            <div className="mt-4 p-4 rounded bg-[var(--color2)]">
              <h2 className="font-bold text-lg mb-3">Drafts Found</h2>
              <div className="grid grid-cols-2 gap-4">
                {/* Redraft */}
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-[var(--color1)]">Redraft</span>
                  {redraftCounts ? (
                    <>
                      <span className="text-sm">
                        Snake: {redraftCounts.snake.toLocaleString()}
                      </span>
                      <span className="text-sm">
                        Auction: {redraftCounts.auction.toLocaleString()}
                      </span>
                      <span className="text-sm font-bold">
                        Total: {redraftCounts.total.toLocaleString()}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-gray-400">No data</span>
                  )}
                </div>

                {/* Dynasty */}
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-[var(--color1)]">Dynasty</span>
                  {dynastyCounts ? (
                    <>
                      <span className="text-sm">
                        Snake: {dynastyCounts.snake.toLocaleString()}
                      </span>
                      <span className="text-sm">
                        Auction: {dynastyCounts.auction.toLocaleString()}
                      </span>
                      <span className="text-sm font-bold">
                        Total: {dynastyCounts.total.toLocaleString()}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-gray-400">No data</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default AdpModal;
