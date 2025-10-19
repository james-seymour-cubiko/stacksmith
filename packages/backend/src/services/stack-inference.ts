import type { GithubPR, Stack, StackWithPRs, StackedPR } from '@review-app/shared';

/**
 * Infer stacks from GitHub PRs based on their branch relationships.
 * A stack is formed when PRs are chained together where one PR's head branch
 * is another PR's base branch.
 * @param allPRs Array of pull requests
 * @param repoOwner Repository owner
 * @param repoName Repository name
 */
export function inferStacksFromPRs(allPRs: GithubPR[], repoOwner: string, repoName: string): StackWithPRs[] {
  // Build a map of branch name to PR for quick lookup
  const branchToPR = new Map<string, GithubPR>();
  for (const pr of allPRs) {
    branchToPR.set(pr.head.ref, pr);
  }

  // Find all PR chains (stacks)
  const visited = new Set<number>();
  const stacks: StackWithPRs[] = [];

  for (const pr of allPRs) {
    if (visited.has(pr.number)) continue;

    // Find the root of this stack (the PR whose base is not another PR's head)
    let current = pr;
    const chain: GithubPR[] = [current];
    visited.add(current.number);

    // Walk backwards to find the root
    while (branchToPR.has(current.base.ref)) {
      const parent = branchToPR.get(current.base.ref)!;
      if (visited.has(parent.number)) break; // Avoid cycles

      chain.unshift(parent);
      visited.add(parent.number);
      current = parent;
    }

    // Walk forwards to find all children
    let lastPR = chain[chain.length - 1];
    while (true) {
      const child = allPRs.find(
        (p) => !visited.has(p.number) && p.base.ref === lastPR.head.ref
      );
      if (!child) break;

      chain.push(child);
      visited.add(child.number);
      lastPR = child;
    }

    // Create a stack for all PRs (including single PRs)
    const stackId = generateStackId(chain, repoOwner, repoName);
    const stackName = generateStackName(chain);

    // Convert to StackedPRs with order information
    const stackedPRs: StackedPR[] = chain.map((pr, index) => ({
      ...pr,
      stackOrder: index,
      stackId,
      stackName,
      repoOwner,
      repoName,
    }));

    stacks.push({
      id: stackId,
      name: stackName,
      description: chain.length > 1
        ? `Stack from ${chain[0].base.ref} with ${chain.length} PRs`
        : `Single PR: ${chain[0].title}`,
      created_at: chain[0].created_at,
      // Find updated at of all PRs in the stack
      updated_at: new Date(Math.max(...chain.map((p) => new Date(p.updated_at).getTime()))).toISOString(),
      repoOwner,
      repoName,
      prs: stackedPRs,
    });
  }

  return stacks;
}

/**
 * Generate a unique stack ID based on the PRs in the stack
 * For multi-repo support, include repo identifier in the stack ID
 */
function generateStackId(prs: GithubPR[], repoOwner: string, repoName: string): string {
  // Use the root PR's head branch as the base for the ID
  const rootBranch = prs[0].head.ref;
  const branchId = rootBranch.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  // Include repo in ID to ensure uniqueness across repos
  return `${repoOwner}-${repoName}-${branchId}`;
}

/**
 * Generate a human-readable stack name
 */
function generateStackName(prs: GithubPR[]): string {
  // Use the root PR's title as the stack name
  return prs[0].title;
}

/**
 * Get a specific stack by ID
 */
export function getStackById(stacks: StackWithPRs[], stackId: string): StackWithPRs | null {
  return stacks.find((s) => s.id === stackId) || null;
}

/**
 * Convert StackWithPRs to a simple Stack (for API responses that need the simpler format)
 */
export function stackWithPRsToStack(stackWithPRs: StackWithPRs): Stack {
  return {
    id: stackWithPRs.id,
    name: stackWithPRs.name,
    description: stackWithPRs.description,
    created_at: stackWithPRs.created_at,
    updated_at: stackWithPRs.updated_at,
    repoOwner: stackWithPRs.repoOwner,
    repoName: stackWithPRs.repoName,
    prs: stackWithPRs.prs.map((pr) => ({
      number: pr.number,
      order: pr.stackOrder,
    })),
  };
}
