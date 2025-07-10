'use client';

import React, { useState, useEffect } from "react";
import MainContent from "./components/layout/MainContent";
import NavBar from "./components/layout/NavBar";
import Footer from "./components/layout/Footer";
import AuthModal from "./components/modals/AuthModal";
import { apiService } from '../services/electronApiService';
import { useTracks } from "./providers/TracksProvider";

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
  
  // Get tracks from context
  const { tracks, isLoading, error, fetchTracks } = useTracks();
  
  // Test useEffect to check if TracksProvider is working
  useEffect(() => {
    console.log('🧪 HomePage useEffect - tracks from context:', tracks);
    console.log('🧪 HomePage useEffect - isLoading:', isLoading);
    console.log('🧪 HomePage useEffect - error:', error);
    
    if (tracks.length === 0 && !isLoading && !error) {
      console.log('🧪 HomePage useEffect - No tracks loaded yet, calling fetchTracks()');
      fetchTracks().then(() => {
        console.log('🧪 HomePage useEffect - fetchTracks completed');
      });
    }
  }, [tracks, isLoading, error, fetchTracks]);

  const handleLoginClick = () => {
    setAuthMode('login');
    setShowAuthModal(true);
  };

  const handleRegisterClick = () => {
    setAuthMode('register');
    setShowAuthModal(true);
  };



  return (
    <div className="flex-col">
      <NavBar 
        onLoginClick={handleLoginClick}
        onRegisterClick={handleRegisterClick}
      >
        <div className="flex items-center">
          <h1 className="text-xl font-bold text-gray-900">SoundHaven</h1>
        </div>
      </NavBar>

      <div className="flex min-h-screen">
        <MainContent />
      </div>

      {showAuthModal && (
        <AuthModal 
          initialMode={authMode}
          onClose={() => setShowAuthModal(false)}
        />
      )}



      <Footer />
    </div>
  );
}
