import { config } from 'dotenv';
import { resolve } from 'path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { stackRoutes } from './routes/stacks.js';
import { prRoutes } from './routes/prs.js';
import { configRoutes } from './routes/config.js';
import { githubService } from './services/github.js';

// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const HOST = process.env.HOST || '127.0.0.1';

async function buildServer() {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  }).withTypeProvider<ZodTypeProvider>();

  // Set up validators and serializers for Zod
  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);

  // Register CORS
  await server.register(cors, {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  });

  // Register Swagger
  await server.register(swagger, {
    openapi: {
      info: {
        title: 'Review App API',
        description: 'API for managing stacked pull requests',
        version: '0.1.0',
      },
      servers: [
        {
          url: `http://${HOST}:${PORT}`,
          description: 'Development server',
        },
      ],
    },
  });

  // Register Swagger UI
  await server.register(swaggerUI, {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  // Health check
  server.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register routes
  await server.register(stackRoutes, { prefix: '/api/stacks' });
  await server.register(prRoutes, { prefix: '/api/prs' });
  await server.register(configRoutes, { prefix: '/api/config' });

  return server;
}

async function start() {
  try {
    // Configure GitHub service from environment variables if available
    const githubOwner = process.env.GITHUB_OWNER;
    const githubRepo = process.env.GITHUB_REPO;
    const githubToken = process.env.GITHUB_TOKEN;
    const githubCurrentUser = process.env.GITHUB_CURRENT_USER;

    if (githubOwner && githubRepo) {
      githubService.configure(githubOwner, githubRepo, githubToken, githubCurrentUser);
      console.log(`✓ GitHub configured: ${githubOwner}/${githubRepo}${githubCurrentUser ? ` (user: ${githubCurrentUser})` : ''}`);
    }

    const server = await buildServer();

    await server.listen({ port: PORT, host: HOST });

    console.log(`
🚀 Server ready at: http://${HOST}:${PORT}
📚 API Documentation: http://${HOST}:${PORT}/documentation
    `);
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

start();
