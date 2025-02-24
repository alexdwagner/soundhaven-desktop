"use client";

import React, { ReactNode, useState, useEffect, useRef } from "react";
import { FaBars } from "react-icons/fa";
import { usePlaylists } from "@/app/hooks/UsePlaylists";

interface NavBarProps {
  children: ReactNode;
  onLoginClick: () => void;
  onRegisterClick: () => void;
}

const NavBar: React.FC<NavBarProps> = ({ children, onLoginClick, onRegisterClick }) => {
  const [user, setUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const { clearPlaylists } = usePlaylists();

  useEffect(() => {
    // ✅ Fetch user from Electron backend
    window.electron.getUser().then((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
  }, []);

  const toggleDropdown = () => setShowDropdown(!showDropdown);

  const handleClickOutside = (event: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
      setShowDropdown(false);
    }
  };

  const handleLogout = () => {
    clearPlaylists();
    window.electron.logout();
    setUser(null);
    setShowDropdown(false);
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
    <div className="flex justify-between items-center p-4 bg-gray-100">
      {children}

      {user ? (
        <div className="relative">
          <FaBars className="text-xl cursor-pointer" onClick={toggleDropdown} />
          {showDropdown && (
            <div ref={dropdownRef} className="absolute right-0 mt-2 bg-white border rounded shadow-md p-2">
              <button onClick={() => setShowDropdown(false)} className="block w-full text-left px-4 py-2 hover:bg-gray-100">
                Settings
              </button>
              <button onClick={handleLogout} className="block w-full text-left px-4 py-2 hover:bg-gray-100">
                Logout
              </button>
            </div>
          )}
        </div>
      ) : (
        <div>
          <button onClick={onLoginClick} className="text-blue-500 hover:text-blue-600">
            Log in
          </button>
          <span className="mx-2">/</span>
          <button onClick={onRegisterClick} className="text-blue-500 hover:text-blue-600">
            Register
          </button>
        </div>
      )}
    </div>
  );
};

export default NavBar;
