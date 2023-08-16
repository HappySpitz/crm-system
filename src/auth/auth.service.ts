import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ChangePasswordDto, LoginDto } from './dto';
import {
  EActionTokenType,
  ITokenPair,
  MailService,
  PasswordService,
  PrismaService,
  TokenService,
} from '../core';
import { EStatusManager, ManagerService } from '../manager';

@Injectable()
export class AuthService {
  constructor(
    private readonly mailService: MailService,
    private readonly passwordService: PasswordService,
    private readonly managerService: ManagerService,
    private readonly tokenService: TokenService,
    private readonly prismaService: PrismaService,
  ) {}

  async login(loginBody: LoginDto): Promise<ITokenPair> {
    const { email, password } = loginBody;

    const manager = await this.managerService.getManagerByIdOrEmail(email);

    if (manager) {
      if (manager.status === EStatusManager.BANNED) {
        throw new HttpException(
          'You cannot log in because your account is banned',
          HttpStatus.FORBIDDEN,
        );
      }

      if (manager.is_active === false && manager.password === null) {
        throw new HttpException(
            'You cannot log in because your account is not activated. Please activate your account',
            HttpStatus.FORBIDDEN,
        );
      }

      await this.managerService.updateManager(manager.id, {
        last_login: new Date(),
      });
    } else {
      throw new UnauthorizedException('Email or password is incorrect');
    }

    if (!password) {
      throw new UnauthorizedException('Email or password is incorrect');
    }

    const passwordMatches = await this.passwordService.comparePasswords(
      password,
      manager.password,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Email or password is incorrect');
    }

    const tokenPair = await this.tokenService.generateTokenPair(manager.id);

    await this.prismaService.token.create({
      data: {
        userId: manager.id,
        createdAt: new Date(),
        ...tokenPair,
      },
    });

    return tokenPair;
  }

  async refresh(id: string): Promise<ITokenPair> {
    const tokenPair = await this.tokenService.generateTokenPair(id);

    await this.prismaService.token.create({
      data: { userId: id, createdAt: new Date(), ...tokenPair },
    });

    return tokenPair;
  }

  async sendActivateToken(email: string): Promise<void> {
    const manager = await this.managerService.getManagerByIdOrEmail(email);

    if (!manager) {
      throw new HttpException('Manager not found', HttpStatus.NOT_FOUND);
    }

    if (manager.is_active === true) {
      throw new HttpException(
        'Your account is already active',
        HttpStatus.CONFLICT,
      );
    }

    if (manager.status === EStatusManager.BANNED) {
      throw new HttpException('Your account is banned', HttpStatus.CONFLICT);
    }

    const activateToken = await this.tokenService.generateActionToken(
      manager.id,
      EActionTokenType.activate,
    );

    await this.prismaService.action.create({
      data: {
        actionToken: activateToken,
        tokenType: EActionTokenType.activate,
        userId: manager.id,
      },
    });

    await this.mailService.sendManagerActivate(manager, activateToken);
  }

  async activate(id: string, password: string, token: string): Promise<void> {
    const actionToken = await this.prismaService.action.findFirst({
      where: { actionToken: token },
    });

    await Promise.all([
      this.managerService.updateManager(id, { password, is_active: true }),
      this.prismaService.action.delete({ where: { id: actionToken.id } }),
    ]);
  }

  async changePassword(
    body: ChangePasswordDto,
    id: string,
  ): Promise<HttpException> {
    const manager = await this.managerService.getManagerByIdOrEmail(id);

    const isMatched = await this.passwordService.comparePasswords(
      body.oldPassword,
      manager.password,
    );

    if (!isMatched) {
      throw new UnauthorizedException('Wrong old password!');
    }

    if (body.oldPassword === body.newPassword) {
      throw new BadRequestException(
        'New password must be different from the old password',
      );
    }

    const hashedPassword = await this.passwordService.hashPassword(
      body.newPassword,
    );

    await this.managerService.updateManager(id, { password: hashedPassword });

    return new HttpException('The password has been changed', HttpStatus.OK);
  }

  async sendForgotPasswordToken(email: string): Promise<void> {
    const manager = await this.managerService.getManagerByIdOrEmail(email);

    if (manager.is_active === false && manager.password === null) {
      throw new HttpException(
        "To get started, you need to activate your account and set up a password. After activation, you'll be able to secure your account with a new password.",
        HttpStatus.BAD_REQUEST,
      );
    }

    const forgotPasswordToken = await this.tokenService.generateActionToken(
      manager.id,
      EActionTokenType.forgot,
    );

    await this.prismaService.action.create({
      data: {
        actionToken: forgotPasswordToken,
        tokenType: EActionTokenType.forgot,
        userId: manager.id,
      },
    });

    await this.mailService.sendManagerForgotPassword(
      manager,
      forgotPasswordToken,
    );
  }

  async setForgotPassword(
    id: string,
    password: string,
    token: string,
  ): Promise<HttpException> {
    const manager = await this.managerService.getManagerByIdOrEmail(id);
    const actionToken = await this.tokenService.getActionTokenByTokenFromQuery(
      token,
    );

    const passwordMatched = await this.passwordService.comparePasswords(
      password,
      manager.password,
    );

    if (passwordMatched) {
      throw new BadRequestException(
        'New password must be different from the old password',
      );
    }

    await Promise.all([
      this.managerService.updateManager(id, { password }),
      this.prismaService.action.delete({ where: { id: actionToken.id } }),
    ]);

    return new HttpException('The password has been changed', HttpStatus.OK);
  }
}
