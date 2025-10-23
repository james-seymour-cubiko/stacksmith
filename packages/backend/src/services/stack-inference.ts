import type { GithubPR, Stack, StackWithPRs, StackedPR } from '@review-app/shared';

/**
 * Infer stacks from GitHub PRs based on their branch relationships.
 * A stack is formed when PRs are chained together where one PR's head branch
 * is another PR's base branch.
 * @param allPRs Array of pull requests
 * @param repoOwner Repository owner
 * @param repoName Repository name
 */
export function inferStacksFromPRs(allPRs: GithubPR[], knownStacks: StackWithPRs[], repoOwner: string, repoName: string): StackWithPRs[] {
  // Build a map of branch name to PR for quick lookup
  const branchToPR = new Map<string, GithubPR>();
  for (const pr of allPRs) {
    branchToPR.set(pr.head.ref, pr);
  }

  // Build a map of PR number to known stack for this repo
  const prNumberToKnownStack = new Map<number, StackWithPRs>();
  for (const stack of knownStacks) {
    // Only consider stacks from the same repo
    if (stack.repoOwner === repoOwner && stack.repoName === repoName) {
      for (const pr of stack.prs) {
        prNumberToKnownStack.set(pr.number, stack);
      }
    }
  }

  // Find all PR chains (stacks)
  const visited = new Set<number>();
  const newStacks: StackWithPRs[] = [];
  const updatedKnownStackIds = new Set<string>();

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

    // Check if any PR in this chain exists in a known stack
    const knownStack = chain
      .map((chainPR) => prNumberToKnownStack.get(chainPR.number))
      .find((stack) => stack !== undefined);

    if (knownStack) {
      // Upsert this chain into the known stack
      const stackId = knownStack.id;
      const stackName = knownStack.name;

      // Convert to StackedPRs with order information
      const stackedPRs: StackedPR[] = chain.map((pr, index) => ({
        ...pr,
        stackOrder: index,
        stackId,
        stackName,
        repoOwner,
        repoName,
      }));

      // Update the known stack with the latest data from open PRs
      const updatedStack: StackWithPRs = {
        ...knownStack,
        description: chain.length > 1
          ? `Stack from ${chain[0].base.ref} with ${chain.length} PRs`
          : `Single PR: ${chain[0].title}`,
        updated_at: new Date(Math.max(...chain.map((p) => new Date(p.updated_at).getTime()))).toISOString(),
        prs: stackedPRs,
      };

      // Replace the known stack in our result
      const indexInNewStacks = newStacks.findIndex((s) => s.id === stackId);
      if (indexInNewStacks >= 0) {
        newStacks[indexInNewStacks] = updatedStack;
      } else {
        newStacks.push(updatedStack);
        updatedKnownStackIds.add(stackId);
      }
    } else {
      // Create a new stack for PRs that don't belong to any known stack
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

      newStacks.push({
        id: stackId,
        name: stackName,
        description: chain.length > 1
          ? `Stack from ${chain[0].base.ref} with ${chain.length} PRs`
          : `Single PR: ${chain[0].title}`,
        created_at: chain[0].created_at,
        updated_at: new Date(Math.max(...chain.map((p) => new Date(p.updated_at).getTime()))).toISOString(),
        repoOwner,
        repoName,
        prs: stackedPRs,
      });
    }
  }

  // Include known stacks from this repo that weren't updated (all PRs might be closed)
  const stacks = [...newStacks];
  for (const knownStack of knownStacks) {
    if (knownStack.repoOwner === repoOwner && knownStack.repoName === repoName) {
      if (!updatedKnownStackIds.has(knownStack.id)) {
        stacks.push(knownStack);
      }
    }
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
