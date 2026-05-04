import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AdminUser } from '@prisma/client';

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AdminUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AdminUser;
  },
);
