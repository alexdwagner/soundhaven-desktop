import React, { createContext, useContext } from 'react';
import { Track } from '../../../../shared/types';

interface DragState {
  isDragging: boolean;
  draggedTrack: Track | null;
  dragPosition: { x: number; y: number };
  dragStartPosition: { x: number; y: number };
}

interface DragContextType {
  dragState: DragState;
  startDrag: (track: Track, position: { x: number; y: number }) => void;
  updateDragPosition: (position: { x: number; y: number }) => void;
  endDrag: () => void;
}

export const DragContext = createContext<DragContextType | undefined>(undefined);

export const useDrag = () => {
  const context = useContext(DragContext);
  if (!context) {
    throw new Error('useDrag must be used within a DragProvider');
  }
  return context;
}; 