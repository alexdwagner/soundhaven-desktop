import { useForm, SubmitHandler } from 'react-hook-form';
import React, { useState } from 'react';
import { useRouter } from 'next/router';

interface CreatePasswordData {
  newPassword: string;
  confirmPassword: string;
}

const CreatePasswordForm: React.FC = () => {
  const { register, handleSubmit, formState, getValues } = useForm<CreatePasswordData>();
  const { errors } = formState;
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const onSubmit: SubmitHandler<CreatePasswordData> = async (data) => {
    if (data.newPassword !== data.confirmPassword) {
      console.error("Passwords don't match");
      return;
    }

    try {
      // Simulate successful password update without making an actual HTTP request
      // Uncomment the following lines when you have server-side implementation
      /*
      const response = await fetch('/api/create-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setSuccess(true);
        router.push('/posts');
      }
      */

      // Simulate successful password update
      setSuccess(true);
      router.push('/posts');
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="min-w-[390px] sm-md:w-3/4 md:w-3/4 lg:w-3/4 flex flex-col items-center mb-8">
      {success && <div className="text-green-500 mb-4">Password updated successfully!</div>}
      <form onSubmit={handleSubmit(onSubmit)} className="text-center w-3/4">
        <input
          {...register('newPassword', { required: true, minLength: 8 })}
          type="password"
          placeholder="New Password"
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline mb-4"
        />
        <input
          {...register('confirmPassword', { required: true, validate: value => value === getValues('newPassword') || "Passwords don't match" })}
          type="password"
          placeholder="Confirm Password"
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline mb-8"
        />
        {errors.confirmPassword && <span className="text-red-500">{errors.confirmPassword.message}</span>}
        <button className="bg-blue-500 text-white py-3 rounded-lg font-bold text-xl hover:bg-blue-600 shadow appearance-none border w-full leading-tight focus:outline-none focus:shadow-outline">
          Update Password
        </button>
      </form>
    </div>
  );
};

export default CreatePasswordForm;
