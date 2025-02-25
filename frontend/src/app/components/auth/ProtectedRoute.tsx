// src/components/ProtectedRoute.tsx
import React from 'react';
import { Route, Redirect, RouteProps } from 'react-router-dom';
import { useAuth } from '@/app/contexts/AuthContext';

interface ProtectedRouteProps extends RouteProps {
  component: React.ComponentType<any>;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ component: Component, ...rest }) => {
  const { user } = useAuth();

  return (
    <Route
      {...rest}
      render={props => 
        user ? <Component {...props} /> : <Redirect to="/login" />
      }
    />
  );
};

export default ProtectedRoute;
