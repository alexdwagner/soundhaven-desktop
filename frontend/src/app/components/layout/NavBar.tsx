"use client";

import React, { ReactNode, useState, useEffect, useRef } from "react";
import { FaBars } from "react-icons/fa";
import { usePlaylists } from "@/app/hooks/UsePlaylists";
import { apiService } from "@/services/electronApiService";

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
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const { clearPlaylists } = usePlaylists();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const storedUser = apiService.getStoredUser();
        if (storedUser) {
          setUser(storedUser);
          return;
        }

        // If no stored user, try to refresh the token
        const token = apiService.getToken();
        if (!token) {
          setLoading(false);
          return;
        }

        try {
          const userId = JSON.parse(atob(token.split('.')[1])).id;
          const response = await apiService.getUserById(userId);
          if (response) {
            // The response might be the user object directly or in a data property
            const userData = (typeof response === 'object' && 'data' in response 
              ? response.data 
              : response) as Partial<User>;
              
            if (userData && 
                typeof userData === 'object' && 
                'id' in userData && 
                'email' in userData &&
                typeof userData.id === 'number' &&
                typeof userData.email === 'string') {
              setUser({
                id: userData.id,
                email: userData.email,
                name: userData.name || undefined
              });
            }
          }
        } catch (tokenError) {
          console.error('Error refreshing user:', tokenError);
        }
      } catch (error) {
        console.error('Error in fetchUser:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const toggleDropdown = () => setShowDropdown(!showDropdown);

  const handleClickOutside = (event: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
      setShowDropdown(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiService.logout();
      clearPlaylists();
      setUser(null);
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

  if (loading) {
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
