"use client";

import { useState, useEffect } from "react";
import GenericModal from "./GenericModal";
import LoginForm from "../auth/LoginForm";
import RegisterForm from "../auth/RegisterForm";

interface AuthModalProps {
  initialMode?: 'login' | 'register';
  onClose: () => void;
}

export default function AuthModal({ initialMode = 'login', onClose }: AuthModalProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

  useEffect(() => {
    setIsModalOpen(true);
  }, []);

  const handleClose = () => {
    setIsModalOpen(false);
    onClose();
  };

  const switchToRegister = () => setMode('register');
  const switchToLogin = () => setMode('login');

  return (
    <GenericModal isOpen={isModalOpen} onClose={handleClose}>
      {mode === 'login' ? (
        <LoginForm 
          onCloseModal={handleClose} 
          onSwitchToRegister={switchToRegister}
        />
      ) : (
        <RegisterForm 
          onCloseModal={handleClose}
          onSwitchToLogin={switchToLogin}
        />
      )}
    </GenericModal>
  );
}
