import { ApolloServer } from '@apollo/server';
import { gql } from 'graphql-tag';
import { prisma } from '@/lib/prisma';
import { User as PrismaUser, Shift as PrismaShift } from '@prisma/client';

// Helper function to calculate distance
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

const typeDefs = gql`
  type User { id: String!, email: String!, role: String! }
  type Shift { id: String!, clockIn: String!, clockOut: String, clockInNote: String, clockOutNote: String }
  type Organization { id: String!, name: String!, latitude: Float!, longitude: Float!, perimeterRadius: Float! }
  type DailyStat { date: String!, avgHours: Float!, clockInCount: Int! }
  type StaffWeeklyHours { email: String!, totalHours: Float! }
  type DashboardStats { dailyStats: [DailyStat!], staffWeeklyHours: [StaffWeeklyHours!] }
  type Query { myCurrentShift: Shift, myUser: User, organizationUsers: [User!], activeStaff: [User!], userShifts(userId: String!): [Shift!], dashboardStats: DashboardStats }
  type Mutation { clockIn(note: String, latitude: Float, longitude: Float): Shift, clockOut(shiftId: String!, note: String): Shift, updateOrganizationLocation(latitude: Float!, longitude: Float!, perimeterRadius: Float!): Organization }
`;


const resolvers = {
  Query: {
    myCurrentShift: async (_parent: any, _args: any, context: any) => {
      if (!context.user) throw new Error("Unauthorized: You must be logged in.");
      const activeShift = await prisma.shift.findFirst({ where: { userId: context.user.id, clockOut: null }, orderBy: { clockIn: 'desc' } });
      if (!activeShift) return null;
      return { ...activeShift, clockIn: activeShift.clockIn.toISOString(), clockOut: activeShift.clockOut?.toISOString() };
    },
    myUser: async (_parent: any, _args: any, context: any) => {
      if (!context.user) throw new Error("Unauthorized: You must be logged in.");;
      return context.user;
    },
    organizationUsers: async (_parent: any, _args: any, context: any) => {
      if (!context.user || context.user.role !== 'MANAGER') throw new Error("Unauthorized");
      return prisma.user.findMany({ where: { organizationId: context.user.organizationId } });
    },
    userShifts: async (_parent: any, { userId }: { userId: string }, context: any) => {
      if (!context.user || context.user.role !== 'MANAGER') throw new Error("Unauthorized");
      const requestedUser = await prisma.user.findUnique({ where: { id: userId } });
      if (!requestedUser || requestedUser.organizationId !== context.user.organizationId) {
        throw new Error("Cannot fetch shifts for a user outside your organization.");
      }
      const shifts = await prisma.shift.findMany({ where: { userId: userId }, orderBy: { clockIn: 'desc' } });
      return shifts.map((shift: PrismaShift) => ({ ...shift, clockIn: shift.clockIn.toISOString(), clockOut: shift.clockOut?.toISOString() }));
    },
    dashboardStats: async (_parent: any, _args: any, context: any) => {
      if (!context.user || context.user.role !== 'MANAGER') {
        throw new Error("Unauthorized");
      }

      const orgId = context.user.organizationId;
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      oneWeekAgo.setHours(0, 0, 0, 0); // Start from the beginning of the day

      const shifts = await prisma.shift.findMany({
        where: {
          user: { organizationId: orgId },
          clockIn: { gte: oneWeekAgo },
        },
        include: { user: true },
      });

      // --- Staff Weekly Hours Calculation (Unchanged) ---
      const completedShifts = shifts.filter(s => s.clockOut);
      type ShiftWithUser = PrismaShift & { user: PrismaUser };
      const hoursByUser = completedShifts.reduce((acc: Record<string, number>, shift: ShiftWithUser) => {
          if (shift.clockOut) {
              const hours = (shift.clockOut.getTime() - shift.clockIn.getTime()) / (1000 * 60 * 60);
              acc[shift.user.email] = (acc[shift.user.email] || 0) + hours;
          }
          return acc;
      }, {});
      const staffWeeklyHours = Object.entries(hoursByUser).map(([email, totalHours]) => ({ email, totalHours: parseFloat((totalHours as number).toFixed(2)) }));

      // --- Daily Stats Calculation (Updated Logic) ---
      const dailyStatsMap: Map<string, { totalHours: number, count: number }> = new Map();
      
      // Initialize the map with the last 7 days to ensure a full week of data
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateString = d.toISOString().split('T')[0];
        dailyStatsMap.set(dateString, { totalHours: 0, count: 0 });
      }

      shifts.forEach(shift => {
        const date = shift.clockIn.toISOString().split('T')[0];
        const entry = dailyStatsMap.get(date) || { totalHours: 0, count: 0 };
        entry.count++;
        if (shift.clockOut) {
          const hours = (shift.clockOut.getTime() - shift.clockIn.getTime()) / (1000 * 60 * 60);
          entry.totalHours += hours;
        }
        dailyStatsMap.set(date, entry);
      });
      
      const dailyStats = Array.from(dailyStatsMap.entries()).map(([date, data]) => ({
        date,
        clockInCount: data.count,
        avgHours: data.count > 0 ? parseFloat((data.totalHours / data.count).toFixed(2)) : 0,
      })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort by date

      return { staffWeeklyHours, dailyStats };
    },
    activeStaff: async (_parent: any, _args: any, context: any) => {
      if (!context.user || context.user.role !== 'MANAGER') {
        throw new Error("Unauthorized");
      }
      // This is an efficient query to find users who have at least one shift
      // that has not been clocked out of yet.
      return prisma.user.findMany({
        where: {
          organizationId: context.user.organizationId,
          shifts: {
            some: {
              clockOut: null,
            },
          },
        },
      });
    },
  },
  Mutation: {
    clockIn: async (_parent: any, { note, latitude, longitude }: { note?: string, latitude?: number, longitude?: number }, context: any) => {
      if (!context.user) throw new Error("Unauthorized");
      const existingShift = await prisma.shift.findFirst({ where: { userId: context.user.id, clockOut: null } });
      if (existingShift) throw new Error("You are already clocked in.");
      const organization = await prisma.organization.findUnique({ where: { id: context.user.organizationId } });
      if (!organization) throw new Error("Could not find your organization's settings.");
      if (latitude && longitude) {
        const distance = haversineDistance(latitude, longitude, organization.latitude, organization.longitude);
        if (distance > organization.perimeterRadius) {
          throw new Error(`You are too far from the location. You are ${distance.toFixed(2)}km away, but need to be within ${organization.perimeterRadius}km.`);
        }
      } else {
        throw new Error("Location permission is required to clock in.");
      }
      const newShift = await prisma.shift.create({ data: { clockIn: new Date(), userId: context.user.id, clockInNote: note, clockInLatitude: latitude, clockInLongitude: longitude } });
      return { ...newShift, clockIn: newShift.clockIn.toISOString(), clockOut: newShift.clockOut?.toISOString() };
    },
    clockOut: async (_parent: any, { shiftId, note }: { shiftId: string; note?: string }, context: any) => {
      if (!context.user) throw new Error("Unauthorized");
      const shiftToUpdate = await prisma.shift.findUnique({ where: { id: shiftId } });
      if (!shiftToUpdate || shiftToUpdate.userId !== context.user.id) throw new Error("Shift not found or you're not authorized to clock out.");
      if (shiftToUpdate.clockOut) throw new Error("This shift has already been clocked out.");
      const updatedShift = await prisma.shift.update({
        where: { id: shiftId },
        data: { clockOut: new Date(), clockOutNote: note },
      });
      return { ...updatedShift, clockIn: updatedShift.clockIn.toISOString(), clockOut: updatedShift.clockOut?.toISOString() };
    },
    updateOrganizationLocation: async (_parent: any, { latitude, longitude, perimeterRadius }: { latitude: number, longitude: number, perimeterRadius: number }, context: any) => {
      if (!context.user || context.user.role !== 'MANAGER') {
        throw new Error("Unauthorized: Only managers can perform this action.");
      }
      const updatedOrg = await prisma.organization.update({
        where: { id: context.user.organizationId },
        data: { latitude, longitude, perimeterRadius },
      });
      return updatedOrg;
    },
  },
};


export const server = new ApolloServer({
    typeDefs,
    resolvers,
});