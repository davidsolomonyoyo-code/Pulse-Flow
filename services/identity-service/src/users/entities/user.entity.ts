import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum UserRole {
  PATIENT = 'PATIENT',
  NURSE = 'NURSE',
  DOCTOR = 'DOCTOR',
  RECEPTIONIST = 'RECEPTIONIST',
  ADMIN = 'ADMIN',
}

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email: string;

  // Never select this column by default — see UsersService.findByEmail
  @Column({ type: 'varchar', length: 255, select: false })
  passwordHash: string;

  @Column({ type: 'varchar', length: 255 })
  fullName: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.PATIENT })
  role: UserRole;

  @Column({ type: 'varchar', length: 64, nullable: true })
  facilityKmhflCode: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
