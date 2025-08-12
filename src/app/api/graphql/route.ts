// src/app/api/graphql/route.ts
import { getSession } from '@auth0/nextjs-auth0';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { server } from '@/lib/apollo-server'; // Import the server from our separate file

// This is the new, simplified handler function
async function handler(req: NextRequest) {
    // 1. Get the user session first
    let userContext = null;
    try {
        const session = await getSession();
        if (session && session.user && session.user.sub) {
            const auth0User = session.user;
            let user = await prisma.user.findUnique({ where: { auth0Id: auth0User.sub } });
            if (!user) {
                const defaultOrg = await prisma.organization.findFirst();
                if (!defaultOrg) {
                    const newOrg = await prisma.organization.create({
                        data: { name: `${auth0User.name || 'My'} Organization`, latitude: 0, longitude: 0, perimeterRadius: 2 },
                    });
                    user = await prisma.user.create({
                        data: { auth0Id: auth0User.sub, email: auth0User.email || `${auth0User.sub}@example.com`, role: 'MANAGER', organizationId: newOrg.id },
                    });
                } else {
                    user = await prisma.user.create({
                        data: { auth0Id: auth0User.sub, email: auth0User.email || `${auth0User.sub}@example.com`, role: 'CARE_WORKER', organizationId: defaultOrg.id },
                    });
                }
            }
            userContext = { user };
        }
    } catch (error) {
        console.error("CRITICAL ERROR in context creation:", error);
        return new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
    }

    // 2. Execute the GraphQL operation manually
    const body = await req.json();
    const response = await server.executeOperation(
        {
            query: body.query,
            variables: body.variables,
        },
        {
            contextValue: userContext,
        }
    );

    // 3. Return the response, with a type check
    if (response.body.kind === 'single') {
        return new NextResponse(JSON.stringify(response.body.singleResult), {
            headers: { 'Content-Type': 'application/json' },
        });
    } else {
        // Handle the case of an incremental/streaming response if necessary
        // For this app, we can just return an error.
        return new NextResponse(JSON.stringify({ error: 'Unsupported response type' }), { status: 500 });
    }
}

export { handler as GET, handler as POST };