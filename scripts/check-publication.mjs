import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import { join, extname } from 'node:path'

const tracked = process.argv[2] === '--tracked'
const root = tracked ? undefined : process.argv[2]
let files
if (root) {
  async function walk(directory) {
    const result = []
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      result.push(...(entry.isDirectory() ? await walk(path) : [path]))
    }
    return result
  }
  files = await walk(root)
} else {
  const git = spawnSync('git', tracked ? ['ls-files', '-z', '--cached'] : ['diff', '--cached', '--name-only', '-z'], { encoding: 'utf8' })
  assert.equal(git.status, 0)
  files = git.stdout.split('\0').filter(Boolean)
  assert.ok(files.length, 'Stage the explicit public file set before scanning')
}
const sensitiveNames = /(?:^|[/\\])(?:\.env(?:\..*)?|\.agents|\.codex|AGENTS\.md|GENERATION_BENCHMARK\.json|node_modules|\.git|coverage)(?:[/\\]|$)/i
const rules = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/],
  ['API key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b/],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['personal email', /[A-Z0-9._%+-]+@(?:gmail|hotmail|outlook|live|yahoo|icloud)\.[A-Z]{2,}/i],
  ['local user path', /(?:[A-Z]:[/\\]+Users[/\\]+|\/Users\/|\/home\/)[^\s"']+/i],
  ['cloud-synced desktop', /OneDrive[/\\]+|Escritorio[/\\]+/i],
]
const failures = []
for (const file of files) {
  if (sensitiveNames.test(file)) failures.push(`${file}: excluded local filename`)
  assert.ok(!file.endsWith('.map'), 'Source maps must not be public')
  if (extname(file) === '.png') continue
  const content = root ? await readFile(file, 'utf8') : spawnSync('git', ['show', `:${file}`], { encoding: 'utf8' }).stdout
  // The scanner necessarily contains its own detection patterns, not real credentials.
  if (file.replaceAll('\\', '/') === 'scripts/check-publication.mjs') continue
  for (const [name, pattern] of rules) if (pattern.test(content)) failures.push(`${file}: ${name}`)
}
assert.deepEqual(failures, [], `Publication scan failed (matching values are deliberately withheld): ${failures.join(', ')}`)
console.log(`Publication scan passed for ${files.length} ${root ? 'artifact' : 'staged'} files; no matching secrets, personal emails or local user paths.`)
