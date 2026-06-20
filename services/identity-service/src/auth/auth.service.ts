import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';

const BCRYPT_SALT_ROUNDS = 12;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SafeUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: SafeUser; tokens: AuthTokens }> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      role: dto.role,
      facilityKmhflCode: dto.facilityKmhflCode,
    });

    return { user: toSafeUser(user), tokens: this.issueTokens(user) };
  }

  async login(dto: LoginDto): Promise<{ user: SafeUser; tokens: AuthTokens }> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);

    // Deliberately identical error for "no such user" and "wrong password" —
    // distinguishing the two in the response lets an attacker enumerate
    // valid accounts.
    const invalidCredentials = () =>
      new UnauthorizedException('Invalid email or password.');

    if (!user) {
      throw invalidCredentials();
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw invalidCredentials();
    }

    return { user: toSafeUser(user), tokens: this.issueTokens(user) };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User no longer exists.');
    }

    return this.issueTokens(user);
  }

  private issueTokens(user: User): AuthTokens {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d',
    });

    return { accessToken, refreshToken };
  }
}
