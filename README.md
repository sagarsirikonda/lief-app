Lief - Shift Clock-In Application
Overview

This is a full-stack web application built for the Lief WebDev Engineer Task (March 2025). This web application is a location-based, contemporary time-tracking application to be used by healthcare organizations. It enables care workers to clock on and off their shifts within a physical defined geographical area and offers managers with the means to monitor staff engagement and assess shift information via an all-encompassing central display.

It is developed using a modern tech stack, like a Next.js frontend, GraphQL API backend, PostgraSQL database with Prisma as the ORM and the integration of authentication through Auth0.

Features Implemented

This project successfully implements all the required features as outlined in the task document.
✅ Manager Features

    [x] Set Location Perimeter: Managers can define a central latitude/longitude and a radius in kilometers, creating a geofence for clock-in eligibility.

    [x] See Clocked-In Staff: The dashboard includes a table showing a real-time list of all staff members who are currently clocked in.

    [x] View Staff Shift History: Managers can view a complete, detailed shift history for any staff member, including clock-in/out times and notes.

    [x] Analytics Dashboard: The dashboard features a graphical interface with key metrics:

        [x] A line chart showing the number of clock-ins per day over the last week.

        [x] A bar chart visualizing the total hours clocked per staff member over the last week.

✅ Care Worker Features

    [x] Clock In: Care workers can clock in, but only if their current location is within the organization's set perimeter.

    [x] Geofence Enforcement: The application correctly verifies the user's location and provides a clear error message if they are outside the allowed radius.

    [x] Optional Notes: Users can provide optional notes when clocking in and out.

    [x] Clock Out: Users can clock out of an active shift.

✅ General Features

    [x] User Authentication: Full authentication flow using Auth0, including signup, login (with email/password and social providers like Google), and logout.

    [x] UI/UX: The application has a clean, professional, and responsive user interface built with the Ant Design library.

Tech Stack

The application was built using the recommended tech stack:

    Frontend: Next.js (with App Router) & React

    UI Library: Ant Design

    State Management: React Context (via a custom AppProvider)

    Backend API: GraphQL (with Apollo Server)

    Database ORM: Prisma

    Database: PostgreSQL (hosted on Vercel)

    Authentication: Auth0

    Analytics & Charting: Chart.js

Codebase Structure

The codebase is organized within the src directory, following modern Next.js conventions.

    src/app/: Contains all the application's routes.

        src/app/page.tsx: The main landing page.

        src/app/dashboard/page.tsx: The dashboard for the Care Worker role.

        src/app/manager/page.tsx: The dashboard for the Manager role.

        src/app/api/: Contains all backend API routes.

            src/app/api/auth/[auth0]/route.ts: Handles all Auth0 authentication routes (login, logout, callback).

            src/app/api/graphql/route.ts: The single endpoint for the entire GraphQL API. This file contains all the type definitions, resolvers, and business logic for the application.

        src/app/layout.tsx: The root layout for the application, which includes the main providers.

    src/components/: Contains shared React components.

        src/components/AppProvider.tsx: A crucial client-side provider that fetches the user's full profile (including their role from our database) and makes it available throughout the app. This solves potential race conditions and ensures the UI always has the correct user data.

    prisma/: Contains all database-related files.

        prisma/schema.prisma: The heart of the backend. This file defines the entire database schema, including all models (User, Shift, Organization) and their relationships.

        prisma/migrations/: Contains the auto-generated SQL migration files that track the evolution of the database schema.

Getting Started (Local Setup)

To run this project locally, follow these steps:

    Clone the repository:

    git clone <repository-url>
    cd <project-folder>

    Install dependencies:

    npm install

    Set up environment variables:

        Create a .env file in the root of the project.

        Add the necessary variables for your Database (DATABASE_URL, DIRECT_URL) and Auth0 (AUTH0_SECRET, AUTH0_BASE_URL, etc.).

    Set up the database:

        This project uses two database URLs in the .env file (DATABASE_URL for the app and DIRECT_URL for migrations).

        To create the database tables, run the following command. It will automatically use the correct DIRECT_URL.

        npx prisma migrate reset --skip-seed

    Run the development server:

    npm run dev

The application will be available at https://lief-shifts-app.vercel.app.