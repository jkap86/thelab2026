import { AppDispatch, RootState } from "@/redux/store";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import Avatar from "../common/avatar";
import LeagueFiltersSwitch from "../common/league-filters-switch";
import { setType1, setType2 } from "@/redux/manager/manager-slice";
import { filterLeagueIds } from "@/utils/common/filter-leagues";

const Heading = () => {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch: AppDispatch = useDispatch();
  const { user, leagues, type1, type2 } = useSelector(
    (state: RootState) => state.manager
  );

  return (
    <div className="relative max-w-[100dvmin] m-auto">
      <Link href={"/manager"} className="home">
        Manager Home
      </Link>

      <div className="text-center h-[7rem] text-[3rem] font-pulang mb-[2rem] m-auto text-[var(--color1)] font-black">
        <Avatar
          avatar_id={user!.avatar}
          type="user"
          name={user!.username}
          centered={true}
        />
      </div>

      <div className="">
        <LeagueFiltersSwitch
          type1={type1}
          type2={type2}
          setType1={(value) => dispatch(setType1(value))}
          setType2={(value) => dispatch(setType2(value))}
        />
      </div>

      {leagues && (
        <div className="text-[1.5rem] text-[var(--color7)] m-4 font-score flex justify-center">
          <div>
            {
              filterLeagueIds(Object.keys(leagues), { type1, type2, leagues })
                .length
            }{" "}
            Leagues
          </div>
        </div>
      )}

      <div className="flex justify-center">
        <select
          value={pathname.split("/")[3].replace("-", " ").toUpperCase()}
          onChange={(e) =>
            user &&
            router.push(
              `/manager/${user.username}/${e.target.value
                .replace(" ", "-")
                .toLowerCase()}`
            )
          }
          className="text-[1.5rem] !text-center font-hugmate text-[var(--color1)]"
        >
          {["LEAGUES", "PLAYERS", "LEAGUEMATES"].map((option) => (
            <option key={option} value={option} className="text-center">
              {option}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default Heading;
