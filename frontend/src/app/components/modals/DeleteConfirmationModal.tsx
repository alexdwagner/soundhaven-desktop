import React from "react";
import GenericModal from "./GenericModal";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  doNotAskAgain: boolean;
  setDoNotAskAgain: (value: boolean) => void;
  trackCount?: number;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  doNotAskAgain,
  setDoNotAskAgain,
  trackCount = 1,
}) => {
  const isMultiple = trackCount > 1;
  
  return (
    <GenericModal isOpen={isOpen} onClose={onClose} showDefaultCloseButton={false}>
      <div className="w-full max-w-md mx-auto">
        <div className="flex items-center mb-4">
          <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <div className="ml-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Delete {isMultiple ? 'Tracks' : 'Track'}
            </h3>
            <p className="text-sm text-gray-600">
              This action cannot be undone
            </p>
          </div>
        </div>
        
        <div className="mb-6">
          <p className="text-sm text-gray-700">
            Are you sure you want to delete{' '}
            {isMultiple ? (
              <span className="font-medium">{trackCount} tracks</span>
            ) : (
              <span className="font-medium">this track</span>
            )}{' '}
            from your library? The audio files will be permanently removed.
          </p>
        </div>
        
        <div className="mb-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={doNotAskAgain}
              onChange={(e) => setDoNotAskAgain(e.target.checked)}
              className="h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
            />
            <span className="ml-2 text-sm text-gray-700">
              Don't ask me again
            </span>
          </label>
        </div>
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Delete {isMultiple ? 'Tracks' : 'Track'}
          </button>
        </div>
      </div>
    </GenericModal>
  );
};

export default DeleteConfirmationModal;
