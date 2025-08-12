// src/app/api/graphql/route.ts
import { startServerAndCreateNextHandler } from '@as-integrations/next';
import { getSession } from '@auth0/nextjs-auth0';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { server } from '@/lib/apollo-server';

// This handler is now simple and easy for Vercel to understand
const handler = startServerAndCreateNextHandler<NextRequest>(server, {
    context: async (req) => {
        try {
            const session = await getSession(req, {} as any);
            if (!session || !session.user) {
                return { user: null };
            }
            const auth0User = session.user;
            if (!auth0User.sub) return { user: null };

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
            return { user };
        } catch (error) {
            console.error("Error in context creation:", error);
            return { user: null };
        }
    },
});

export { handler as GET, handler as POST };