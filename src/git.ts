import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFileCb);

const BOT_NAME = 'github-actions[bot]';
const BOT_EMAIL = '41898282+github-actions[bot]@users.noreply.github.com';

export async function commitIfChanged(
  paths: string[],
  message: string,
): Promise<{ committed: boolean; sha?: string }> {
  await git('config', 'user.name', BOT_NAME);
  await git('config', 'user.email', BOT_EMAIL);

  await git('add', '--', ...paths);

  const status = await git('status', '--porcelain', '--', ...paths);
  if (status.trim().length === 0) {
    return { committed: false };
  }

  await git('commit', '-m', message, '--', ...paths);
  const sha = (await git('rev-parse', 'HEAD')).trim();
  await git('push');

  return { committed: true, sha };
}

async function git(...args: string[]): Promise<string> {
  const { stdout } = await run('git', args, { maxBuffer: 10 * 1024 * 1024 });
  return stdout;
}
