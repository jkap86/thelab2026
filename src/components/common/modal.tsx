import { JSX, useRef, useEffect } from "react";
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
  const portalRef = useRef<HTMLDivElement | null>(null);

  // Create portal element ONCE on mount
  useEffect(() => {
    const el = document.createElement("div");
    const modalRoot = document.getElementById("modal-root");
    if (modalRoot) {
      modalRoot.appendChild(el);
    }
    portalRef.current = el;

    return () => {
      if (el.parentElement) {
        el.parentElement.removeChild(el);
      }
    };
  }, []); // Empty deps = only on mount/unmount

  // Lock body scroll when open
  useEffect(() => {
    if (!isOpen) return;

    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";

    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  if (!isOpen || !portalRef.current) return null;

  return ReactDOM.createPortal(
    <div
      className="w-full h-full flex justify-center items-center bg-[rgba(0,0,0,.5)] fixed z-100 top-0 left-0 right-0 bottom-0"
      onMouseDown={(e) => {
        // Only close if mousedown is directly on backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={
          "bg-[var(--color3)] max-w-[90dvmin] max-h-[90dvh] min-w-[90dvmin] h-fit rounded-[2rem] overflow-auto " +
          "shadow-[0_0_1rem_gray,inset_0_0_2rem_black] outline-double outline-[var(--color1)] outline-[.25rem] p-4"
        }
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    portalRef.current
  );
};

export default Modal;
