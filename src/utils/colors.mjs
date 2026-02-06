/**
 * ANSI color codes and logging helpers for terminal output.
 */

// ANSI color codes
export const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  // Colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  // Bright colors
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  // Background
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
};

// Helper functions for colored output
export const log = {
  info: (msg) => console.log(`${C.cyan}[Monitor]${C.reset} ${msg}`),
  success: (msg) => console.log(`${C.green}[Monitor]${C.reset} ${C.green}${msg}${C.reset}`),
  warn: (msg) => console.log(`${C.yellow}[Monitor]${C.reset} ${C.yellow}${msg}${C.reset}`),
  error: (msg) => console.error(`${C.red}[Monitor]${C.reset} ${C.red}${msg}${C.reset}`),
  dim: (msg) => console.log(`${C.dim}[Monitor] ${msg}${C.reset}`),
  header: (msg) => console.log(`\n${C.bold}${C.brightCyan}═══════════════════════════════════════════════════════════════════════════════${C.reset}`),
  title: (msg) => console.log(`${C.bold}${C.brightCyan}  ${msg}${C.reset}`),
  section: (msg) => console.log(`\n${C.bold}${C.white}> ${msg}${C.reset}`),
  key: (key, value) => console.log(`  ${C.cyan}${key}:${C.reset} ${value}`),
  keyHighlight: (key, value) => console.log(`  ${C.cyan}${key}:${C.reset} ${C.brightGreen}${value}${C.reset}`),
  cmd: (msg) => console.log(`  ${C.bgBlue}${C.white} ${msg} ${C.reset}`),
  bullet: (msg) => console.log(`  ${C.dim}-${C.reset} ${msg}`),
  status: (label, value, color = C.white) => console.log(`  ${C.dim}${label}:${C.reset} ${color}${value}${C.reset}`),
};
