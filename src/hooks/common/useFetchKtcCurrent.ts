import { useDispatch, useSelector } from "react-redux";
import { fetchKtcCurrent } from "@/redux/common/common-actions";
import { AppDispatch, RootState } from "@/redux/store";
import { useEffect, useRef } from "react";

export default function useFetchKtcCurrent() {
  const dispatch: AppDispatch = useDispatch();
  const { ktcCurrent, isLoadingCommon, errorCommon } = useSelector(
    (state: RootState) => state.common
  );
  const ctrlRef = useRef<AbortController | null>(null);

  const isLoading = isLoadingCommon.includes("ktcCurrent");
  const error = errorCommon.find((err) => err.includes("ktcCurrent")) || null;

  useEffect(() => {
    if (ktcCurrent || isLoading || error) return;

    ctrlRef.current = new AbortController();

    dispatch(fetchKtcCurrent({ signal: ctrlRef.current.signal }));
  }, [ktcCurrent, isLoading, error, dispatch]);

  useEffect(() => {
    return () => {
      if (ctrlRef.current) {
        ctrlRef.current.abort();
      }
    };
  }, []);
}
