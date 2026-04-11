import { spawn } from 'child_process';

export interface ExecOptions {
  cwd?: string;
  timeout?: number;
  env?: NodeJS.ProcessEnv;
  shell?: boolean | string;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  code: number | null;
  error?: Error;
}

/**
 * Execute a command and return a promise with the result.
 *
 * Supports custom timeout control and convenient argument passing.
 *
 * @param command The main command to execute (e.g., 'npx', 'ls')
 * @param args Arguments to pass to the command (e.g., ['@browsermcp/mcp', 'search'])
 * @param options Execution options including timeout (ms), cwd, and environment variables.
 * @returns A promise that resolves to the execution result (stdout, stderr, exit code).
 */
export async function execAsync(
  command: string,
  args: string[] = [],
  options: ExecOptions = {},
): Promise<ExecResult> {
  const { timeout, ...spawnOptions } = options;

  return new Promise((resolve, reject) => {
    // Default shell to true for better compatibility with tools like npx on different platforms
    const child = spawn(command, args, {
      shell: true,
      ...spawnOptions,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    let timer: NodeJS.Timeout | null = null;
    if (timeout) {
      timer = setTimeout(() => {
        child.kill();
        const err = new Error(`Command timed out after ${timeout}ms: ${command} ${args.join(' ')}`);
        reject({ stdout, stderr, code: null, error: err });
      }, timeout);
    }

    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });

    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      resolve({ stdout, stderr, code: null, error: err });
    });
  });
}

/**
 * Convert keywords to a Google Search URL.
 *
 * @param keywords The search keywords (string or array of strings).
 * @returns The full Google search URL.
 */
export function getGoogleSearchUrl(keywords: string | string[], site: string = ''): string {
  const query = Array.isArray(keywords) ? keywords.join(' ') : keywords;
  const encodedQuery = encodeURIComponent(query).replace(/%20/g, '+');

  if (site) {
    const encodedSite = encodeURIComponent(site);
    return `https://www.google.com/search?q=site:${encodedSite}+${encodedQuery}`;
  }
  return `https://www.google.com/search?q=${encodedQuery}`;
}
