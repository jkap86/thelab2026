import Modal from "../common/modal";

const FiltersModal = ({
  isOpen,
  setIsOpen,
  filters,
}: {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  filters: { [key: string]: string };
}) => {
  return (
    <Modal isOpen={isOpen} onClose={() => setIsOpen(false)}>
      <div className="text-center text-[2rem] font-metal font-black">
        Filters
      </div>
    </Modal>
  );
};

export default FiltersModal;
