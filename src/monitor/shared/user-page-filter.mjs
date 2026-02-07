/**
 * Filter browser internal / devtools pages from a page list.
 * Single source of truth for "is this a user page?" across all modes.
 *
 * Strips: chrome://, devtools://, chrome-extension://, moz-extension://,
 * extension://, React/Redux devtools background pages.
 * Also strips about:blank unless it's the only remaining page.
 *
 * @param {import('puppeteer').Page[]} allPages
 * @returns {import('puppeteer').Page[]}
 */
export function filterUserPages(allPages) {
  const isUserPage = (p) => {
    const u = p.url();
    if (u.startsWith('chrome://')) return false;
    if (u.startsWith('devtools://')) return false;
    if (u.startsWith('chrome-extension://')) return false;
    if (u.startsWith('moz-extension://')) return false;
    if (u.startsWith('extension://')) return false;
    if (u.includes('react-devtools') || u.includes('redux-devtools')) return false;
    if (u.includes('__react_devtools__')) return false;
    return true;
  };
  let pages = allPages.filter(isUserPage);
  const nonBlank = pages.filter(p => p.url() !== 'about:blank');
  if (nonBlank.length > 0) pages = nonBlank;
  return pages;
}
