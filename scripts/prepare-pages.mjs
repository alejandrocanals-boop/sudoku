import assert from 'node:assert/strict'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join, extname } from 'node:path'

// Keep audit maps locally; never publish their absolute build-machine paths.
const source = 'dist'
const destination = 'dist-pages'
const allowed = new Set(['.html', '.js', '.css', '.png', '.svg', '.webmanifest'])
await mkdir(destination, { recursive: true })
assert.deepEqual(await readdir(destination), [], 'dist-pages must be empty; use a fresh build workspace')
async function copy(directory = '') {
  for (const entry of await readdir(join(source, directory), { withFileTypes: true })) {
    const relative = join(directory, entry.name)
    if (entry.isDirectory()) {
      assert.ok(['assets', 'icons'].includes(relative), 'Unexpected public build directory')
      await mkdir(join(destination, relative), { recursive: true })
      await copy(relative)
    } else {
      if (entry.name.endsWith('.map')) continue
      assert.ok(allowed.has(extname(entry.name)), `Unexpected public file: ${relative}`)
      let content = await readFile(join(source, relative))
      if (entry.name.endsWith('.js')) content = Buffer.from(content.toString().replace(/^\/\/# sourceMappingURL=.*$/gm, ''))
      await writeFile(join(destination, relative), content)
    }
  }
}
await copy()
await writeFile(join(destination, '.nojekyll'), '')
console.log('Pages artifact prepared without source maps or local build paths.')
