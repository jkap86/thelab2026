import { useDispatch, useSelector } from "react-redux";
import { fetchADP } from "@/redux/common/common-actions";
import { AppDispatch, RootState } from "@/redux/store";
import { useEffect, useRef, useMemo } from "react";

// Helper to get ISO date string for N days ago
const getDaysAgo = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
};

export default function useFetchAdp() {
  const dispatch: AppDispatch = useDispatch();
  const { adp } = useSelector((state: RootState) => state.common);
  const redraftFetchedRef = useRef(false);
  const dynastyFetchedRef = useRef(false);

  const startDate = useMemo(() => getDaysAgo(14), []);

  const hasRedraft = !!adp.redraft;
  const hasDynasty = !!adp.dynasty;

  // Fetch redraft ADP
  useEffect(() => {
    if (hasRedraft || redraftFetchedRef.current) return;

    redraftFetchedRef.current = true;
    dispatch(
      fetchADP({
        key: "redraft",
        filters: {
          leagueType: "0",
          superflex: true,
          teams: 12,
          startDate,
        },
      })
    );
  }, [hasRedraft, dispatch, startDate]);

  // Fetch dynasty ADP
  useEffect(() => {
    if (hasDynasty || dynastyFetchedRef.current) return;

    dynastyFetchedRef.current = true;
    dispatch(
      fetchADP({
        key: "dynasty",
        filters: {
          leagueType: "2",
          superflex: true,
          teams: 12,
          startDate,
        },
      })
    );
  }, [hasDynasty, dispatch, startDate]);
}
