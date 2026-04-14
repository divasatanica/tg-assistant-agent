import { spawn } from 'child_process';
import { groupBy } from 'lodash-es';

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

/**
 * 将列表中的 item 按照某个字段归类成对象。
 *
 * @param list 原始列表
 * @param iteratee 归类的字段名或函数
 * @returns 归类后的对象
 */
export function groupToRecord<T>(list: T[], iteratee: string | ((item: T) => any)) {
  const grouped = groupBy(list, iteratee);
  return grouped;
}

export { cloneDeep } from 'lodash-es';
