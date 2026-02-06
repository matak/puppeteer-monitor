/**
 * Platform / environment detection (Windows, Linux, WSL).
 * Single place for isWindows, isLinux, isWsl so UI and profile path logic can depend on it.
 */

import fs from 'fs';

export function isWindows() {
  return process.platform === 'win32';
}

export function isLinux() {
  return process.platform === 'linux';
}

/**
 * Check if running in WSL (Linux under Windows).
 * @returns {boolean}
 */
export function isWsl() {
  if (process.platform !== 'linux') return false;
  if (process.env.WSL_DISTRO_NAME) return true;
  if (fs.existsSync('/proc/sys/fs/binfmt_misc/WSLInterop')) return true;
  try {
    const v = fs.readFileSync('/proc/version', 'utf8').toLowerCase();
    return v.includes('microsoft') || v.includes('wsl');
  } catch {
    return false;
  }
}
