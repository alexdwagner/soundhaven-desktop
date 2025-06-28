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
  const [testResult, setTestResult] = useState<string>('');
  
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

  const testGetTracks = async () => {
    console.log('🧪 Manual test: Calling apiService.getTracks()...');
    try {
      const response = await apiService.getTracks();
      console.log('🧪 Manual test: Response:', response);
      setTestResult(JSON.stringify(response, null, 2));
    } catch (error) {
      console.error('🧪 Manual test: Error:', error);
      setTestResult(`Error: ${error}`);
    }
  };

  return (
    <div className="flex-col">
      <NavBar 
        onLoginClick={handleLoginClick}
        onRegisterClick={handleRegisterClick}
      />

      <div className="flex min-h-screen">
        <MainContent />
      </div>

      {showAuthModal && (
        <AuthModal 
          initialMode={authMode}
          onClose={() => setShowAuthModal(false)}
        />
      )}

      {/* Debug Panel */}
      <div className="bg-yellow-100 p-4 border-b">
        <h3 className="font-bold mb-2">🧪 Debug Panel</h3>
        <button 
          onClick={testGetTracks}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Test getTracks API
        </button>
        {testResult && (
          <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-40">
            {testResult}
          </pre>
        )}
        
        <div className="mt-4">
          <h4 className="font-semibold">Tracks from Context:</h4>
          <div className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-40">
            {isLoading ? (
              <p>Loading tracks...</p>
            ) : error ? (
              <p className="text-red-500">Error: {error}</p>
            ) : tracks.length > 0 ? (
              <ul>
                {tracks.map(track => (
                  <li key={track.id} className="mb-1">
                    {track.name} ({track.id})
                  </li>
                ))}
              </ul>
            ) : (
              <p>No tracks found</p>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
