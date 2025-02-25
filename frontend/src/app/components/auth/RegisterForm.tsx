import React, { useState, useContext } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { FaGoogle } from 'react-icons/fa';
import { AuthContext } from '@/app/contexts/AuthContext';
import { register as registerUser } from '../../services/apiService';

interface RegisterData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}
const RegisterForm: React.FC<{ onSuccess: () => void, onCloseModal: () => void }> = ({ onSuccess, onCloseModal }) => {
  const { register: formRegister, handleSubmit, formState: { errors }, getValues } = useForm<RegisterData>();
  const authContext = useContext(AuthContext);
  const [registerError, setRegisterError] = useState<string>('');

  const onSubmit: SubmitHandler<RegisterData> = async (data) => {
    if (data.password !== data.confirmPassword) {
      setRegisterError("Passwords don't match");
      return;
    }
  
    if (!authContext) {
      console.error('Auth context is not available');
      return;
    }
  
    try {
      // Convert email to lowercase for consistency
      const emailLowercase = data.email.toLowerCase();
  
      const payload = {
        email: emailLowercase,
        password: data.password,
        ...(data.name && { name: data.name })
      };
  
      console.log("Registration Payload:", payload);
  
      await registerUser(payload);
      console.log("User registered, attempting to log in");
  
      if (authContext.login) {
        console.log("Logging in with credentials");
        await authContext.login(emailLowercase, data.password); // Use lowercase email for login
      }
  
      console.log("Login process completed, calling onSuccess");
      onSuccess();
    } catch (error) {
      if (error instanceof Error) {
        setRegisterError(error.message || 'Registration failed. Please try again.');
      } else {
        setRegisterError('An unexpected error occurred.');
      }
    }
  };
  
  const handleGoogleRegister = () => {
    // Implement Google registration logic here
    console.log('Register with Google - Implementation required');
  };

  return (
    <div>
      {registerError && <div className="error">{registerError}</div>}
      <form onSubmit={handleSubmit(onSubmit)} className="text-center w-3/4">
        <input
          {...formRegister('name', { required: 'Name is required' })}
          type="text"
          placeholder="Name"
          className="input-field"
        />
        {errors.name && <span className="error-message">{errors.name.message}</span>}

        <input
          {...formRegister('email', { required: 'Email is required' })}
          type="email"
          placeholder="Email"
          className="input-field"
        />
        {errors.email && <span className="error-message">{errors.email.message}</span>}

        <input
          {...formRegister('password', {
            required: 'Password is required',
            minLength: {
              value: 8,
              message: 'Password must be at least 8 characters long'
            },
          })}
          type="password"
          placeholder="Password"
          className="input-field"
        />
        {errors.password && <span className="error-message">{errors.password.message}</span>}

        <input
          {...formRegister('confirmPassword', {
            required: 'Please confirm your password',
            validate: value => value === getValues('password') || "Passwords don't match",
          })}
          type="password"
          placeholder="Confirm Password"
          className="input-field"
        />
        {errors.confirmPassword && <span className="error-message">{errors.confirmPassword.message}</span>}

        <button type="submit" className="submit-button">Sign Up</button>
      </form>
      <p className="text-center my-8 text-gray-700">
        <b>Or register with:</b>
      </p>
      <button onClick={handleGoogleRegister} className="google-button">
        <FaGoogle className="mr-2" /> Sign in with Google
      </button>
    </div>
  );
};

export default RegisterForm;
