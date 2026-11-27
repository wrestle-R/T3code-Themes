'use client';

import Link from 'next/link';
import { ArrowDown, ArrowLeft, RotateCcw, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { minecraftMobs, pondProviders, themes } from '../themes';
import { ThemePreview, useTheme } from './theme-preview';
import { DownloadAction, RangeField, SwitchField } from './ui';
import { validateTheme } from '../lib/theme-format.mjs';
import '../studio.css';

const agentLimit = 3;
const backgrounds = [['dark', 'Dark base'], ['light', 'Light base']];

function configureTheme(base, values, slug) {
  if (slug === 'minecraft') {
    const overrides = [];
    if (Object.hasOwn(minecraftMobs, values.mob)) {
      overrides.push(`--mc-picked-buddy: var(--mc-${values.mob});`);
      overrides.push(`--mc-picked-fast: var(--mc-${values.mob}-fast);`);
      overrides.push(`--mc-picked-heavy: var(--mc-${values.mob}-heavy);`);
    }
    if (values.still) overrides.push('--theme-motion-state: paused;');
    return overrides.length ? { ...base, css: base.css + `\n:root { ${overrides.join(' ')} }\n` } : base;
  }
  if (slug === 'nightfall-christmas') {
    const defaults = themes[slug].defaults;
    if (!values.still && Object.keys(defaults).every(key => values[key] === defaults[key])) return base;
    const duration = 40 - values['snow-speed'] * .5;
    return {
      ...base, canvas: values.dark,
      colors: { ...base.colors, canvas: values.dark },
      variants: { ...base.variants, light: { ...base.variants.light, canvas: values.light } },
      css: base.css + `\n:root {
        --nightfall-snow-intensity: ${values['snow-intensity'] / 45};
        --nightfall-snow-density: ${Math.max(.2, values['snow-intensity'] / 45)};
        --nightfall-snow-duration: ${duration}s;
        --nightfall-light-brightness: ${values['light-brightness'] / 100};
        --nightfall-snowmen: ${values.snowmen ? 1 : 0};
        --theme-motion-state: ${values.still ? 'paused' : 'running'};
      }
      :root.dark, :root:not(.dark) { --nightfall-ledge: var(${values.accumulation ? '--nightfall-snowy' : '--nightfall-bare'}); }\n`,
    };
  }
  if (themes[slug]?.motionLabel) {
    return values.still
      ? { ...base, css: base.css + '\n:root { --theme-motion-state: paused; }\n' }
      : base;
  }

  if (slug !== 'koi-pond' && slug !== 'dark-texture') return base;

  const dark = values.dark;
  const light = values.light;
  let css;

  if (slug === 'koi-pond') {
    const speeds = pondProviders.map(provider => {
      const name = provider.toLowerCase();
      return `--koi-${name}-time: ${values[name + '-time']}s;`;
    });
    css = `:root {
  --koi-water-dark: ${dark};
  --koi-water-light: ${light};
  ${speeds.join(' ')}
}`;
    if (values.still) {
      css += '\n[data-workspace-area="conversation"]::before, [data-workspace-area="conversation"]::after, [data-assistant-citation-viewport]::before, [data-assistant-citation-viewport]::after { animation: none !important; }';
    }
  } else {
    css = `:root {
  --texture-dark: ${dark};
  --texture-light: ${light};
  --texture-grain: ${values['grain-strength'] / 100};
}`;
  }

  return {
    ...base,
    canvas: dark,
    variants: { ...base.variants, light: { ...base.variants.light, canvas: light } },
    css: base.css + '\n' + css + '\n',
  };
}

const paletteFields = {
  canvas: 'Workspace background', text: 'Main text', textMuted: 'Muted text',
  sidebar: 'Sidebar background', sidebarForeground: 'Sidebar text', sidebarMutedForeground: 'Sidebar muted text',
  sidebarRowSelected: 'Selected thread', toolbar: 'Toolbar background', toolbarForeground: 'Toolbar text',
  surfaceRaised: 'Composer background', messageSurface: 'Message background', messageForeground: 'Message text',
  accent: 'Accent', accentForeground: 'Accent text', border: 'Borders',
};
const previewFallbacks = {
  light: { canvas: '#e5e5e5', text: '#222222', textMuted: '#555555', sidebar: '#ececec', surfaceRaised: '#fcfcfc', border: '#d4d4d4' },
  dark: { canvas: '#101010', text: '#fafafa', textMuted: '#aaaaaa', sidebar: '#1b1b1b', surfaceRaised: '#202020', border: '#383838' },
};
const surfaceRules = {
  sidebar: ['[data-slot="sidebar"]', 'background-color'],
  sidebarForeground: ['[data-slot="sidebar"]', 'color'],
  sidebarRowSelected: ['[data-sidebar-row][aria-current="page"]', 'background-color'],
  toolbar: ['[data-chat-header]', 'background-color'],
  toolbarForeground: ['[data-chat-header]', 'color'],
  surfaceRaised: ['[data-chat-composer-main-surface]', 'background-color'],
  messageSurface: ['[data-user-message-bubble]', 'background-color'],
  messageForeground: ['[data-user-message-bubble]', 'color'],
};

function applyPalette(config, edited) {
  if (!Object.keys(edited.light).length && !Object.keys(edited.dark).length) return config;
  // A theme can paint a surface directly in CSS. Preserve the original effects
  // and apply explicit color edits to the same surfaces in the desktop app.
  const styles = Object.entries(edited).flatMap(([mode, palette]) =>
    Object.entries(palette).filter(([token]) => Object.hasOwn(surfaceRules, token)).map(([token, color]) => {
      const [selector, property] = surfaceRules[token];
      const root = mode === 'dark' ? ':root.dark' : ':root:not(.dark)';
      return `${root} ${selector} { ${property}: ${color} !important; }`;
    }));
  return {
    ...config,
    variants: {
      ...config.variants,
      light: { ...config.variants?.light, ...edited.light },
      dark: { ...config.variants?.dark, ...edited.dark },
    },
    css: config.css + (styles.length ? '\n' + styles.join('\n') + '\n' : ''),
  };
}

function swatchValue(value, fallback = '#808080') {
  if (/^#[a-f\d]{6}$/i.test(value)) return value;
  if (/^#[a-f\d]{3}$/i.test(value)) return '#' + [...value.slice(1)].map(digit => digit + digit).join('');
  return fallback;
}

function ColorField({ name, label, value, draft, onSwatch, onHex, onCommit }) {
  const invalid = draft != null && !/^#?[\da-f]{6}$/i.test(draft);

  return (
    <div className="color-setting" data-color-appearance={name}>
      <label htmlFor={name + '-swatch'}>{label}</label>
      <input id={name + '-swatch'} name={name} type="color" value={swatchValue(value)} onChange={event => onSwatch(name, event.target.value)} />
      <input
        type="text"
        aria-label={label + ' hex'}
        aria-describedby={name + '-error'}
        aria-invalid={invalid}
        spellCheck={false}
        autoComplete="off"
        maxLength={7}
        value={draft ?? (value || '').toUpperCase()}
        onChange={event => onHex(name, event.target.value)}
        onBlur={() => { if (!invalid) onCommit(name); }}
      />
      <p className="hex-error" id={name + '-error'} aria-live="polite">{invalid ? 'Enter 6 hex digits, like #E8EDE9.' : ''}</p>
    </div>
  );
}

function ProviderDot({ provider }) {
  return <span className="provider-dot" data-provider={provider} aria-hidden="true" />;
}

function SubagentTest({ parent, setParent, agents, running, spawn, finish, disabled }) {
  return (
    <section className="school-controls" aria-labelledby="school-title">
      <header className="school-heading">
        <h2 id="school-title">Test subagents</h2>
        <span className="school-count" role="status">{running} of {agentLimit} running</span>
      </header>
      <p className="school-description">Add up to three subagents to the main thread preview.</p>
      <fieldset className="school-fields" disabled={disabled}>
        <label className="parent-control">Main thread model
          <select value={parent} onChange={event => setParent(event.target.value)}>
            {pondProviders.map(provider => <option key={provider}>{provider}</option>)}
          </select>
        </label>
        <div className="add-agent-control" role="group" aria-labelledby="add-agent-label">
          <span id="add-agent-label">Add a subagent</span>
          <div className="add-agents">
            {pondProviders.map(provider => (
              <button className="open-theme" type="button" key={provider} onClick={() => spawn(provider)} disabled={running >= agentLimit} aria-label={'Add ' + provider + ' subagent'}>
                <ProviderDot provider={provider} /> {provider}
              </button>
            ))}
          </div>
        </div>
      </fieldset>
      {running > 0 && (
        <ul className="agent-list" aria-label="Running subagents">
          {agents.filter(agent => agent.running).map(agent => (
            <li key={agent.id}>
              <button className="open-theme finish-agent" type="button" onClick={() => finish(agent.id)} aria-label={'Finish ' + agent.provider + ' subagent'} title={'Finish ' + agent.provider + ' subagent'}>
                <ProviderDot provider={agent.provider} /> {agent.provider}
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function InstallInstructions({ name }) {
  return (
    <section id="install" className="studio-note" aria-labelledby="install-title">
      <h2 id="install-title">Install {name}</h2>
      <ol>
        <li>Download your theme JSON.</li>
        <li>In T3 Code, open <strong>Settings → Appearance</strong> and choose <strong>Import a file</strong>.</li>
        <li>Open the JSON and select <strong>{name}</strong> in the theme picker.</li>
      </ol>
    </section>
  );
}

export function ThemeStudio({ slug, theme = themes[slug], initialConfig }) {
  const isPond = slug === 'koi-pond';
  const isMinecraft = slug === 'minecraft';
  const hasBackgrounds = Boolean(theme.defaults.dark);
  const hasAgents = isPond || slug === 'nightfall-christmas' || slug === 'minecraft-retro';
  const defaultParent = theme.previewProvider || 'OpenAI';
  const { config, error } = useTheme(theme.download, initialConfig);
  const [editing, setEditing] = useState(false);
  const [imported, setImported] = useState(null);
  const [importStatus, setImportStatus] = useState('');
  const [palette, setPalette] = useState({ light: {}, dark: {} });
  const fileInput = useRef(null);
  const [values, setValues] = useState(theme.defaults);
  const [drafts, setDrafts] = useState({});
  const [appearance, setAppearance] = useState(theme.appearance || 'dark');
  const [parent, setParent] = useState(defaultParent);
  const [agents, setAgents] = useState([]);
  const [activity, setActivity] = useState('Idle');
  const [reasoning, setReasoning] = useState('Low');
  const running = agents.filter(agent => agent.running).length;
  const base = imported || config;
  const motionChanged = Object.entries(values).some(([key, value]) => theme.defaults[key] !== value);
  const sameTheme = !imported || imported.id === config?.id;
  const configured = base && applyPalette(sameTheme && motionChanged ? configureTheme(base, values, slug) : base, palette);
  const colors = {
    ...previewFallbacks[appearance], canvas: configured?.canvas, accent: configured?.accent,
    ...configured?.colors, ...configured?.variants?.[appearance],
  };
  const extraTokens = Object.keys(colors).filter(token => !Object.hasOwn(paletteFields, token)).sort();
  const invalid = Object.values(drafts).some(draft => draft != null && !/^#?[\da-f]{6}$/i.test(draft));
  const canReset = imported || Object.keys(palette.dark).length || Object.keys(palette.light).length || invalid || values.still || agents.length > 0 || parent !== defaultParent
    || activity !== 'Idle' || reasoning !== 'Low'
    || Object.entries(theme.defaults).some(([name, value]) => values[name] !== value);

  function updateValue(name, value) {
    setValues(current => ({ ...current, [name]: value }));
  }

  function clearDraft(name) {
    setDrafts(current => ({ ...current, [name]: null }));
  }

  function updateBackground(name, value) {
    updateValue(name, value);
    if (isPond) setAppearance(name);
  }

  function updateSwatch(name, value) {
    clearDraft(name);
    updateBackground(name, value);
  }

  function updateHex(name, draft) {
    setDrafts(current => ({ ...current, [name]: draft }));
    if (/^#?[\da-f]{6}$/i.test(draft)) {
      updateBackground(name, '#' + draft.replace(/^#/, '').toLowerCase());
    }
  }

  function editPalette(name, value) {
    const [mode, token] = name.split(':');
    setPalette(current => ({ ...current, [mode]: { ...current[mode], [token]: value } }));
  }

  function renderPaletteField(token, label) {
    const name = appearance + ':' + token;
    return <ColorField key={name} name={name} label={label} value={colors[token] || '#808080'} draft={drafts[name]}
      onSwatch={(id, color) => { clearDraft(id); editPalette(id, color); }}
      onHex={(id, draft) => {
        setDrafts(current => ({ ...current, [id]: draft }));
        if (/^#?[\da-f]{6}$/i.test(draft)) editPalette(id, '#' + draft.replace(/^#/, '').toLowerCase());
      }} onCommit={clearDraft} />;
  }

  async function importTheme(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 250_000) throw new Error('Choose a theme JSON under 250 KB.');
      const next = validateTheme(JSON.parse(await file.text()));
      setImported(next);
      setValues(theme.defaults);
      setDrafts({});
      setPalette({ light: {}, dark: {} });
      setAppearance(next.appearance);
      setImportStatus('Imported ' + next.name + '.');
    } catch {
      setImportStatus('Could not import that file. Choose a valid T3 Code theme JSON.');
    }
  }

  function spawn(provider) {
    setAgents(current => {
      const active = current.filter(agent => agent.running).length;
      if (active >= agentLimit) return current;
      const next = { provider, running: true, id: Math.max(0, ...current.map(agent => agent.id)) + 1 };
      if (!active) return [next];
      const finishedSlot = current.findIndex(agent => !agent.running);
      return finishedSlot === -1 ? [...current, next] : current.map((agent, slot) => slot === finishedSlot ? next : agent);
    });
  }

  function finish(id) {
    setAgents(current => current.map(agent => agent.id === id ? { ...agent, running: false } : agent));
  }

  function reset(event) {
    event.preventDefault();
    setValues(theme.defaults);
    setDrafts({});
    setParent(defaultParent);
    setAgents([]);
    setActivity('Idle');
    setReasoning('Low');
    setImported(null);
    setPalette({ light: {}, dark: {} });
    setImportStatus('');
    setAppearance(theme.appearance || 'dark');
  }

  function download(event) {
    event.preventDefault();
    if (!configured || invalid) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(configured, null, 2) + '\n'], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = (imported?.id || slug) + '.json';
    fetch('/api/theme-stats', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, download: true }), keepalive: true }).catch(() => {});
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <main className="wrap studio" id="main" data-studio={slug}>
      <header className="studio-intro">
        <div>
          <Link href="/#themes" className="text-link back-link"><ArrowLeft size={16} aria-hidden="true" /> Collection</Link>
          <h1>{imported?.name || theme.name}</h1>
          <p>{theme.studioDescription}</p>
          {!imported && theme.author && <p className="theme-byline">
            By {theme.github ? <a href={theme.github}>{theme.author}</a> : theme.author}
            {theme.website && <> · <a href={theme.website}>Website</a></>}
          </p>}
        </div>
        <div className="studio-header-actions">
          <input type="file" accept=".json,application/json" ref={fileInput} onChange={importTheme} aria-label="Import theme file" hidden />
          <button type="button" className="open-theme" onClick={() => fileInput.current.click()}><Upload size={15} aria-hidden="true" /> Import JSON</button>
          <button type="button" className="open-theme studio-customize-toggle" aria-pressed={editing} aria-controls="customize" onClick={() => setEditing(current => !current)}>{editing ? 'Full preview' : 'Customize'}</button>
          <a className="text-link studio-customize-link" href="#customize">Customize</a>
          <a className="text-link install-link" href="#install">Install <ArrowDown size={16} aria-hidden="true" /></a>
        </div>
      </header>

      {importStatus && <p className="import-status" role="status">{importStatus}</p>}
      <div className="studio-workspace" data-editing={editing || undefined}>
      <section className="studio-stage" aria-label={theme.name + ' preview'}>
          <ThemePreview slug={slug} theme={theme} config={configured} error={error && !imported} appearance={appearance} onAppearanceChange={setAppearance} studio parent={parent} agents={agents} activity={activity} mob={values.mob}
            reasoning={isMinecraft ? reasoning : undefined}
            onMobChange={isMinecraft && sameTheme ? mob => updateValue('mob', mob) : undefined} />
      </section>

      <div className="studio-layout">
        <div className="studio-sidebar">
          <section className="studio-settings" id="customize" aria-labelledby="settings-title">
            <h2 id="settings-title">Customize</h2>
            {error && !imported ? (
              <p className="studio-fallback">Customization is unavailable. <a className="open-theme" href={theme.download} download>Download original theme</a></p>
            ) : (
              <form id="theme-settings" onSubmit={download} onReset={reset}>
                <fieldset className="settings-controls" disabled={!configured}>
                  <fieldset className="palette-fields">
                    <legend>{appearance === 'dark' ? 'Dark palette' : 'Light palette'}</legend>
                    {Object.entries(paletteFields).filter(([token]) => token !== 'canvas' || !hasBackgrounds || !sameTheme)
                      .map(([token, label]) => renderPaletteField(token, label))}
                    {extraTokens.length > 0 && <details><summary>More color tokens</summary>
                      {extraTokens.map(token => renderPaletteField(token, token.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, char => char.toUpperCase())))}
                    </details>}
                  </fieldset>
                  {sameTheme && <div className="motion-fields">
                  {isMinecraft && <>
                    <label className="parent-control mob-activity">Main thread model
                      <select value={parent} onChange={event => setParent(event.target.value)}>
                        <optgroup label="Fast · Iron pickaxe">
                          <option value="Claude|Haiku 4.5">Claude Haiku 4.5</option>
                          <option value="Gemini|Flash">Gemini Flash</option>
                        </optgroup>
                        <optgroup label="Balanced · Diamond sword">
                          <option value="Claude|Sonnet 4.6">Claude Sonnet 4.6</option>
                          <option value="OpenAI|GPT-5">OpenAI GPT-5</option>
                          <option value="OpenCode">OpenCode</option>
                        </optgroup>
                        <optgroup label="Flagship · Netherite sword">
                          <option value="Claude">Claude Opus</option>
                          <option value="Gemini">Gemini Pro</option>
                          <option value="OpenAI">OpenAI 6.1 Sol</option>
                          <option value="OpenAI|6.2 Sol Medium">OpenAI 6.2 Sol Medium</option>
                        </optgroup>
                      </select>
                    </label>
                    <label className="parent-control mob-activity">Reasoning level
                      <select value={reasoning} onChange={event => setReasoning(event.target.value)}>
                        {['Low', 'Medium', 'High'].map(level => <option key={level}>{level}</option>)}
                      </select>
                    </label>
                    <label className="parent-control mob-activity">Preview activity
                      <select value={activity} onChange={event => setActivity(event.target.value)}>
                        {['Idle', 'Reasoning', 'Coding', 'Approval', 'Error', 'Background'].map(state => <option key={state}>{state}</option>)}
                      </select>
                    </label>
                  </>}
                  {hasBackgrounds && slug !== 'nightfall-christmas' && <fieldset>
                    <legend>Background</legend>
                    {backgrounds.map(([name, label]) => (
                      <ColorField key={name} name={name} label={label} value={imported && !motionChanged ? swatchValue(imported.variants?.[name]?.canvas || (name === 'dark' && imported.canvas), values[name]) : values[name]} draft={drafts[name]} onSwatch={updateSwatch} onHex={updateHex} onCommit={clearDraft} />
                    ))}
                    {slug === 'dark-texture' && (
                      <RangeField name="grain-strength" label="Grain strength" value={values['grain-strength']} onChange={updateValue} disabled={!configured} />
                    )}
                  </fieldset>}
                  {slug === 'nightfall-christmas' && <>
                    <fieldset><legend>Background</legend>
                      {backgrounds.map(([name,label]) => <ColorField key={name} name={name} label={label} value={imported && !motionChanged ? swatchValue(imported.variants?.[name]?.canvas || (name === 'dark' && imported.canvas), values[name]) : values[name]} draft={drafts[name]} onSwatch={updateSwatch} onHex={updateHex} onCommit={clearDraft} />)}
                    </fieldset>
                    <fieldset><legend>Snowfall</legend>
                      <RangeField name="snow-intensity" label="Snowfall intensity" value={values['snow-intensity']} onChange={updateValue} />
                      <RangeField name="snow-speed" label="Snowfall speed" min={0} max={70} value={values['snow-speed']} onChange={updateValue} />
                      <SwitchField label="Snow on the chat box" checked={values.accumulation} onChange={v => updateValue('accumulation',v)} />
                    </fieldset>
                    <fieldset><legend>Decorations</legend>
                      <RangeField name="light-brightness" label="Light glow" value={values['light-brightness']} onChange={updateValue} />
                      <SwitchField label="Show snowmen" checked={values.snowmen} onChange={v => updateValue('snowmen',v)} />
                    </fieldset>
                  </>}
                  {theme.motionLabel && (
                    <SwitchField label={theme.motionLabel} checked={Boolean(values.still)} onChange={checked => updateValue('still', checked)} disabled={!configured} />
                  )}
                  {isPond && (
                    <fieldset>
                      <legend>Fish movement</legend>
                      <p className="settings-hint">Longer laps slow the fish down.</p>
                      {pondProviders.map(provider => {
                        const name = provider.toLowerCase() + '-time';
                        const label = <><ProviderDot provider={provider} /> {provider} lap time</>;
                        return <RangeField key={name} name={name} label={label} min={10} max={120} unit=" s" value={values[name]} onChange={updateValue} disabled={!configured || Boolean(values.still)} />;
                      })}
                      <SwitchField label="Keep fish still" checked={Boolean(values.still)} onChange={checked => updateValue('still', checked)} disabled={!configured} />
                    </fieldset>
                  )}
                  </div>}
                  <div className="studio-actions">
                    <button className="open-theme" type="reset" disabled={!canReset}><RotateCcw size={15} aria-hidden="true" /> Reset</button>
                    <DownloadAction disabled={invalid} />
                  </div>
                </fieldset>
              </form>
            )}
          </section>
        </div>
        <div>
          {hasAgents && <SubagentTest parent={parent} setParent={setParent} agents={agents} running={running} spawn={spawn} finish={finish} disabled={!configured} />}
          <InstallInstructions name={imported?.name || theme.name} />
        </div>
      </div>
      </div>
    </main>
  );
}
