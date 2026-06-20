import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from '../../users/entities/user.entity';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(10, {
    message:
      'Password must be at least 10 characters. This is a healthcare system — short passwords are not an acceptable tradeoff for convenience.',
  })
  password: string;

  @IsString()
  @MinLength(1)
  fullName: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsString()
  facilityKmhflCode?: string;
}
