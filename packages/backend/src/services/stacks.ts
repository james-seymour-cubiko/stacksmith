import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import type { Stack, StackMetadata, CreateStackRequest, UpdateStackRequest } from '@review-app/shared';

const DEFAULT_METADATA_PATH = join(process.cwd(), '.review-app', 'stacks.json');

export class StackService {
  private metadataPath: string;

  constructor(metadataPath: string = DEFAULT_METADATA_PATH) {
    this.metadataPath = metadataPath;
  }

  private async ensureMetadataFile(): Promise<void> {
    if (!existsSync(this.metadataPath)) {
      const dir = dirname(this.metadataPath);
      await mkdir(dir, { recursive: true });
      await this.saveMetadata({ stacks: [], version: '1.0.0' });
    }
  }

  private async loadMetadata(): Promise<StackMetadata> {
    await this.ensureMetadataFile();
    const content = await readFile(this.metadataPath, 'utf-8');
    return JSON.parse(content) as StackMetadata;
  }

  private async saveMetadata(metadata: StackMetadata): Promise<void> {
    await writeFile(this.metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
  }

  async listStacks(): Promise<Stack[]> {
    const metadata = await this.loadMetadata();
    return metadata.stacks;
  }

  async getStack(stackId: string): Promise<Stack | null> {
    const metadata = await this.loadMetadata();
    return metadata.stacks.find((s) => s.id === stackId) || null;
  }

  async createStack(data: CreateStackRequest): Promise<Stack> {
    const metadata = await this.loadMetadata();

    // Generate a simple ID from name
    const id = data.name.toLowerCase().replace(/\s+/g, '-');

    // Check if stack with this ID already exists
    if (metadata.stacks.some((s) => s.id === id)) {
      throw new Error(`Stack with ID "${id}" already exists`);
    }

    const now = new Date().toISOString();
    const stack: Stack = {
      id,
      name: data.name,
      description: data.description,
      prs: data.prs,
      created_at: now,
      updated_at: now,
    };

    metadata.stacks.push(stack);
    await this.saveMetadata(metadata);

    return stack;
  }

  async updateStack(stackId: string, data: UpdateStackRequest): Promise<Stack> {
    const metadata = await this.loadMetadata();
    const stackIndex = metadata.stacks.findIndex((s) => s.id === stackId);

    if (stackIndex === -1) {
      throw new Error(`Stack with ID "${stackId}" not found`);
    }

    const stack = metadata.stacks[stackIndex];
    const updatedStack: Stack = {
      ...stack,
      name: data.name ?? stack.name,
      description: data.description ?? stack.description,
      prs: data.prs ?? stack.prs,
      updated_at: new Date().toISOString(),
    };

    metadata.stacks[stackIndex] = updatedStack;
    await this.saveMetadata(metadata);

    return updatedStack;
  }

  async deleteStack(stackId: string): Promise<void> {
    const metadata = await this.loadMetadata();
    const stackIndex = metadata.stacks.findIndex((s) => s.id === stackId);

    if (stackIndex === -1) {
      throw new Error(`Stack with ID "${stackId}" not found`);
    }

    metadata.stacks.splice(stackIndex, 1);
    await this.saveMetadata(metadata);
  }
}

// Singleton instance
export const stackService = new StackService();
