import React, { useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { FaGoogle } from 'react-icons/fa';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import { useRouter } from 'next/router';
import { login as loginService } from '../../services/apiService';

interface LoginData {
  email: string;
  password: string;
}

const LoginForm: React.FC<{ onCloseModal: () => void }> = ({ onCloseModal }) => {
  const { register, handleSubmit, formState: { errors } } = useForm<LoginData>();
  const { login } = useAuth(); // Destructure login function from useAuth
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit: SubmitHandler<LoginData> = async (data) => {
    try {
      const loginResponse = await login(data.email.toLowerCase(), data.password);
      console.log("Login successful", loginResponse);
      onCloseModal(); // Close the modal directly after login
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to login. Please check your credentials.');
    }
  };

  const handleGoogleLogin = async () => {
    // Implement Google login logic here
    console.log('Login with Google');
    // Logic for Google login
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
      <button onClick={handleGoogleLogin} className="google-button p-6 bg-red-500 text-white py-2 rounded-lg flex items-center justify-center">
        <FaGoogle className="mr-2" /> Sign in with Google
      </button>
      <p className="text-center mt-4 text-gray-700">
        <b>
          Don’t have an Account?{' '}
          <Link href="/register">
            <span className="text-blue-500 hover:underline">Sign up.</span>
          </Link>
        </b>
      </p>
    </div>
  );
};

export default LoginForm;
