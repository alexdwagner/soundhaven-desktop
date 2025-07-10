"use client";

import React, { useEffect, useRef } from "react";

interface GenericModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  showDefaultCloseButton?: boolean;
}

const GenericModal: React.FC<GenericModalProps> = ({ 
  isOpen, 
  onClose, 
  children, 
  showDefaultCloseButton = true 
}) => {
  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      modalRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div
        ref={modalRef}
        className="bg-white p-5 w-96 rounded-md shadow-lg"
        tabIndex={-1}
      >
        {children}
        {showDefaultCloseButton && (
          <div className="mt-4 flex justify-end">
            <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GenericModal;
