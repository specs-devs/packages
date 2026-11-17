// Node ESM resolve hook: let extensionless relative imports resolve to .ts,
// so the Lens-Studio-style source (extensionless imports) runs under node for
// tests without editing the source. The Leaf.lspkg modules Testing/ imports
// resolve to the node test doubles in _leafStubs.ts; any other Leaf.lspkg
// import fails loudly so a new LEAF dependency is not silently untested.
// Used only for local testing.
const LEAF_STUBBED = new Set([
  'Leaf.lspkg/Utils/common/LeafLifecycle',
  'Leaf.lspkg/Utils/common/Logger',
  'Leaf.lspkg/Utils/common/Utils'
])

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('Leaf.lspkg/')) {
    if (!LEAF_STUBBED.has(specifier)) {
      throw new Error(`No node test double for ${specifier}; add it to _leafStubs.ts and LEAF_STUBBED`)
    }
    return next(new URL('./_leafStubs.ts', import.meta.url).href, context)
  }
  const rel = specifier.startsWith('./') || specifier.startsWith('../')
  const hasExt = /\.(m|c)?(t|j)s$/.test(specifier)
  if (rel && !hasExt) {
    try {
      return await next(specifier + '.ts', context)
    } catch {
      // fall through to default
    }
  }
  return next(specifier, context)
}
