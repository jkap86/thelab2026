import { fetchLeagues, fetchUser } from "@/redux/manager/manager-actions";
import { resetUserAndLeagues } from "@/redux/manager/manager-slice";
import { AppDispatch, RootState } from "@/redux/store";
import { useEffect, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

export default function useFetchUserLeagues(searched: string) {
  const dispatch: AppDispatch = useDispatch();
  const { allplayers, nflState, ktcCurrent } = useSelector(
    (state: RootState) => state.common
  );
  const { user } = useSelector((state: RootState) => state.manager);

  const commonLoaded = useMemo(() => {
    return allplayers !== null && nflState !== null && ktcCurrent !== null;
  }, [allplayers, nflState, ktcCurrent]);

  const username = useMemo(() => {
    return user?.username?.toLowerCase() ?? "";
  }, [user]);

  const ctrlRefUser = useRef<AbortController | null>(null);
  const lastUserReqRef = useRef<string | null>(null);

  useEffect(() => {
    console.log({ username, searched });
    if (username !== searched.toLowerCase()) {
      dispatch(resetUserAndLeagues());
    }
  }, [username, searched, dispatch]);

  useEffect(() => {
    if (!commonLoaded || !searched) return;

    ctrlRefUser.current?.abort();
    ctrlRefUser.current = new AbortController();

    lastUserReqRef.current = searched;

    dispatch(
      fetchUser({
        searched,
        signal: ctrlRefUser.current?.signal,
      })
    );

    return () => {
      ctrlRefUser.current?.abort();
    };
  }, [dispatch, searched, commonLoaded]);

  const ctrlRefLeagues = useRef<AbortController | null>(null);
  const lastLeaguesReqRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      !commonLoaded ||
      !user ||
      !searched ||
      username !== searched.toLowerCase() ||
      lastLeaguesReqRef.current === username
    )
      return;

    ctrlRefLeagues.current?.abort();
    ctrlRefLeagues.current = new AbortController();

    lastLeaguesReqRef.current = username;

    dispatch(
      fetchLeagues({
        user_id: user.user_id,
        week: nflState?.week ?? 1,
        signal: ctrlRefLeagues.current?.signal,
      })
    );

    return () => {
      ctrlRefLeagues.current?.abort();
    };
  }, [dispatch, user, commonLoaded, searched, username, nflState]);
}
