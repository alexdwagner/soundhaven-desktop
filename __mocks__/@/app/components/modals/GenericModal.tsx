import React from 'react';

const GenericModal = ({ isOpen, onClose, children, showDefaultCloseButton }: any) => {
  if (!isOpen) return null;
  
  return (
    <div data-testid="generic-modal" className="modal">
      {children}
    </div>
  );
};

export default GenericModal;