// src/components/AppProvider.tsx
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useUser as useAuth0User } from '@auth0/nextjs-auth0/client';

interface AppUser {
  id: string;
  email: string;
  role: 'MANAGER' | 'CARE_WORKER';
}

interface AppContextType {
  user: AppUser | null;
  isLoading: boolean;
  error: Error | null;
}

const AppContext = createContext<AppContextType>({ user: null, isLoading: true, error: null });

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const { user: auth0User, isLoading: isAuth0Loading, error: auth0Error } = useAuth0User();
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchAppUser = async () => {
      // If there's an Auth0 error, we can't proceed.
      if (auth0Error) {
        setError(auth0Error);
        setIsLoading(false);
        return;
      }
      
      // If Auth0 is done loading and we have a logged-in user...
      if (auth0User) {
        try {
          // Fetch our user profile from our own database.
          const response = await fetch('/api/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: `query { myUser { id, email, role } }` }),
          });
          const result = await response.json();

          if (result.errors) {
            throw new Error(result.errors[0].message);
          }

          if (result.data?.myUser) {
            setAppUser(result.data.myUser);
          } else {
            // This can happen during the race condition. We'll retry.
            // A simple reload is a robust way to handle this for the user.
            window.location.reload();
          }
        } catch (e: any) {
          setError(e);
        }
      }
      // If we're done loading and there's no user, we're done.
      setIsLoading(false);
    };

    if (!isAuth0Loading) {
      fetchAppUser();
    }
  }, [auth0User, isAuth0Loading, auth0Error]);

  return (
    <AppContext.Provider value={{ user: appUser, isLoading, error }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);