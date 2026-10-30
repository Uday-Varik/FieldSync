import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { ClerkService } from '../auth/clerk.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from './realtime.service';

/**
 * Phase 3 Socket.io gateway.
 *
 * Auth on connect (no anonymous sockets): the client
 * sends its Clerk session token in handshake.auth.token.
 * The token is verified with Clerk, then the matching
 * FieldSync user row is loaded; unknown, inactive, or
 * unlinked users are disconnected immediately. The
 * socket then joins `company:<companyId>` and presence
 * is broadcast to that room.
 *
 * Job rooms are opt-in per job detail page:
 * `join-job` checks the job belongs to the caller's
 * company (technicians only on assigned jobs, 404
 * otherwise, mirroring the REST scoping).
 */
@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class JobsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly clerk: ClerkService,
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit(server: Server) {
    this.realtime.setServer(server);
  }

  async handleConnection(client: Socket) {
    try {
      const token = (client.handshake.auth?.token as string | undefined) ?? (client.handshake.query?.token as string | undefined);
      if (!token) throw new Error('No token');
      const clerkUserId = await this.clerk.verify(token);
      const user = await this.prisma.user.findFirst({ where: { clerkUserId, isActive: true } });
      if (!user || !user.companyId) throw new Error('User not linked');
      client.data.user = { userId: user.id, companyId: user.companyId, role: user.role, name: user.name };
      await client.join(`company:${user.companyId}`);
      this.realtime.trackPresence(user.companyId, client.id, { userId: user.id, name: user.name, role: user.role });
      this.realtime.emitPresence(user.companyId);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const user = client.data?.user;
    if (!user?.companyId) return;
    this.realtime.untrackPresence(user.companyId, client.id);
    this.realtime.emitPresence(user.companyId);
  }

  @SubscribeMessage('join-job')
  async joinJob(@ConnectedSocket() client: Socket, @MessageBody() body: { jobId?: string }) {
    const user = client.data?.user;
    if (!user || !body?.jobId) return { ok: false };
    const job = await this.prisma.job.findFirst({ where: { id: body.jobId, companyId: user.companyId } });
    if (!job) return { ok: false };
    if (user.role === 'TECHNICIAN' && job.assignedTechnicianId !== user.userId) return { ok: false };
    await client.join(`job:${job.id}`);
    return { ok: true };
  }

  @SubscribeMessage('leave-job')
  async leaveJob(@ConnectedSocket() client: Socket, @MessageBody() body: { jobId?: string }) {
    if (body?.jobId) await client.leave(`job:${body.jobId}`);
    return { ok: true };
  }
}
