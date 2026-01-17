"use client";

import LoadingIcon from "@/components/common/loading-icon";
import Heading from "@/components/manager/heading";
import useFetchAdp from "@/hooks/common/useFetchAdp";
import useFetchAllplayers from "@/hooks/common/useFetchAllplayers";
import useFetchKtcCurrent from "@/hooks/common/useFetchKtcCurrent";
import useFetchNflState from "@/hooks/common/useFetchNflState";
import useFetchUserLeagues from "@/hooks/manager/useFetchUserLeagues";
import { RootState } from "@/redux/store";
import { useMemo } from "react";
import { useSelector } from "react-redux";

export default function ManagerLayout({
  searched,
  children,
}: {
  searched: string;
  children: React.ReactNode;
}) {
  const { isLoadingCommon, errorCommon } = useSelector(
    (state: RootState) => state.common
  );
  const {
    isLoadingUser,
    errorUser,
    user,
    isLoadingLeagues,
    errorLeagues,
    leaguesProgress,
  } = useSelector((state: RootState) => state.manager);

  useFetchAllplayers();
  useFetchNflState();
  useFetchKtcCurrent();
  useFetchAdp();

  useFetchUserLeagues(searched);

  const errors = useMemo(
    () => [...errorCommon, errorUser, errorLeagues].filter(Boolean),
    [errorCommon, errorUser, errorLeagues]
  );

  return (
    <>
      {errors.length > 0 ? (
        <div>
          {errors.map((error) => (
            <div key={error}>{error}</div>
          ))}
        </div>
      ) : isLoadingCommon.length > 0 || isLoadingUser ? (
        <div className="flex flex-1">
          <LoadingIcon />
        </div>
      ) : (
        <div>
          {user && user.username.toLowerCase() === searched.toLowerCase() && (
            <Heading />
          )}
          {isLoadingLeagues ? (
            <div className="flex flex-col flex-1">
              <h1 className="text-[2rem] text-[var(--color1)]">
                {leaguesProgress} Leagues Loaded
              </h1>
              <div className="flex flex-col flex-1">
                <LoadingIcon />
              </div>
            </div>
          ) : (
            children
          )}
        </div>
      )}
    </>
  );
}
