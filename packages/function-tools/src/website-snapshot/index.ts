import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { execAsync } from '@krobert/utils';

export async function snapshotCompactWebsite(url: string) {
  await execAsync(`agent-browser open "${url}"`, [], { timeout: 25000 });

  const { stdout } = await execAsync(`agent-browser snapshot -c`);

  await execAsync(`agent-browser close`);

  return stdout;
}

export const snapshotCompactWebsiteTool = tool(
  async ({ url }: { url: string }) => {
    return snapshotCompactWebsite(url);
  },
  {
    name: 'snapshotCompactWebsite',
    description:
      'Snapshot a website in a compact format. When you need to browse a website and extract simplified information, you must use this tool.',
    schema: z.object({
      url: z.string().describe('The url of website to be walked through'),
    }),
  },
);
