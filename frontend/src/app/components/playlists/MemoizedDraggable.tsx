import React, { memo } from "react";
import { Draggable, DraggableProvided } from "react-beautiful-dnd";
import { Playlist } from "../../../../../shared/types";

interface MemoizedDraggableProps {
  playlist: Playlist;
  index: number;
  children: (provided: DraggableProvided) => React.ReactElement;
}

const MemoizedDraggable: React.FC<MemoizedDraggableProps> = ({ playlist, index, children }) => (
  <Draggable
    key={`playlist-${playlist.id}`}
    draggableId={`playlist-${playlist.id}`}
    index={index}
  >
    {children}
  </Draggable>
);

MemoizedDraggable.displayName = 'MemoizedDraggable';

export default MemoizedDraggable;
