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

  try {
    await git('push');
  } catch (err) {
    // A scheduled run and a manual dispatch can land together; rebase onto
    // whatever won the race and push again. A second failure is a real error —
    // and the first is logged so a permissions/protected-branch failure isn't
    // masked by whatever the retry dies on.
    console.warn(`git push failed, retrying after pull --rebase: ${(err as Error).message}`);
    await git('pull', '--rebase');
    await git('push');
  }

  const sha = (await git('rev-parse', 'HEAD')).trim();
  return { committed: true, sha };
}

async function git(...args: string[]): Promise<string> {
  const { stdout } = await run('git', args, { maxBuffer: 10 * 1024 * 1024 });
  return stdout;
}
