import { useDispatch, useSelector } from "react-redux";
import { fetchADP } from "@/redux/common/common-actions";
import { AppDispatch, RootState } from "@/redux/store";
import { useEffect, useRef, useMemo } from "react";

// Helper to get ISO date string for N days ago
export const getDaysAgo = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
};

export default function useFetchAdp() {
  const dispatch: AppDispatch = useDispatch();
  const { adp, adpFilters } = useSelector((state: RootState) => state.common);
  const redraftFetchedRef = useRef(false);
  const dynastyFetchedRef = useRef(false);

  const hasRedraft = !!adp.redraft;
  const hasDynasty = !!adp.dynasty;

  console.log({ adp });

  // Fetch redraft ADP
  useEffect(() => {
    if (hasRedraft || redraftFetchedRef.current) return;

    redraftFetchedRef.current = true;
    dispatch(
      fetchADP({
        key: "redraft",
        filters: {
          ...adpFilters,
          leagueType: "0",
        },
      })
    );
  }, [hasRedraft, dispatch, adpFilters]);

  // Fetch dynasty ADP
  useEffect(() => {
    if (hasDynasty || dynastyFetchedRef.current) return;

    dynastyFetchedRef.current = true;
    dispatch(
      fetchADP({
        key: "dynasty",
        filters: {
          ...adpFilters,
          leagueType: "2",
        },
      })
    );
  }, [hasDynasty, dispatch, adpFilters]);
}
