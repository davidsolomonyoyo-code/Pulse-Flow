import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  fullName: string;
  role?: UserRole;
  facilityKmhflCode?: string | null;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(input: CreateUserInput): Promise<User> {
    const existing = await this.usersRepository.findOne({
      where: { email: input.email },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const user = this.usersRepository.create({
      email: input.email,
      passwordHash: input.passwordHash,
      fullName: input.fullName,
      role: input.role ?? UserRole.PATIENT,
      facilityKmhflCode: input.facilityKmhflCode ?? null,
    });

    return this.usersRepository.save(user);
  }

  /**
   * passwordHash is marked `select: false` on the entity, so it must be
   * explicitly requested here. This is deliberate: it makes it impossible
   * to accidentally leak a password hash through a default find() call
   * anywhere else in the codebase.
   */
  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }
}
