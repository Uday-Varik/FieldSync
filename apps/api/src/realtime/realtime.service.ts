import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

/**
 * Phase 3 realtime hub. The gateway (jobs.gateway.ts)
 * registers the Socket.io server here on init; services
 * emit through this hub instead of depending on the
 * gateway directly, which would create a module cycle
 * (JobsModule -> RealtimeModule -> JobsModule).
 *
 * With no server attached (unit tests, or a worker
 * process), every emit is a no-op — services must never
 * fail a job mutation because nobody is listening.
 * Rooms: `company:<companyId>` for everyone in the
 * company, `job:<jobId>` for a job's detail viewers.
 * A single API instance is assumed in MVP (no Redis
 * adapter); a Redis adapter is the scaling step, not a
 * Phase 3 requirement.
 */
@Injectable()
export class RealtimeService {
  private server: Server | null = null;
  private presence = new Map<string, Map<string, { userId: string; name: string; role: string }>>();

  setServer(server: Server) {
    this.server = server;
  }

  emitJobUpdated(companyId: string, jobId: string, status?: string, version?: number) {
    if (!this.server) return;
    this.server.to(`company:${companyId}`).emit('job:updated', {
      jobId,
      status,
      version,
      at: new Date().toISOString(),
    });
  }

  trackPresence(companyId: string, socketId: string, user: { userId: string; name: string; role: string }) {
    let room = this.presence.get(companyId);
    if (!room) {
      room = new Map();
      this.presence.set(companyId, room);
    }
    room.set(socketId, user);
    return this.presenceList(companyId);
  }

  untrackPresence(companyId: string, socketId: string) {
    this.presence.get(companyId)?.delete(socketId);
    return this.presenceList(companyId);
  }

  presenceList(companyId: string) {
    const room = this.presence.get(companyId);
    if (!room) return [];
    const seen = new Map<string, { userId: string; name: string; role: string }>();
    for (const user of room.values()) seen.set(user.userId, user);
    return [...seen.values()];
  }

  emitPresence(companyId: string) {
    if (!this.server) return;
    this.server.to(`company:${companyId}`).emit('presence', { users: this.presenceList(companyId) });
  }
}
