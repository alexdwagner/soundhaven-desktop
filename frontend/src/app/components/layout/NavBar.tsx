"use client";

import React, { ReactNode, useState, useRef, useEffect } from "react";
import { FaBars } from "react-icons/fa";
import { usePlaylists } from "@/app/hooks/UsePlaylists";
import { useAuth } from "@/app/contexts/AuthContext";

// Define a local User type that matches what we expect from the API
interface User {
  id: number;
  email: string;
  name?: string;
  // Add other user properties as needed
}

interface NavBarProps {
  children: ReactNode;
  onLoginClick: () => void;
  onRegisterClick: () => void;
}

const NavBar: React.FC<NavBarProps> = ({ children, onLoginClick, onRegisterClick }) => {
  const { user, loading, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const { clearPlaylists } = usePlaylists();
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    console.log('NavBar: Auth state changed', { user, loading, isInitialLoad });
  }, [user, loading, isInitialLoad]);

  useEffect(() => {
    // Set isInitialLoad to false after the first render
    setIsInitialLoad(false);
  }, []);

  const toggleDropdown = () => setShowDropdown(!showDropdown);

  const handleClickOutside = (event: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
      setShowDropdown(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      clearPlaylists();
      setShowDropdown(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Only show loading state if we're actively logging in (not during initial load)
  if (loading && !isInitialLoad) {
    return <div className="p-4 bg-gray-100 text-center">Logging in...</div>;
  }

  return (
    <nav className="w-full bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            {children}
          </div>
          
          <div className="flex items-center">
            {user ? (
              <div className="relative">
                <button
                  onClick={toggleDropdown}
                  className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 focus:outline-none"
                >
                  <span className="hidden md:inline">{user.name || user.email}</span>
                  <FaBars className="h-5 w-5" />
                </button>
                
                {showDropdown && (
                  <div 
                    ref={dropdownRef}
                    className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5"
                  >
                    <div className="py-1">
                      <button 
                        onClick={() => setShowDropdown(false)}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Settings
                      </button>
                      <button 
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <button
                  onClick={onLoginClick}
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Log in
                </button>
                <button
                  onClick={onRegisterClick}
                  className="bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
                >
                  Register
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
