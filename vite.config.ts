/// <reference types="vitest/config" />
import { existsSync, mkdirSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
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
        // e só das páginas do próprio app: outro site aberto no navegador também fala com localhost
        const origin = req.headers.origin
        if (origin && origin !== `http://${req.headers.host}`) return fail(403)
        const params = new URL(req.url ?? '', 'http://x').searchParams
        // sessao/: as tomadas da tela de teste da escala (fora do git e do teste)
        const dir = params.get('dir') === 'sessao' ? `${root}sessao/` : root
        if (req.method === 'GET') {
          let names: string[] = []
          try {
            // um .wav sem .json (o .json não chegou) também ocupa o nome
            names = [...new Set(readdirSync(dir).flatMap((f) => (/\.(wav|json)$/.test(f) ? [f.replace(/\.(wav|json)$/, '')] : [])))]
          } catch {
            /* pasta ainda não existe */
          }
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify(names))
        }
        // descartar guarda em descartadas/ (fora do git), para dar para recuperar
        if (req.method === 'DELETE') {
          const name = params.get('name') ?? ''
          if (!/^[a-z0-9-]+$/.test(name)) return fail(400)
          try {
            const to = `${dir}descartadas/`
            mkdirSync(to, { recursive: true })
            // o nome volta a ficar livre na pasta principal: não sobrescrever um descarte antigo
            const kept = existsSync(`${to}${name}.json`) || existsSync(`${to}${name}.wav`) ? `${name}-${Date.now()}` : name
            for (const ext of ['wav', 'json'])
              if (existsSync(`${dir}${name}.${ext}`)) renameSync(`${dir}${name}.${ext}`, `${to}${kept}.${ext}`)
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
            // nunca por cima: uma lista desatualizada no gravador apagaria uma gravação corrigida à mão
            writeFileSync(dir + file, Buffer.concat(body), { flag: 'wx' })
            res.end()
          } catch (e) {
            fail((e as NodeJS.ErrnoException).code === 'EEXIST' ? 409 : 500)
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
