"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { DragContext } from '../contexts/DragContext';
import { Track } from '../../../../shared/types';
import DragPreview from '../components/tracks/DragPreview';

interface DragProviderProps {
  children: React.ReactNode;
}

export const DragProvider: React.FC<DragProviderProps> = ({ children }) => {
  const [dragState, setDragState] = useState({
    isDragging: false,
    draggedTrack: null as Track | null,
    dragPosition: { x: 0, y: 0 },
    dragStartPosition: { x: 0, y: 0 },
  });

  const startDrag = useCallback((track: Track, position: { x: number; y: number }) => {
    // console.log(`[DRAG N DROP] 🚀 DragProvider: Starting custom drag for track:`, track);
    // console.log(`[DRAG N DROP] 🚀 DragProvider: Initial position:`, position);
    setDragState({
      isDragging: true,
      draggedTrack: track,
      dragPosition: position,
      dragStartPosition: position,
    });
    // console.log(`[DRAG N DROP] 🚀 DragProvider: Drag state updated to isDragging=true`);
  }, []);

  const updateDragPosition = useCallback((position: { x: number; y: number }) => {
    setDragState(prev => ({
      ...prev,
      dragPosition: position,
    }));
    // Only log occasionally to avoid spam
    if (Math.random() < 0.01) { // 1% of the time
      // console.log(`[DRAG N DROP] 🚀 DragProvider: Updated drag position:`, position);
    }
  }, []);

  const endDrag = useCallback(() => {
    // console.log(`[DRAG N DROP] 🚀 DragProvider: Ending custom drag`);
    setDragState({
      isDragging: false,
      draggedTrack: null,
      dragPosition: { x: 0, y: 0 },
      dragStartPosition: { x: 0, y: 0 },
    });
    // console.log(`[DRAG N DROP] 🚀 DragProvider: Drag state reset to isDragging=false`);
  }, []);

  // Track mouse movement during drag
  useEffect(() => {
    if (!dragState.isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      updateDragPosition({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
      // console.log(`[DRAG N DROP] 🚀 DragProvider: Mouse up detected, ending drag`);
      endDrag();
    };

    // Use passive listeners to avoid interfering with other events
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseup', handleMouseUp, { passive: true });

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState.isDragging, updateDragPosition, endDrag]);

  return (
    <DragContext.Provider value={{ dragState, startDrag, updateDragPosition, endDrag }}>
      {children}
      {/* DragPreview for visual feedback during drag operations */}
      {dragState.draggedTrack && (
        <DragPreview
          track={dragState.draggedTrack}
          position={dragState.dragPosition}
          isDragging={dragState.isDragging}
        />
      )}
    </DragContext.Provider>
  );
}; 