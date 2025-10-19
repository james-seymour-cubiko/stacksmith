/**
 * GitHub API types
 */

export interface GithubUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
}

export interface GithubLabel {
  id: number;
  name: string;
  color: string;
  description: string | null;
}

export type PRState = 'open' | 'closed';

export type PRReviewState = 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING';

export interface GithubPR {
  number: number;
  title: string;
  body: string | null;
  state: PRState;
  html_url: string;
  user: GithubUser;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  draft: boolean;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
  labels: GithubLabel[];
  assignees: GithubUser[];
  requested_reviewers: GithubUser[];
  mergeable: boolean | null;
  mergeable_state: string;
  comments: number;
  review_comments: number;
  commits: number;
  additions: number;
  deletions: number;
  changed_files: number;
}

export interface GithubReview {
  id: number;
  user: GithubUser;
  body: string;
  state: PRReviewState;
  html_url: string;
  submitted_at: string;
}

export interface GithubComment {
  id: number;
  user: GithubUser;
  body: string;
  created_at: string;
  updated_at: string;
  html_url: string;
  path?: string;
  line?: number;
  commit_id?: string;
}

export interface GithubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  html_url: string;
  author: GithubUser | null;
}

export interface GithubDiff {
  sha: string;
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previous_filename?: string;
}

export interface GithubCheckRun {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
  started_at: string | null;
  completed_at: string | null;
  html_url: string | null;
  details_url: string | null;
}

/**
 * Stack-specific types
 */

export interface StackPR {
  number: number;
  order: number; // Position in stack (0 = base, higher = depends on lower)
}

export interface Stack {
  id: string;
  name: string;
  description?: string;
  prs: StackPR[];
  created_at: string;
  updated_at: string;
}

export interface StackMetadata {
  stacks: Stack[];
  version: string;
}

/**
 * Enriched types combining GitHub data with stack metadata
 */

export interface StackedPR extends GithubPR {
  stackOrder: number;
  stackId: string;
  stackName: string;
}

export interface StackWithPRs extends Omit<Stack, 'prs'> {
  prs: StackedPR[];
}

export interface ReviewStatus {
  approved: number;
  changesRequested: number;
  commented: number;
  pending: number;
  totalReviewers: number;
}

export interface StackReviewSummary {
  stack: Stack;
  totalPRs: number;
  openPRs: number;
  mergedPRs: number;
  draftPRs: number;
  reviewStatus: ReviewStatus;
  hasConflicts: boolean;
  allApproved: boolean;
  readyToMerge: boolean;
}

/**
 * Configuration types
 */

export interface GithubConfig {
  owner: string;
  repo: string;
  token?: string; // May be omitted in responses for security
  currentUser?: string; // GitHub username of the current user
}

export interface AppConfig {
  github: GithubConfig;
  stacksMetadataPath: string;
}

/**
 * API Request/Response types
 */

export interface CreateStackRequest {
  name: string;
  description?: string;
  prs: StackPR[];
}

export interface UpdateStackRequest {
  name?: string;
  description?: string;
  prs?: StackPR[];
}

export interface ConfigureGithubRequest {
  owner: string;
  repo: string;
  token: string;
  currentUser?: string;
}

export interface SyncStackResponse {
  success: boolean;
  updated: boolean;
  stack: StackWithPRs;
}

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}
