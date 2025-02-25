import { useForm, SubmitHandler } from 'react-hook-form';
import React, { useState } from 'react';
import { useRouter } from 'next/router';

interface ForgotPasswordData {
  email: string;
}

const ForgotPasswordForm: React.FC = () => {
  const { register, handleSubmit } = useForm<ForgotPasswordData>();
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const onSubmit: SubmitHandler<ForgotPasswordData> = async (data) => {
    try {
      // Simulate successful email submission with delay
      setSuccess(true);
      setTimeout(() => {
        // Redirect to create-password page after 2 seconds
        router.push('/create-password');
      }, 2000);

      // Uncomment the following lines when you have server-side implementation
      /*
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          // Redirect to create-password page after 2 seconds
          router.push('/create-password');
        }, 2000);
      }
      */
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="min-w-[390px] sm-md:w-3/4 md:w-3/4 lg:w-3/4 flex flex-col items-center mb-8">
      {success ? (
        <div className="text-green-500 mb-4">Password reset link sent to your email! Redirecting...</div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="text-center w-3/4">
          <input
            {...register('email', { required: true })}
            type="email"
            placeholder="Email"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline mb-8"
          />
          <button className="bg-blue-500 text-white py-3 rounded-lg font-bold text-xl hover:bg-blue-600 shadow appearance-none border w-full leading-tight focus:outline-none focus:shadow-outline">
            Send Reset Link
          </button>
        </form>
      )}
    </div>
  );
};

export default ForgotPasswordForm;
