// src/components/AppProvider.tsx
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useUser as useAuth0User } from '@auth0/nextjs-auth0/client';

// Define the shape of our application's user object
interface AppUser {
  id: string;
  email: string;
  role: 'MANAGER' | 'CARE_WORKER';
}

// Define the shape of our context
interface AppContextType {
  user: AppUser | null;
  isLoading: boolean;
}

// Create the context
const AppContext = createContext<AppContextType>({ user: null, isLoading: true });

// Create the Provider component
export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const { user: auth0User, isLoading: isAuth0Loading } = useAuth0User();
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAppUser = async () => {
      if (auth0User) {
        try {
          // Fetch the user's full profile from our own GraphQL API
          const response = await fetch('/api/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: `query { myUser { id, email, role } }` }),
          });
          const result = await response.json();
          if (result.data?.myUser) {
            setAppUser(result.data.myUser);
          }
        } catch (error) {
          console.error("Failed to fetch app user", error);
        }
      }
      setIsLoading(false);
    };

    if (!isAuth0Loading) {
      fetchAppUser();
    }
  }, [auth0User, isAuth0Loading]);

  return (
    <AppContext.Provider value={{ user: appUser, isLoading }}>
      {children}
    </AppContext.Provider>
  );
};

// Create a custom hook to easily use the context
export const useAppContext = () => useContext(AppContext);