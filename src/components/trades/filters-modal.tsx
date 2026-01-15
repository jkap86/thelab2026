import { AppDispatch } from "@/redux/store";
import Modal from "../common/modal";
import { useDispatch } from "react-redux";
import { updateTradesState } from "@/redux/trades/trades-slice";

const FiltersModal = ({
  isOpen,
  setIsOpen,
  filters,
}: {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  filters: { [key: string]: string };
}) => {
  const dispatch: AppDispatch = useDispatch();

  return (
    <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
      <div>
        <div className="text-center text-[2rem] font-metal font-black">
          Filters
        </div>
        <div className="flex flex-col text-[1.5rem] font-chill items-center gap-4 mt-4">
          <div className="">
            <label className="m-2">League Type 1:</label>
            <select
              className="m-2"
              value={filters.leagueType1}
              onChange={(e) =>
                dispatch(
                  updateTradesState({
                    key: "leagueType1",
                    value: e.target.value,
                  })
                )
              }
            >
              <option value="">All</option>
              <option value={0}>Redraft</option>
              <option value={1}>Keeper</option>
              <option value={2}>Dynasty</option>
            </select>
          </div>
          <div>
            <label className="m-2">League Type 2:</label>
            <select
              className="m-2"
              value={filters.leagueType2}
              onChange={(e) =>
                dispatch(
                  updateTradesState({
                    key: "leagueType2",
                    value: e.target.value,
                  })
                )
              }
            >
              <option value="">All</option>
              <option value={0}>Lineup</option>
              <option value={1}>Bestball</option>
            </select>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default FiltersModal;
