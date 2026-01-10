import { fetchAllplayers } from "@/redux/common/common-actions";
import { AppDispatch, RootState } from "@/redux/store";
import { useEffect, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

export default function useFetchAllPlayers() {
  const dispatch: AppDispatch = useDispatch();
  const { allplayers, isLoadingCommon, errorCommon } = useSelector(
    (state: RootState) => state.common
  );
  const ctrlRef = useRef<AbortController | null>(null);

  const isLoading = useMemo(
    () => isLoadingCommon.includes("allplayers"),
    [isLoadingCommon]
  );

  const error = useMemo(
    () => errorCommon.find((err) => err.includes("allplayers")) || null,
    [errorCommon]
  );

  useEffect(() => {
    if (allplayers || isLoading || error) return;

    ctrlRef.current = new AbortController();

    dispatch(fetchAllplayers({ signal: ctrlRef.current.signal }));
  }, [allplayers, isLoading, error, dispatch]);

  useEffect(() => {
    return () => {
      if (ctrlRef.current) {
        ctrlRef.current.abort();
      }
    };
  }, []);
}
