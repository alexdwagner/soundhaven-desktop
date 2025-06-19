import React, { useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { FaGoogle } from 'react-icons/fa';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import { useRouter } from 'next/router';
import { apiService } from '@/services/electronApiService';


interface LoginData {
  email: string;
  password: string;
}

const LoginForm: React.FC<{ onCloseModal: () => void }> = ({ onCloseModal }) => {
  const { register, handleSubmit, formState: { errors } } = useForm<LoginData>();
  const { login } = useAuth(); // Destructure login function from useAuth
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isTestUserLoading, setIsTestUserLoading] = useState(false);

  const onSubmit: SubmitHandler<LoginData> = async (data) => {
    try {
      const loginResponse = await login(data.email.toLowerCase(), data.password);
      console.log("Login successful", loginResponse);
      onCloseModal(); // Close the modal directly after login
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err?.message || 'Failed to login. Please check your credentials.');
    }
  };

  const handleGoogleLogin = async () => {
    // Implement Google login logic here
    console.log('Login with Google');
    // Logic for Google login
  };

  const handleTestUserLogin = async () => {
    try {
      console.log('Starting test user login...');
      setIsTestUserLoading(true);
      const user = await login('test@example.com', 'testpassword');
      console.log('Test user login result:', user);
      if (user) {
        onCloseModal();
      } else {
        throw new Error('Login failed - no user returned');
      }
    } catch (err: any) {
      console.error('Test user login error:', err);
      setError('Failed to log in as test user. Please try again.');
    } finally {
      setIsTestUserLoading(false);
    }
  };

  return (
    <div className="min-w-[390px] sm-md:w-3/4 md:w-3/4 lg:w-3/4 flex flex-col items-center mb-8">
      {error && <div className="text-red-500 mb-4">{error}</div>}
      <form onSubmit={handleSubmit(onSubmit)} className="text-center w-3/4">
        <input
          {...register('email', { required: 'Email is required' })}
          type="text"
          placeholder="Email"
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline mb-4"
        />
        {errors.email && <p className="text-red-500 text-sm">{errors.email.message}</p>}
        <div className="relative">
          <input
            {...register('password', { required: 'Password is required' })}
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline mb-6"
          />
          {errors.password && <p className="text-red-500 text-sm">{errors.password.message}</p>}
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute top-3 right-3 text-gray-600">
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        <button type="submit" className="bg-blue-500 text-white py-3 rounded-lg font-bold text-xl hover:bg-blue-600 w-full">
          Login
        </button>
      </form>
      <p className="text-center my-8 text-gray-700">
        <b>Or log in with:</b>
      </p>
      <button 
        onClick={handleGoogleLogin} 
        className="mb-4 google-button p-6 bg-red-500 text-white py-2 rounded-lg flex items-center justify-center w-full"
      >
        <FaGoogle className="mr-2" /> Sign in with Google
      </button>
      <button 
        onClick={handleTestUserLogin} 
        disabled={isTestUserLoading}
        className="bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold text-xl w-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
      >
        {isTestUserLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Logging in...
          </>
        ) : 'Log in as Test User'}
      </button>
      <p className="text-center mt-4 text-gray-700">
        <b>
          Don't have an Account?{' '}
          <Link href="/register">
            <span className="text-blue-500 hover:underline">Sign up.</span>
          </Link>
        </b>
      </p>
    </div>
  );
};

export default LoginForm;
