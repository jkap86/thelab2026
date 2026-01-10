import Modal from "../common/modal";

const FiltersModal = ({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
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
