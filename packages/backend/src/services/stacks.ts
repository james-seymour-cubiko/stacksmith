import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import type { Stack, StackMetadata, CreateStackRequest, UpdateStackRequest, StackWithPRs } from '@review-app/shared';

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
      await this.saveStacks([]);
    }
  }

  async loadStacks(): Promise<StackWithPRs[]> {
    await this.ensureMetadataFile();
    const content = await readFile(this.metadataPath, 'utf-8');
    return JSON.parse(content) as StackWithPRs[];
  }

  async saveStacks(stacks: StackWithPRs[]): Promise<void> {
    await writeFile(this.metadataPath, JSON.stringify(stacks, null, 2), 'utf-8');
  }

}

// Singleton instance
export const stackService = new StackService();
