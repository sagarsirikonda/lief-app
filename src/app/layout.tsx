import React from 'react';
import { UserProvider } from '@auth0/nextjs-auth0/client';
import { AppProvider } from '@/components/AppProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning={true}>
        <UserProvider>
          <AppProvider>
            {children}
          </AppProvider>
        </UserProvider>
      </body>
    </html>
  );
}