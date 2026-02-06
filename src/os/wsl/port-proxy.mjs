/**
 * Port proxy utilities for WSL→Windows connectivity.
 *
 * Chrome M113+ ignores --remote-debugging-address=0.0.0.0 for security.
 * Chrome always binds to 127.0.0.1 or ::1, so we MUST use Windows port proxy
 * (netsh interface portproxy) to forward connections from WSL.
 *
 * Port proxy types:
 * - v4tov4: forward from 0.0.0.0:PORT to 127.0.0.1:PORT (for IPv4 Chrome)
 * - v4tov6: forward from 0.0.0.0:PORT to ::1:PORT (for IPv6 Chrome)
 */

import { execSync } from 'child_process';
import { log } from '../../utils/colors.mjs';

/**
 * Check if port proxy exists on a given port and remove it.
 * This is needed because old port proxy rules can block Chrome from binding.
 *
 * @param {number} port - Port to check
 * @returns {boolean} true if port proxy was found and removed
 */
export function removePortProxyIfExists(port) {
  try {
    // Check v4tov4 proxy
    const portProxyV4 = execSync(
      'powershell.exe -NoProfile -Command "netsh interface portproxy show v4tov4"',
      { encoding: 'utf8', timeout: 5000 }
    );

    if (portProxyV4 && portProxyV4.includes(String(port))) {
      log.warn(`Found old v4tov4 port proxy on port ${port}, removing...`);
      try {
        execSync(
          `powershell.exe -NoProfile -Command "netsh interface portproxy delete v4tov4 listenport=${port} listenaddress=0.0.0.0"`,
          { encoding: 'utf8', timeout: 5000 }
        );
        log.success(`Port proxy (v4tov4) removed from port ${port}`);
        return true;
      } catch (e) {
        log.warn(`Could not remove port proxy (may need admin rights): ${e.message}`);
      }
    }

    // Check v4tov6 proxy
    const portProxyV6 = execSync(
      'powershell.exe -NoProfile -Command "netsh interface portproxy show v4tov6"',
      { encoding: 'utf8', timeout: 5000 }
    );

    if (portProxyV6 && portProxyV6.includes(String(port))) {
      log.warn(`Found old v4tov6 port proxy on port ${port}, removing...`);
      try {
        execSync(
          `powershell.exe -NoProfile -Command "netsh interface portproxy delete v4tov6 listenport=${port} listenaddress=0.0.0.0"`,
          { encoding: 'utf8', timeout: 5000 }
        );
        log.success(`Port proxy (v4tov6) removed from port ${port}`);
        return true;
      } catch (e) {
        log.warn(`Could not remove port proxy (may need admin rights): ${e.message}`);
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Check if a port is already in use by something other than Chrome debug.
 *
 * @param {number} port - Port to check
 * @returns {boolean} true if port is blocked
 */
export function isPortBlocked(port) {
  try {
    const netstat = execSync(
      `netstat.exe -ano 2>/dev/null | grep -E ":${port}.*LISTEN"`,
      { encoding: 'utf8', timeout: 5000 }
    );
    return netstat && netstat.includes('LISTEN');
  } catch {
    return false;
  }
}

/**
 * Set up port proxy for WSL access to Chrome.
 *
 * @param {number} port - Port to forward
 * @param {'v4tov4'|'v4tov6'} proxyType - Proxy type based on Chrome's bind address
 * @returns {boolean} true if setup successful
 */
export function setupPortProxy(port, proxyType = 'v4tov4') {
  const connectAddress = proxyType === 'v4tov6' ? '::1' : '127.0.0.1';

  try {
    // Remove any existing proxy first
    try {
      execSync(
        `powershell.exe -NoProfile -Command "netsh interface portproxy delete v4tov4 listenport=${port} listenaddress=0.0.0.0 2>\\$null; netsh interface portproxy delete v4tov6 listenport=${port} listenaddress=0.0.0.0 2>\\$null"`,
        { encoding: 'utf8', timeout: 5000 }
      );
    } catch { /* ignore */ }

    // Add new proxy
    execSync(
      `powershell.exe -NoProfile -Command "netsh interface portproxy add ${proxyType} listenport=${port} listenaddress=0.0.0.0 connectport=${port} connectaddress=${connectAddress}"`,
      { encoding: 'utf8', timeout: 5000 }
    );
    log.success(`Port proxy configured: 0.0.0.0:${port} → ${connectAddress}:${port} (${proxyType})`);
    return true;
  } catch (e) {
    log.warn(`Could not set up port proxy (need admin): ${e.message}`);
    return false;
  }
}

/**
 * Detect Chrome's bind address (IPv4 or IPv6) by checking netstat.
 *
 * @param {number} port - Port to check
 * @returns {'127.0.0.1'|'::1'|null} Bind address or null if not found
 */
export function detectChromeBindAddress(port) {
  try {
    const netstatOutput = execSync(`netstat.exe -ano`, { encoding: 'utf8', timeout: 5000 });
    const lines = netstatOutput.split('\n').filter(l => l.includes(':' + port) && l.includes('LISTEN'));

    for (const line of lines) {
      if (line.includes('127.0.0.1:' + port)) {
        return '127.0.0.1';
      } else if (line.includes('[::1]:' + port)) {
        return '::1';
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get current port proxy configuration.
 *
 * @returns {{v4tov4: Array<{listenPort: number, connectAddress: string}>, v4tov6: Array<{listenPort: number, connectAddress: string}>}}
 */
export function getPortProxyConfig() {
  const config = { v4tov4: [], v4tov6: [] };

  try {
    const v4tov4Output = execSync(
      'powershell.exe -NoProfile -Command "netsh interface portproxy show v4tov4"',
      { encoding: 'utf8', timeout: 5000 }
    );
    // Parse output - format: "0.0.0.0         9222        127.0.0.1       9222"
    const lines = v4tov4Output.split('\n').filter(l => l.match(/\d+\.\d+\.\d+\.\d+/));
    for (const line of lines) {
      const match = line.match(/(\d+\.\d+\.\d+\.\d+)\s+(\d+)\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+)/);
      if (match) {
        config.v4tov4.push({
          listenPort: parseInt(match[2], 10),
          connectAddress: match[3],
        });
      }
    }
  } catch { /* ignore */ }

  try {
    const v4tov6Output = execSync(
      'powershell.exe -NoProfile -Command "netsh interface portproxy show v4tov6"',
      { encoding: 'utf8', timeout: 5000 }
    );
    const lines = v4tov6Output.split('\n').filter(l => l.match(/\d+\.\d+\.\d+\.\d+/));
    for (const line of lines) {
      // v4tov6 format includes ::1 for IPv6
      const match = line.match(/(\d+\.\d+\.\d+\.\d+)\s+(\d+)\s+([^\s]+)\s+(\d+)/);
      if (match) {
        config.v4tov6.push({
          listenPort: parseInt(match[2], 10),
          connectAddress: match[3],
        });
      }
    }
  } catch { /* ignore */ }

  return config;
}
