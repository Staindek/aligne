import {
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  UseInterceptors,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { plainToInstance } from 'class-transformer';

export function Serialize(dto: new (...args: any[]) => object) {
  return UseInterceptors(new SerializeInterceptor(dto));
}

class SerializeInterceptor implements NestInterceptor {
  constructor(private dto: new (...args: any[]) => object) {}

  intercept(_ctx: ExecutionContext, handler: CallHandler): Observable<unknown> {
    return handler
      .handle()
      .pipe(
        map((data) =>
          plainToInstance(this.dto, data, { excludeExtraneousValues: false }),
        ),
      );
  }
}
