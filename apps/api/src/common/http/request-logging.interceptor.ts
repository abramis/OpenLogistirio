import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, finalize } from 'rxjs';
import { RequestWithContext } from './request-context';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithContext>();
    const response = http.getResponse<{ statusCode: number }>();
    const startedAt = Date.now();

    return next.handle().pipe(
      finalize(() => {
        this.logger.log(
          JSON.stringify({
            event: 'http_request',
            requestId: request.requestId,
            method: request.method,
            path: request.originalUrl ?? request.url,
            statusCode: response.statusCode,
            durationMs: Date.now() - startedAt,
          }),
        );
      }),
    );
  }
}
