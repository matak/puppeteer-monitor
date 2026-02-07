/**
 * Where the Chrome profile is stored.
 * Depends on platform:
 *   - native Linux/Mac = .browsermonitor/.chrome-profile (matches getPaths().chromeProfileDir)
 *   - WSL /mnt/ = same dir converted to Windows drive letter
 *   - WSL (project on WSL fs) = Windows LOCALAPPDATA\browsermonitor\{profileId}
 */

import path from 'path';
import { isWsl } from './env.mjs';
import { getWindowsProfilePath } from '../os/wsl/chrome.mjs';
import { BROWSERMONITOR_DIR, CHROME_PROFILE_DIR } from '../settings.mjs';

/**
 * Get Chrome profile path and a short description for the current platform.
 * Non-WSL path matches getPaths().chromeProfileDir from settings.mjs.
 * @param {string} projectDir - Project root (outputDir)
 * @returns {{ path: string, where: string }}
 */
export function getChromeProfileLocation(projectDir) {
  if (!isWsl()) {
    return {
      path: path.join(projectDir, BROWSERMONITOR_DIR, CHROME_PROFILE_DIR),
      where: 'Project directory',
    };
  }

  if (projectDir.startsWith('/mnt/')) {
    const winPath = projectDir
      .replace(/^\/mnt\/([a-z])\//, (_, d) => `${d.toUpperCase()}:\\`)
      .replace(/\//g, '\\');
    return {
      path: `${winPath}\\${BROWSERMONITOR_DIR}\\${CHROME_PROFILE_DIR}`,
      where: 'Windows (same drive as project)',
    };
  }

  return {
    path: getWindowsProfilePath(projectDir),
    where: 'Windows (LOCALAPPDATA\\browsermonitor\\)',
  };
}
