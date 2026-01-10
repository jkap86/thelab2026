import { JSX, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";

const Modal = ({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: JSX.Element;
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  const modalRoot =
    typeof window === "undefined"
      ? null
      : document.getElementById("modal-root");

  useEffect(() => {
    if (!modalRef.current) {
      modalRef.current = document.createElement("div");
    }
  });

  // Lock background scroll (no one‑way bounce) by using position:fixed
  useEffect(() => {
    if (!isOpen) return;

    // 1️⃣ Remember where we were
    const scrollY = window.scrollY;

    // 2️⃣ Fix the body in place
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";

    return () => {
      // 3️⃣ Unfix, restore original position
      document.body.style.position = "";
      document.body.style.top = "";
      // 4️⃣ Jump back to where you were
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  // mount/unmount to modal-root
  useEffect(() => {
    if (isOpen && modalRoot && modalRef.current) {
      modalRoot.appendChild(modalRef.current);
      return () => {
        modalRoot.removeChild(modalRef.current!);
      };
    }
  }, [isOpen, modalRoot]);

  if (!isOpen || !modalRef.current) return null;

  return ReactDOM.createPortal(
    <div
      className="w-full h-full flex justify-center items-center bg-[rgba(0,0,0,.5)] fixed z-100 top-0 left-0 right-0 bottom-0"
      onClick={() => onClose()}
    >
      <div
        className={
          "bg-[var(--color3)] min-w-[80dvmin] w-[20rem] h-[70dvh] max-h-fit rounded-[2rem] overflow-auto " +
          "shadow-[0_0_1rem_gray,inset_0_0_2rem_black] outline-double outline-[var(--color1)] outline-[.25rem] p-8"
        }
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    modalRef.current
  );
};

export default Modal;
