import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../src/auth/auth.service';
import { UsersService } from '../src/users/users.service';
import { UserRole } from '../src/users/entities/user.entity';

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: jest.Mocked<Pick<UsersService, 'create' | 'findByEmailWithPassword' | 'findById'>>;
  let jwtService: JwtService;
  let configService: ConfigService;

  beforeEach(() => {
    usersService = {
      create: jest.fn(),
      findByEmailWithPassword: jest.fn(),
      findById: jest.fn(),
    };
    jwtService = new JwtService({});
    configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          JWT_ACCESS_SECRET: 'test-access-secret',
          JWT_ACCESS_EXPIRES_IN: '15m',
          JWT_REFRESH_SECRET: 'test-refresh-secret',
          JWT_REFRESH_EXPIRES_IN: '7d',
        };
        return values[key];
      }),
    } as unknown as ConfigService;

    authService = new AuthService(
      usersService as unknown as UsersService,
      jwtService,
      configService,
    );
  });

  it('registers a user, hashing the password rather than storing it raw', async () => {
    usersService.create.mockImplementation(async (input) => ({
      id: 'user-1',
      email: input.email,
      passwordHash: input.passwordHash,
      fullName: input.fullName,
      role: input.role ?? UserRole.PATIENT,
      facilityKmhflCode: input.facilityKmhflCode ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const result = await authService.register({
      email: 'nurse@example.org',
      password: 'a-strong-password',
      fullName: 'Test Nurse',
      role: UserRole.NURSE,
    });

    expect(usersService.create).toHaveBeenCalledTimes(1);
    const createArg = usersService.create.mock.calls[0][0];
    expect(createArg.passwordHash).not.toEqual('a-strong-password');
    expect(await bcrypt.compare('a-strong-password', createArg.passwordHash)).toBe(true);

    expect(result.user.email).toEqual('nurse@example.org');
    expect(result.tokens.accessToken).toBeDefined();
    expect(result.tokens.refreshToken).toBeDefined();
    expect((result.user as unknown as { passwordHash?: string }).passwordHash).toBeUndefined();
  });

  it('logs in with correct credentials and issues tokens', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    usersService.findByEmailWithPassword.mockResolvedValue({
      id: 'user-2',
      email: 'doc@example.org',
      passwordHash,
      fullName: 'Test Doctor',
      role: UserRole.DOCTOR,
      facilityKmhflCode: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await authService.login({
      email: 'doc@example.org',
      password: 'correct-password',
    });

    expect(result.user.role).toEqual(UserRole.DOCTOR);
    expect(result.tokens.accessToken).toBeDefined();
  });

  it('rejects login with the same error for unknown email and wrong password (no enumeration)', async () => {
    usersService.findByEmailWithPassword.mockResolvedValueOnce(null);
    await expect(
      authService.login({ email: 'nobody@example.org', password: 'whatever' }),
    ).rejects.toThrow(UnauthorizedException);

    const passwordHash = await bcrypt.hash('correct-password', 4);
    usersService.findByEmailWithPassword.mockResolvedValueOnce({
      id: 'user-3',
      email: 'real@example.org',
      passwordHash,
      fullName: 'Real User',
      role: UserRole.PATIENT,
      facilityKmhflCode: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expect(
      authService.login({ email: 'real@example.org', password: 'wrong-password' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
