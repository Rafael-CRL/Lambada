import { useEffect, useState, type ReactNode } from 'react'
import { listInputDevices, micSupported } from '../audio/microphone'
import { db, saveSettings, type Settings } from '../db/db'
import { SCALE_LABELS, type ScaleId } from '../domain/scales'
import { Button, Segmented, Stepper, Toggle } from '../ui/controls'

export function SettingsScreen({ settings }: { settings: Settings }) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceError, setDeviceError] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)

  const refreshDevices = async (ask: boolean) => {
    setDeviceError('')
    try {
      if (ask) {
        // rótulos só aparecem depois da permissão
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((t) => t.stop())
      }
      setDevices(await listInputDevices())
    } catch (e) {
      setDeviceError(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    void refreshDevices(false)
  }, [])

  const labelled = devices.some((d) => d.label)

  return (
    <div className="flex flex-col gap-10 py-4">
      <h1 className="text-2xl font-semibold">configurações</h1>

      <Group title="exercícios">
        <Row label="escala" hint="Solta: casas 0–3 com cordas soltas. Fechada: até a casa 5.">
          <Segmented<ScaleId>
            label="Escala"
            value={settings.scale}
            onChange={(scale) => saveSettings({ scale })}
            options={(['solta', 'fechada'] as const).map((v) => ({ value: v, label: SCALE_LABELS[v] }))}
          />
        </Row>
        <Row label="acidentes" hint="Inclui ♯ e ♭ (sem Mi♯, Si♯, Dó♭, Fá♭). Entram depois das naturais dominadas.">
          <Toggle label="Acidentes" checked={settings.accidentals} onChange={(accidentals) => saveSettings({ accidentals })} />
        </Row>
        <Row label="notas por sessão" hint="Esteira, Adaptativo e BPM.">
          <Stepper label="notas por sessão" value={settings.sessionLength} min={10} max={120} step={5} onChange={(sessionLength) => saveSettings({ sessionLength })} />
        </Row>
        <Row label="repetições por nota" hint="Pauta → violão, modo Repetição.">
          <Stepper label="repetições por nota" value={settings.repetitions} min={1} max={10} onChange={(repetitions) => saveSettings({ repetitions })} />
        </Row>
      </Group>

      <Group title="modo BPM">
        <Row label="andamento">
          <Stepper label="BPM" value={settings.bpm} min={30} max={200} step={5} format={(v) => `${v} bpm`} onChange={(bpm) => saveSettings({ bpm })} />
        </Row>
        <Row label="tolerância" hint="Janela em torno de cada tempo em que o toque conta.">
          <Stepper label="tolerância" value={settings.toleranceMs} min={40} max={300} step={10} format={(v) => `±${v} ms`} onChange={(toleranceMs) => saveSettings({ toleranceMs })} />
        </Row>
        <Row
          label="compensação de latência"
          hint="Some ao atraso medido do microfone. Se o resumo do BPM indicar tendência de atraso constante, aumente."
        >
          <Stepper label="latência" value={settings.latencyMs} min={-100} max={300} step={5} format={(v) => `${v} ms`} onChange={(latencyMs) => saveSettings({ latencyMs })} />
        </Row>
      </Group>

      <Group title="áudio">
        <Row label="dispositivo de entrada">
          {micSupported() ? (
            <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
              <select
                value={settings.audioDeviceId}
                onChange={(e) => saveSettings({ audioDeviceId: e.target.value })}
                className="min-h-11 w-full rounded-lg bg-surface px-3 text-sm text-text sm:w-72"
                aria-label="Dispositivo de entrada"
              >
                <option value="">padrão do sistema</option>
                {devices
                  .filter((d) => d.deviceId && d.deviceId !== 'default')
                  .map((d, i) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `entrada ${i + 1}`}
                    </option>
                  ))}
              </select>
              {!labelled && (
                <Button variant="ghost" className="self-end" onClick={() => refreshDevices(true)}>
                  permitir microfone para ver os nomes
                </Button>
              )}
              {deviceError && <span className="text-xs text-err">{deviceError}</span>}
            </div>
          ) : (
            <span className="text-sm text-err">microfone indisponível neste contexto (use localhost ou HTTPS)</span>
          )}
        </Row>
      </Group>

      <Group title="aparência">
        <Row label="tema">
          <Segmented
            label="Tema"
            value={settings.theme}
            onChange={(theme) => saveSettings({ theme })}
            options={[
              { value: 'dark', label: 'escuro' },
              { value: 'light', label: 'claro' },
            ]}
          />
        </Row>
      </Group>

      <Group title="dados">
        <Row label="apagar progresso" hint="Estatísticas, notas liberadas, histórico e recordes. As configurações ficam.">
          {confirmReset ? (
            <div className="flex gap-2">
              <Button onClick={() => setConfirmReset(false)}>cancelar</Button>
              <Button
                className="bg-err text-accent-ink hover:bg-err hover:brightness-110"
                onClick={async () => {
                  await Promise.all([db.itemStats.clear(), db.unlocks.clear(), db.sessions.clear(), db.records.clear(), db.meta.clear()])
                  setConfirmReset(false)
                }}
              >
                apagar tudo
              </Button>
            </div>
          ) : (
            <Button onClick={() => setConfirmReset(true)}>apagar…</Button>
          )}
        </Row>
      </Group>
    </div>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="mb-2 text-sm font-medium text-accent">{title}</h2>
      <div className="flex flex-col divide-y divide-line/60">{children}</div>
    </section>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">{label}</span>
        {hint && <span className="text-sm text-sub">{hint}</span>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
