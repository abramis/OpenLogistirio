import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { createRateLimitMiddleware } from './common/http/rate-limit.middleware';
import { RequestLoggingInterceptor } from './common/http/request-logging.interceptor';
import { requestContextMiddleware } from './common/http/request-context';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');
  const frontendOrigin = configService.getOrThrow<string>('FRONTEND_ORIGIN');

  app.setGlobalPrefix('api');
  if (configService.get<boolean>('TRUST_PROXY')) {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }
  app.use(requestContextMiddleware);
  app.use(
    createRateLimitMiddleware(
      configService.getOrThrow<number>('RATE_LIMIT_WINDOW_MS'),
      configService.getOrThrow<number>('RATE_LIMIT_MAX'),
    ),
  );
  app.enableCors({
    origin: frontendOrigin,
    credentials: true,
  });
  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new RequestLoggingInterceptor());

  if (configService.get<boolean>('API_DOCS_ENABLED', false)) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Open Logistirio API')
      .setDescription('Independent open-source ERP API for Greek accounting offices.')
      .setVersion(configService.get<string>('APP_VERSION', 'development'))
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = Number(configService.get('API_PORT', 3000));
  await app.listen(port, '0.0.0.0');
  logger.log(
    JSON.stringify({ event: 'api_started', port, environment: configService.get('NODE_ENV') }),
  );
}

void bootstrap();
