import { createHash, randomBytes } from 'crypto';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClerkService } from '../auth/clerk.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateInviteDto } from './dto/create-invite.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';

const INVITE_TTL_DAYS = 7;

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Company creation + invite flow (API spec).
 *
 * - POST /companies: only for a verified Clerk user with no
 *   FieldSync user row yet; they become ADMIN of the new company.
 *   Email/name come from Clerk (see ClerkService.getProfile),
 *   never from the client body, so a client cannot claim
 *   someone else's email.
 * - POST /companies/:id/invites: Admin only (enforced by
 *   RolesGuard + CompanyGuard in the controller). The raw token
 *   is returned exactly once, at creation; only its SHA-256 hash
 *   is stored, so a database read cannot be used to accept an
 *   invite. No email is sent yet — that is a later slice; the
 *   caller must deliver the returned token/link.
 * - POST /invites/accept: token possession is the proof. An
 *   expired invite is marked EXPIRED and rejected with 422;
 *   a used invite is rejected with 409; an unknown token is 404.
 */
@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clerk: ClerkService,
  ) {}

  async createCompany(clerkUserId: string, dto: CreateCompanyDto) {
    const existing = await this.prisma.user.findUnique({ where: { clerkUserId } });
    if (existing) {
      throw new HttpException(
        { error: { code: 'ALREADY_LINKED', message: 'User is already linked to a company' } },
        HttpStatus.CONFLICT,
      );
    }
    const profile = await this.clerk.getProfile(clerkUserId);
    const result = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: { name: dto.name, timezone: dto.timezone },
      });
      const user = await tx.user.create({
        data: {
          clerkUserId,
          email: profile.email,
          name: profile.name,
          companyId: company.id,
          role: 'ADMIN',
        },
      });
      return { company, user };
    });
    return {
      id: result.company.id,
      name: result.company.name,
      timezone: result.company.timezone,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
      },
    };
  }

  async createInvite(companyId: string, invitedById: string, dto: CreateInviteDto) {
    const pending = await this.prisma.invite.findFirst({
      where: {
        companyId,
        email: { equals: dto.email, mode: 'insensitive' },
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    });
    if (pending) {
      throw new HttpException(
        { error: { code: 'INVITE_ALREADY_PENDING', message: 'A pending invite already exists for this email' } },
        HttpStatus.CONFLICT,
      );
    }
    const token = randomBytes(32).toString('hex');
    const invite = await this.prisma.invite.create({
      data: {
        companyId,
        email: dto.email,
        role: dto.role,
        tokenHash: hashInviteToken(token),
        status: 'PENDING',
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
        invitedById,
      },
    });
    // Token is returned exactly once, here. It is never stored
    // in plain text and never returned again.
    return {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      expiresAt: invite.expiresAt,
      token,
    };
  }

  async acceptInvite(clerkUserId: string, dto: AcceptInviteDto) {
    const invite = await this.prisma.invite.findUnique({
      where: { tokenHash: hashInviteToken(dto.token) },
    });
    if (!invite) {
      throw new HttpException(
        { error: { code: 'NOT_FOUND', message: 'Invite not found' } },
        HttpStatus.NOT_FOUND,
      );
    }
    if (invite.status !== 'PENDING') {
      throw new HttpException(
        { error: { code: 'INVITE_ALREADY_USED', message: 'Invite has already been used' } },
        HttpStatus.CONFLICT,
      );
    }
    if (invite.expiresAt < new Date()) {
      await this.prisma.invite.update({
        where: { id: invite.id },
        data: { status: 'EXPIRED' },
      });
      throw new HttpException(
        { error: { code: 'INVITE_EXPIRED', message: 'Invite has expired' } },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const existing = await this.prisma.user.findUnique({ where: { clerkUserId } });
    if (existing) {
      throw new HttpException(
        { error: { code: 'ALREADY_LINKED', message: 'User is already linked to a company' } },
        HttpStatus.CONFLICT,
      );
    }
    let name = dto.name ?? invite.email.split('@')[0];
    try {
      const profile = await this.clerk.getProfile(clerkUserId);
      name = dto.name ?? profile.name;
    } catch {
      // Clerk profile is a nice-to-have here: the invite email
      // is authoritative, and the name fallback above is safe.
    }
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          clerkUserId,
          email: invite.email,
          name,
          companyId: invite.companyId,
          role: invite.role,
        },
      });
      const updated = await tx.invite.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED', acceptedUserId: user.id },
      });
      return { user, invite: updated };
    });
    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        companyId: result.user.companyId,
      },
      invite: { id: result.invite.id, status: result.invite.status },
    };
  }
}
