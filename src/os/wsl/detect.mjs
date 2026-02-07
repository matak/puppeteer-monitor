/**
 * WSL environment detection utilities.
 *
 * WSL2 runs in a lightweight Hyper-V VM with its own network namespace.
 * 'localhost' in WSL refers to WSL itself, not Windows.
 * To reach Windows services (like Chrome with remote debugging),
 * we need the Windows host IP which is the default gateway from WSL's perspective.
 */

import fs from 'fs';
import { execSync } from 'child_process';
import { C, log } from '../../utils/colors.mjs';
import { isWsl as isWslFromEnv } from '../../utils/env.mjs';

/** Re-export from single source of truth (utils/env.mjs). */
export const isWsl = isWslFromEnv;

/**
 * Get WSL distro name.
 * @returns {string} Distro name (e.g., 'Ubuntu', 'OracleLinux_8_7')
 */
export function getWslDistroName() {
  return process.env.WSL_DISTRO_NAME || 'Ubuntu';
}

/**
 * Detect Windows host IP for WSL.
 *
 * The gateway IP is obtained from 'ip route' (e.g., 172.29.96.1).
 * This is more reliable than /etc/resolv.conf nameserver because
 * Windows port proxy (netsh portproxy) listens on the gateway IP.
 *
 * @param {{ quiet?: boolean }} [opts] - If quiet=true, don't log (caller will show compact block)
 * @returns {string} Windows host IP or 'localhost' if not in WSL
 */
export function getWindowsHostForWSL(opts = {}) {
  try {
    const release = fs.readFileSync('/proc/version', 'utf8').toLowerCase();
    if (!release.includes('microsoft') && !release.includes('wsl')) {
      return 'localhost';
    }

    const route = execSync('ip route | grep default', { encoding: 'utf8' });
    const match = route.match(/default via (\d+\.\d+\.\d+\.\d+)/);
    if (match) {
      if (!opts.quiet) {
        log.info(`WSL detected, using Windows host IP: ${C.brightGreen}${match[1]}${C.reset}`);
      }
      return match[1];
    }
  } catch {
    // Ignore errors
  }
  return 'localhost';
}

