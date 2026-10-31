import { Moon, Sun, Contrast, Volume2, Sparkles, WifiOff } from 'lucide-react'
import { useSettings, TEXT_SCALES } from '../core/settings.jsx'
import { useAi } from '../core/ai.js'
import { speak, canSpeak, useVoices } from '../core/speech.js'
import { LANGS, useT } from '../core/i18n.js'
import { Sheet, Segmented, Switch, Button, Badge } from './kit.jsx'

/**
 * Display, voice, and language settings.
 * Pass `language` + `onLanguage` to show the language picker (patient side).
 */
export default function SettingsSheet({ open, onClose, lang = 'en', language, onLanguage, voiceControls = true, extra }) {
  const [s, set] = useSettings()
  const ai = useAi()
  const voices = useVoices()
  const t = useT(lang)

  return (
    <Sheet open={open} onClose={onClose} title={t('settings.title')}>
      <section className="sheet-section" aria-labelledby="set-theme">
        <h3 id="set-theme" className="label">
          {t('settings.theme')}
        </h3>
        <Segmented
          label={t('settings.theme')}
          value={s.theme}
          onChange={(theme) => set({ theme })}
          options={[
            { value: 'dark', label: <span className="row" style={{ '--gap': '6px' }}><Moon size={16} aria-hidden="true" />{t('settings.dark')}</span>, aria: t('settings.dark') },
            { value: 'light', label: <span className="row" style={{ '--gap': '6px' }}><Sun size={16} aria-hidden="true" />{t('settings.light')}</span>, aria: t('settings.light') },
            { value: 'contrast', label: <span className="row" style={{ '--gap': '6px' }}><Contrast size={16} aria-hidden="true" />{t('settings.contrast')}</span>, aria: t('settings.contrast') },
          ]}
        />
      </section>

      <section className="sheet-section" aria-labelledby="set-text">
        <h3 id="set-text" className="label">
          {t('settings.text')}
        </h3>
        <Segmented
          label={t('settings.text')}
          value={s.textScale}
          onChange={(textScale) => set({ textScale })}
          options={TEXT_SCALES.map((x, i) => ({
            value: x.value,
            aria: x.label,
            label: <span style={{ fontSize: `${0.85 + i * 0.14}rem`, fontWeight: 700 }}>A</span>,
          }))}
        />
        <Switch checked={s.reduceMotion} onChange={(reduceMotion) => set({ reduceMotion })}>
          {t('settings.motion')}
        </Switch>
      </section>

      {language !== undefined && onLanguage && (
        <section className="sheet-section">
          <label htmlFor="set-lang" className="label">
            {t('settings.language')}
          </label>
          <select id="set-lang" className="select" value={language} onChange={(e) => onLanguage(e.target.value)}>
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.native} {l.native !== l.name ? `· ${l.name}` : ''}
              </option>
            ))}
          </select>
          {language !== 'en' && ai.state !== 'ready' && (
            <p className="small muted row" style={{ '--gap': '6px' }}>
              <WifiOff size={14} aria-hidden="true" /> {t('settings.aiOff')}
            </p>
          )}
        </section>
      )}

      {voiceControls && canSpeak && (
        <section className="sheet-section" aria-labelledby="set-voice">
          <h3 id="set-voice" className="label">
            {t('settings.voice')}
          </h3>
          <Switch checked={s.voice} onChange={(voice) => set({ voice })}>
            {t('settings.voiceOn')}
          </Switch>
          <div className="field">
            <label htmlFor="set-rate">
              {t('settings.rate')} <span className="muted">· {s.rate.toFixed(1)}×</span>
            </label>
            <input id="set-rate" className="range" type="range" min="0.6" max="1.6" step="0.1" value={s.rate} onChange={(e) => set({ rate: Number(e.target.value) })} />
          </div>
          {voices.length > 0 && (
            <select aria-label={t('settings.voice')} className="select" value={s.voiceURI ?? ''} onChange={(e) => set({ voiceURI: e.target.value || null })}>
              <option value="">Default voice</option>
              {voices.slice(0, 60).map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          )}
          <Button variant="secondary" icon={Volume2} onClick={() => speak(t('settings.testPhrase'), { rate: s.rate, voiceURI: s.voiceURI })}>
            {t('settings.test')}
          </Button>
        </section>
      )}

      <section className="sheet-section">
        <h3 className="label">{t('settings.ai')}</h3>
        <p className="row small" style={{ '--gap': '8px' }}>
          {ai.state === 'ready' ? (
            <Badge tone="mint" icon={Sparkles}>
              {ai.provider === 'huggingface' ? 'Hugging Face' : ai.provider === 'anthropic' ? 'Claude' : 'AI'}
              {ai.model ? ` · ${ai.model.split('/').pop()}` : ''}
            </Badge>
          ) : (
            <Badge icon={WifiOff}>Offline</Badge>
          )}
          <span className="muted">{ai.state === 'ready' ? t('settings.aiOn') : t('settings.aiOff')}</span>
        </p>
      </section>

      {extra}
    </Sheet>
  )
}
