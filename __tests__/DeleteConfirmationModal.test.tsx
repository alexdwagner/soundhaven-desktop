import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import DeleteConfirmationModal from '@/app/components/modals/DeleteConfirmationModal';

describe('DeleteConfirmationModal', () => {
  const mockOnConfirm = jest.fn();
  const mockOnClose = jest.fn();
  const mockSetDoNotAskAgain = jest.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onConfirm: mockOnConfirm,
    doNotAskAgain: false,
    setDoNotAskAgain: mockSetDoNotAskAgain,
    trackCount: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render when isOpen is true', () => {
    const { getByText } = render(<DeleteConfirmationModal {...defaultProps} />);
    
    expect(getByText('Delete Track')).toBeInTheDocument();
    expect(getByText(/Are you sure you want to delete/)).toBeInTheDocument();
  });

  it('should not render content when isOpen is false', () => {
    const { queryByText } = render(<DeleteConfirmationModal {...defaultProps} isOpen={false} />);
    
    expect(queryByText('Delete Track')).not.toBeInTheDocument();
  });

  it('should call onConfirm when Delete button is clicked', () => {
    const { getByText } = render(<DeleteConfirmationModal {...defaultProps} />);
    
    const deleteButton = getByText('Delete');
    fireEvent.click(deleteButton);
    
    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when Cancel button is clicked', () => {
    const { getByText } = render(<DeleteConfirmationModal {...defaultProps} />);
    
    const cancelButton = getByText('Cancel');
    fireEvent.click(cancelButton);
    
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should toggle "Do not ask again" checkbox', () => {
    const { getByLabelText } = render(<DeleteConfirmationModal {...defaultProps} />);
    
    const checkbox = getByLabelText(/Do not ask again/);
    fireEvent.click(checkbox);
    
    expect(mockSetDoNotAskAgain).toHaveBeenCalledWith(true);
  });

  it('should display correct text for multiple tracks', () => {
    const { getByText } = render(<DeleteConfirmationModal {...defaultProps} trackCount={3} />);
    
    expect(getByText('Delete Tracks')).toBeInTheDocument();
    expect(getByText(/Are you sure you want to delete 3 tracks/)).toBeInTheDocument();
  });
});