/// <reference types="vitest/config" />
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** Só em desenvolvimento: o gravador (`#/gravar`) salva as gravações de teste do detector. */
function fixtures(): Plugin {
  const root = fileURLToPath(new URL('./src/audio/fixtures/', import.meta.url))
  const MAX = 64 * 1024 * 1024
  return {
    name: 'lambada-fixtures',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__fixtures', (req, res) => {
        const fail = (code: number) => {
          res.statusCode = code
          res.end()
        }
        // o servidor escuta a rede (Docker); gravar e apagar, só desta máquina
        const host = (req.headers.host ?? '').replace(/:\d+$/, '')
        if (host !== 'localhost' && host !== '127.0.0.1') return fail(403)
        const params = new URL(req.url ?? '', 'http://x').searchParams
        // sessao/: as tomadas da tela de teste da escala (fora do git e do teste)
        const dir = params.get('dir') === 'sessao' ? `${root}sessao/` : root
        if (req.method === 'GET') {
          let names: string[] = []
          try {
            names = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5))
          } catch {
            /* pasta ainda não existe */
          }
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify(names))
        }
        if (req.method === 'DELETE') {
          const name = params.get('name') ?? ''
          if (!/^[a-z0-9-]+$/.test(name)) return fail(400)
          try {
            rmSync(`${dir}${name}.wav`, { force: true })
            rmSync(`${dir}${name}.json`, { force: true })
            return res.end()
          } catch {
            return fail(500)
          }
        }
        const file = params.get('file') ?? ''
        if (req.method !== 'POST' || !/^[a-z0-9-]+\.(wav|json)$/.test(file)) return fail(400)
        const body: Buffer[] = []
        let size = 0
        req.on('data', (b: Buffer) => {
          size += b.length
          if (size > MAX) req.destroy()
          else body.push(b)
        })
        req.on('end', () => {
          try {
            mkdirSync(dir, { recursive: true })
            writeFileSync(dir + file, Buffer.concat(body))
            res.end()
          } catch {
            fail(500)
          }
        })
      })
    },
  }
}

export default defineConfig({
  // caminhos relativos: o build roda em qualquer subpasta (GitHub Pages)
  base: './',
  plugins: [react(), tailwindcss(), fixtures()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
