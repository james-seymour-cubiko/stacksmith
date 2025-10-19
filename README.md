# Stacksmith

A code review platform for managing and reviewing stacked pull requests, with GitHub as the source of truth.

## Features

- **Stacked PR Management**: Organize and track stacked pull requests
- **GitHub Integration**: Fetch PR data, diffs, reviews, and comments from GitHub API
- **Type-Safe API**: Fully typed backend and frontend with shared types
- **Modern Stack**: React, TypeScript, Tailwind CSS, and Fastify

## Project Structure

```
review-app/
├── packages/
│   ├── shared/          # Shared TypeScript types
│   ├── backend/         # Fastify REST API
│   └── frontend/        # React web application
└── package.json         # Workspace root
```

## Prerequisites

- Node.js >= 18.0.0
- npm (comes with Node.js)

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

This will install dependencies for all packages in the workspace.

### 2. Build Shared Package

```bash
npm run build --workspace=@review-app/shared
```

### 3. Start Development Servers

Run both backend and frontend in development mode:

```bash
npm run dev
```

Or run them separately:

```bash
# Backend only (runs on http://127.0.0.1:3001)
npm run dev:backend

# Frontend only (runs on http://localhost:5173)
npm run dev:frontend
```

### 4. Configure GitHub

1. Open http://localhost:5173 in your browser
2. Navigate to Settings
3. Create a GitHub Personal Access Token:
   - Go to https://github.com/settings/tokens
   - Click "Generate new token (classic)"
   - Select the `repo` scope
   - Copy the generated token
4. Enter your repository owner, name, and token in the settings page

## API Documentation

Once the backend is running, visit http://127.0.0.1:3001/documentation for interactive API documentation.

## Available Scripts

### Root Level

- `npm run dev` - Run both backend and frontend in development mode
- `npm run build` - Build all packages
- `npm run type-check` - Type-check all packages

### Backend

- `npm run dev --workspace=@review-app/backend` - Start backend dev server
- `npm run build --workspace=@review-app/backend` - Build backend
- `npm start --workspace=@review-app/backend` - Start built backend

### Frontend

- `npm run dev --workspace=@review-app/frontend` - Start frontend dev server
- `npm run build --workspace=@review-app/frontend` - Build frontend
- `npm run preview --workspace=@review-app/frontend` - Preview built frontend

## Stack Inference

Stacks are automatically inferred from GitHub pull request branch relationships:

- **Stack Detection**: When PR A's head branch is PR B's base branch, they form a stack
- **Chain Building**: The app walks the PR chain to find all related PRs
- **Automatic Naming**: Stack names are derived from the root PR's branch name
- **Real-time**: Stacks are computed on-demand from live GitHub data

Example:
```
PR #123: feature/auth-setup → main
PR #124: feature/auth-login → feature/auth-setup
PR #125: feature/auth-logout → feature/auth-login
```
This creates a stack: "Auth Setup" with 3 PRs in order.

## Future Enhancements

- Combined diff view across entire stack
- Review status aggregation
- Conflict detection within stacks
- Batch operations (approve/merge entire stack)
- Real-time updates via polling or webhooks
- Support for closed/merged stacks

## Tech Stack

- **Backend**: Fastify, TypeScript, Zod, Octokit
- **Frontend**: React, TypeScript, Tailwind CSS, TanStack Query, React Router
- **Build Tools**: Vite, tsc
- **API Documentation**: Swagger/OpenAPI

## License

MIT
