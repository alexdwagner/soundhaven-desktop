import React from "react";
import GenericModal from "./GenericModal";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  doNotAskAgain: boolean;
  setDoNotAskAgain: (value: boolean) => void;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  doNotAskAgain,
  setDoNotAskAgain,
}) => {
  return (
    <GenericModal isOpen={isOpen} onClose={onClose}>
      <h3 className="text-lg font-bold">Confirm Delete</h3>
      <p className="mt-2">Are you sure you want to delete this track from your library?</p>
      <div className="mt-3">
        <input
          type="checkbox"
          id="doNotAskAgain"
          checked={doNotAskAgain}
          onChange={(e) => setDoNotAskAgain(e.target.checked)}
        />
        <label htmlFor="doNotAskAgain" className="ml-2">Do not ask me again</label>
      </div>
      <div className="mt-4 flex justify-end">
        <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md mr-2">
          Cancel
        </button>
        <button onClick={onConfirm} className="px-4 py-2 bg-red-500 text-white rounded-md">
          Delete
        </button>
      </div>
    </GenericModal>
  );
};

export default DeleteConfirmationModal;
