import { useEffect, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchNflState } from "@/redux/common/common-actions";
import { AppDispatch, RootState } from "@/redux/store";

export default function useFetchNflState() {
  const dispatch: AppDispatch = useDispatch();
  const { nflState, isLoadingCommon, errorCommon } = useSelector(
    (state: RootState) => state.common
  );
  const ctrlRef = useRef<AbortController | null>(null);

  const isLoading = isLoadingCommon.includes("nflState");
  const error = useMemo(
    () => errorCommon.find((err) => err.includes("nflState")) || null,
    [errorCommon]
  );

  useEffect(() => {
    if (nflState || isLoading || error) return;

    ctrlRef.current = new AbortController();

    dispatch(fetchNflState({ signal: ctrlRef.current.signal }));
  }, [nflState, isLoading, error, dispatch]);

  useEffect(() => {
    return () => {
      if (ctrlRef.current) {
        ctrlRef.current.abort();
      }
    };
  }, []);
}
