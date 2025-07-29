import { useState, useContext, useCallback, useEffect } from 'react';
import CommentsContext, { CommentsContextType } from '../contexts/CommentsContext';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions';
import type { Region } from 'wavesurfer.js/dist/plugins/regions';
import { _Comment, Marker } from '../../../../shared/types';

// Define a type for region with data
interface RegionWithData extends Region {
  data: {
    commentId: number;
  };
  update: (options: any) => void;
}

// Define the return type for useComments hook
interface UseCommentsReturn {
  comments: _Comment[];
  markers: Marker[];
  setComments: (comments: _Comment[] | ((prev: _Comment[]) => _Comment[])) => void;
  setMarkers: (markers: Marker[] | ((prev: Marker[]) => Marker[])) => void;
  fetchComments: (trackId: number, page?: number, limit?: number) => Promise<_Comment[]>;
  fetchCommentsAndMarkers: (trackId: number, page?: number, limit?: number) => Promise<void>;
  addComment: (trackId: number, userId: number, content: string, token: string) => Promise<void>;
  addMarkerAndComment: (trackId: number, content: string, time: number, color?: string) => Promise<_Comment>;
  editComment: (commentId: number, content: string) => Promise<_Comment>;
  deleteComment: (commentId: number) => Promise<boolean>;
  selectedCommentId: number | null;
  setSelectedCommentId: (id: number | null) => void;
  selectedRegionId: string | null;
  setSelectedRegionId: (id: string | null) => void;
  regionCommentMap: Record<string, number>;
  setRegionCommentMap: (map: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void;
  handleSelectComment: (commentId: number) => void;
  newCommentInput: string;
  setNewCommentInput: (input: string) => void;
}

export const useComments = (
  waveSurferRef: React.MutableRefObject<WaveSurfer | null>,
  regionsRef: React.MutableRefObject<RegionsPlugin | null>
): UseCommentsReturn => {
  let context;
  
  try {
    context = useContext(CommentsContext);
  } catch (error) {
    console.error('❌ useComments: Error accessing CommentsContext:', error);
    context = undefined;
  }
  
  // Handle case where context might be undefined
  if (!context) {
    console.warn('⚠️ useComments hook used outside of CommentsProvider context or context is unavailable');
    return {
      comments: [],
      markers: [],
      setComments: () => {},
      setMarkers: () => {},
      fetchComments: () => Promise.resolve([]),
      fetchCommentsAndMarkers: () => Promise.resolve(),
      addComment: () => Promise.resolve(),
      addMarkerAndComment: () => Promise.resolve({} as _Comment),
      editComment: () => Promise.resolve({} as _Comment),
      deleteComment: () => Promise.resolve(false),
      selectedCommentId: null,
      setSelectedCommentId: () => {},
      selectedRegionId: null,
      setSelectedRegionId: () => {},
      regionCommentMap: {},
      setRegionCommentMap: () => {},
      handleSelectComment: () => {},
      newCommentInput: '',
      setNewCommentInput: () => {}
    };
  }
  
  // Safely destructure context with error handling
  let contextData;
  try {
    contextData = context;
  } catch (error) {
    console.error('❌ useComments: Error destructuring context:', error);
    contextData = null;
  }
  
  const { 
    comments = [], 
    setComments = () => {}, 
    markers = [],
    setMarkers = () => {},
    fetchComments = () => Promise.resolve([]),
    fetchCommentsAndMarkers = () => Promise.resolve(),
    addComment = () => Promise.resolve(),
    addMarkerAndComment = () => Promise.resolve({} as _Comment), 
    editComment = () => Promise.resolve({} as _Comment),
    deleteComment = () => Promise.resolve(false),
    selectedCommentId = null, 
    setSelectedCommentId = () => {},
    selectedRegionId = null,
    setSelectedRegionId = () => {},
    regionCommentMap = {},
    setRegionCommentMap = () => {},
  } = contextData || {};

  const [newCommentInput, setNewCommentInput] = useState('');

  // console.log("🎣 [useComments] Hook called - markers:", markers);
  // console.log("🎣 [useComments] Hook called - markers length:", markers?.length);
  // console.log("🎣 [useComments] Hook called - regionCommentMap:", regionCommentMap);
  // console.log("🎣 [useComments] Hook called - comments:", comments?.length, "comments");

  // Add debugging for waveSurfer and regions
  useEffect(() => {
    console.log("useComments - waveSurferRef.current:", !!waveSurferRef.current);
    console.log("useComments - regionsRef.current:", !!regionsRef.current);
    
    if (waveSurferRef.current && regionsRef.current && markers?.length) {
      console.log("useComments - We have waveSurfer, regions, and markers. Should be able to create regions.");
      
      // Check if regions are being created
      setTimeout(() => {
        if (regionsRef.current) {
          const regions = regionsRef.current.getRegions();
          console.log("useComments - Current regions:", regions);
        }
      }, 1000);
    }
  }, [markers]); // Refs themselves don't need to be in deps array

  // console.log("Markers in useComments:•", markers);

  // Add other comment-related logic and state variables here, e.g.,
  // const [isLoading, setIsLoading] = useState(false);
  // const [error, setError] = useState(null);

  // console.log("Region-Comment Map in useComments:", regionCommentMap);

  useEffect(() => {
    console.log('Selected comment ID changed:', selectedCommentId);
  }, [selectedCommentId]);

  const handleSelectComment = useCallback((commentId: number) => {
    console.log('handleSelectComment called with:', commentId);
    console.log('Current state of comments:', comments);
    
    // Ensure comments is available before proceeding
    if (!comments || !Array.isArray(comments)) {
      console.warn('handleSelectComment: comments not available or not an array');
      return;
    }
    
    setSelectedCommentId(commentId);

    if (!waveSurferRef.current || !regionsRef.current) return;

    const regions = regionsRef.current.getRegions();

    console.log('regionCommentMap:', regionCommentMap);
    const selectedRegion = regions.find((region) =>
      Object.entries(regionCommentMap).some(([regionId, cId]) => cId === commentId && region.id === regionId)
    );

    if (selectedRegion) {
      console.log('Selected region:', selectedRegion);
      selectedRegion.setOptions({ color: 'rgba(0, 255, 0, 0.7)' });
      waveSurferRef.current.seekTo(selectedRegion.start / waveSurferRef.current.getDuration());
    }

    // Merged logic from AudioPlayer's handleSelectComment
    if (regionsRef.current) {
      const regions = regionsRef.current.getRegions();
      regions.forEach((region: any) => {
        if (region.data?.commentId === commentId) {
        region.update({ color: 'rgba(0, 255, 0, 0.7)' });
          if (waveSurferRef.current) {
        waveSurferRef.current.seekTo(region.start / waveSurferRef.current.getDuration());
          }
      }
    });
    }
  }, [regionCommentMap, setSelectedCommentId, comments, waveSurferRef, regionsRef]);

  // Ensure comments and markers are always arrays for type safety
  const safeComments = comments && Array.isArray(comments) ? comments : [];
  const safeMarkers = markers && Array.isArray(markers) ? markers : [];

  return { 
    newCommentInput: newCommentInput || '', 
    setNewCommentInput: setNewCommentInput || (() => {}), 
    comments: safeComments, 
    setComments: setComments || (() => {}), 
    markers: safeMarkers,
    setMarkers: setMarkers || (() => {}),
    fetchComments: fetchComments || (() => Promise.resolve([])),
    fetchCommentsAndMarkers: fetchCommentsAndMarkers || (() => Promise.resolve()), 
    addComment: addComment || (() => Promise.resolve()), 
    addMarkerAndComment: addMarkerAndComment || (() => Promise.resolve({} as _Comment)), 
    editComment: editComment || (() => Promise.resolve({} as _Comment)),
    deleteComment: deleteComment || (() => Promise.resolve(false)),
    selectedCommentId: selectedCommentId ?? null, 
    setSelectedCommentId: setSelectedCommentId || (() => {}),
    selectedRegionId: selectedRegionId ?? null,
    setSelectedRegionId: setSelectedRegionId || (() => {}),
    regionCommentMap: regionCommentMap || {},
    setRegionCommentMap: setRegionCommentMap || (() => {}),
    handleSelectComment: handleSelectComment || (() => {})
  };
};
