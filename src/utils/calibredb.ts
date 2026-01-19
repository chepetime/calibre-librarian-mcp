import { spawn } from 'node:child_process';
import { config } from '../config';

interface RunCalibredbOptions {
  timeoutMs?: number;
}

export async function runCalibredb(
  args: string[],
  options: RunCalibredbOptions = {}
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? config.commandTimeoutMs;

  return new Promise((resolve, reject) => {
    const child = spawn(
      config.calibredbCommand,
      ['--with-library', config.calibreLibraryPath, ...args],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`calibredb timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        const message = stderr.trim() || `calibredb exited with code ${code}`;
        reject(new Error(message));
      }
    });
  });
}
