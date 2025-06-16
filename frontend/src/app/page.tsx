'use client';

import React, { useState } from "react";
import MainContent from "./components/layout/MainContent";
import NavBar from "./components/layout/NavBar";
import Footer from "./components/layout/Footer";
import AuthModal from "./components/modals/AuthModal";

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
      <Footer />
    </div>
  );
}
