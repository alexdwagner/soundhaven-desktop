'use client';

import React, { useState, useEffect, useCallback } from "react";
import MainContent from "./components/layout/MainContent";
import NavBar from "./components/layout/NavBar";
import Footer from "./components/layout/Footer";
import AuthModal from "./components/modals/AuthModal";
import SettingsModal from "./components/modals/SettingsModal";
import { apiService } from '../services/electronApiService';
import { useTracks } from "./providers/TracksProvider";
import { useEnvironment } from "./hooks/useEnvironment";
import { Track, Playlist } from "../../../shared/types";

// import { useAuth } from "../hooks/UseAuth";
// import LoginForm from "../components/auth/LoginForm";
// import RegisterForm from "../components/auth/RegisterForm";
// import Modal from "../components/Modal";
// import NavBar from "../components/layout/NavBar";
// import { useTracks } from "../hooks/UseTracks";

// ✅ Client-side modals & authentication are separate components now
// import AuthModal from "../components/auth/AuthModal";

export default function HomePage() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  // Search results state
  const [searchResults, setSearchResults] = useState<{
    tracks: Track[],
    playlists: Playlist[],
    isActive: boolean
  }>({
    tracks: [],
    playlists: [],
    isActive: false
  });
  
  // Get tracks from context
  const { tracks, isLoading, error, fetchTracks } = useTracks();
  
  // Environment detection
  const { isMobile } = useEnvironment();
  
  // DISABLED - This was causing infinite loop due to fetchTracks dependency
  // useEffect(() => {
  //   console.log('🧪 HomePage useEffect - tracks from context:', tracks);
  //   console.log('🧪 HomePage useEffect - isLoading:', isLoading);
  //   console.log('🧪 HomePage useEffect - error:', error);
    
  //   if (tracks.length === 0 && !isLoading && !error) {
  //     console.log('🧪 HomePage useEffect - No tracks loaded yet, calling fetchTracks()');
  //     fetchTracks().then(() => {
  //       console.log('🧪 HomePage useEffect - fetchTracks completed');
  //     });
  //   }
  // }, [tracks, isLoading, error, fetchTracks]);
  
  console.log('🎯 HomePage: Auto-fetch disabled - infinite loop fixed');

  const handleLoginClick = () => {
    setAuthMode('login');
    setShowAuthModal(true);
  };

  const handleRegisterClick = () => {
    setAuthMode('register');
    setShowAuthModal(true);
  };

  const handleSettingsClick = () => {
    setShowSettingsModal(true);
  };

  // Handle search results from NavBar
  const handleSearchResults = useCallback((filteredTracks: Track[], filteredPlaylists: Playlist[]) => {
    console.log('🔍 [HomePage] Search results received:', {
      tracks: filteredTracks.length,
      playlists: filteredPlaylists.length
    });
    
    const isActive = filteredTracks.length > 0 || filteredPlaylists.length > 0;
    setSearchResults({
      tracks: filteredTracks,
      playlists: filteredPlaylists,
      isActive
    });
  }, []);

  const handleTrackSelect = useCallback((track: Track) => {
    console.log('🔍 [HomePage] Track selected from search:', track.name);
    // You can add track selection logic here if needed
  }, []);

  const handlePlaylistSelect = useCallback((playlist: Playlist) => {
    console.log('🔍 [HomePage] Playlist selected from search:', playlist.name);
    // You can add playlist selection logic here if needed
  }, []);

  const handleCommentSelect = useCallback((comment: any) => {
    console.log('🔍 [HomePage] Comment selected from search:', {
      commentId: comment.id,
      content: comment.content.substring(0, 50) + '...',
      trackId: comment.trackId
    });
    // TODO: Load the track and show comments panel
    // This will need to communicate with MainContent/TracksManager
  }, []);

  return (
    <div className="flex-col">
      <NavBar 
        onLoginClick={handleLoginClick}
        onRegisterClick={handleRegisterClick}
        onSettingsClick={handleSettingsClick}
        onSearchResults={handleSearchResults}
        onTrackSelect={handleTrackSelect}
        onPlaylistSelect={handlePlaylistSelect}
        onCommentSelect={handleCommentSelect}
      >
        <div className="flex items-center">
          {isMobile ? (
            <h1 className="text-2xl">🌊</h1>
          ) : (
            <h1 className="text-xl font-bold text-gray-900">SoundHaven</h1>
          )}
        </div>
      </NavBar>

      <div className="flex min-h-screen">
        <MainContent searchResults={searchResults} />
      </div>

      {showAuthModal && (
        <AuthModal 
          initialMode={authMode}
          onClose={() => setShowAuthModal(false)}
        />
      )}

      {showSettingsModal && (
        <SettingsModal 
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      <Footer />
    </div>
  );
}
