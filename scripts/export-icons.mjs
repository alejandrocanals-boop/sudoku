import { readFile, writeFile } from 'node:fs/promises'
import { openBrowserPage } from './browser-client.mjs'

const page = await openBrowserPage(process.argv[2])
try {
  const svg = await readFile('public/icons/sudoku.svg', 'utf8')
  for (const [size, filename] of [[192, 'icon-192.png'], [512, 'icon-512.png'], [180, 'apple-touch-icon.png']]) {
    const png = await page.evaluate(`(async()=>{
      const url=URL.createObjectURL(new Blob([${JSON.stringify(svg)}],{type:'image/svg+xml'}));
      const image=new Image();image.src=url;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=${size};canvas.height=${size};
      canvas.getContext('2d').drawImage(image,0,0,${size},${size});URL.revokeObjectURL(url);
      return canvas.toDataURL('image/png').split(',')[1];})()`)
    await writeFile(`public/icons/${filename}`, Buffer.from(png, 'base64'))
  }
  console.log('Exported approved SVG to 192, 512 and 180 px PNGs.')
} finally { await page.close() }
