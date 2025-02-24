"use client"; // ✅ This makes the component a Client Component

import { useState } from "react";
import GenericModal from "./GenericModal";
import LoginForm from "../auth/LoginForm";
import RegisterForm from "../auth/RegisterForm";

export default function AuthModal() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState<React.ReactNode>(null);

  const toggleModal = () => setIsModalOpen(!isModalOpen);
  const closeModal = () => setIsModalOpen(false);

  const openRegistrationModal = () => {
    setModalContent(
      <RegisterForm onCloseModal={toggleModal} />
    );
    setIsModalOpen(true);
  };

  const openLoginModal = () => {
    setModalContent(<LoginForm onCloseModal={closeModal} />);
    setIsModalOpen(true);
  };

  return (
    <GenericModal isOpen={isModalOpen} onClose={toggleModal}>
      {modalContent}
    </GenericModal>
  );
}
