import React from "react";

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-200 text-gray-600 body-font">
      <div className="container px-5 py-4 mx-auto flex items-center justify-between">
        <p className="text-sm text-gray-500">
          © {new Date().getFullYear()} SoundHaven —{" "}
          <span className="text-gray-600">@alexdwagner</span>
        </p>
        <div className="flex space-x-4">
          {/* Placeholder for future icons */}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
