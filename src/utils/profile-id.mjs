/**
 * Global helper for Chrome profile ID derivation.
 * Profile ID = projectName_hash where hash represents the full project path.
 * Ensures consistent profile naming across open-mode, join-mode, and WSL.
 */

import path from 'path';
import crypto from 'crypto';

/**
 * Compute profile ID components from project directory.
 * projectName = basename (e.g. cadcloud-ui); hash = md5 of full absolute path.
 *
 * @param {string} projectDir - Project root (outputDir), any form
 * @returns {{ projectName: string, hash: string, profileId: string }}
 */
export function getProfileIdFromProjectDir(projectDir) {
  const absolutePath = path.resolve(projectDir);
  const projectName = path.basename(absolutePath).replace(/[^a-zA-Z0-9_-]/g, '_');
  const hash = crypto.createHash('md5').update(absolutePath).digest('hex').substring(0, 12);
  const profileId = `${projectName}_${hash}`;
  return { projectName, hash, profileId };
}
