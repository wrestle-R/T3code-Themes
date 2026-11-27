'use client';

import { useContext, useEffect, useRef, useState } from 'react';
import { ArrowUp, FolderGit2, GitBranch, PanelLeft, Paperclip, Square } from 'lucide-react';
import { createPortal } from 'react-dom';
import { previewColors } from '../lib/preview-colors';
import { minecraftMobs, themes } from '../themes';
import { AppearanceControl } from './ui';
import { PreviewStyles } from './preview-styles';

const colorTokens = {
  canvas: 'canvas',
  text: 'text',
  messageSurface: 'message',
  messageForeground: 'message-ink',
  toolbar: 'chrome',
  toolbarForeground: 'chrome-ink',
  sidebar: 'sidebar',
  sidebarForeground: 'sidebar-ink',
  sidebarMutedForeground: 'sidebar-muted',
  sidebarRowSelected: 'sidebar-active',
  sidebarBorder: 'sidebar-border',
  surfaceOverlay: 'overlay',
  toolbarBorder: 'chrome-border',
  border: 'border',
  textMuted: 'muted',
  surfaceRaised: 'composer',
  accent: 'accent',
  accentForeground: 'accent-ink',
};

const models = { OpenAI: '6.1 Sol High', Claude: 'Opus 5.5 High', Gemini: 'Gemini Pro', OpenCode: 'OpenCode' };
const icons = { Claude: 'text-[#d97757]', Gemini: 'text-[#5b87bf]' };
const emptyAgents = [];
const policy = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; form-action 'none'";
const frameSource = '<!doctype html><html lang="en" class="dark"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' + policy + '"><title>Theme preview</title></head><body id="preview-root"></body></html>';

function colorDeclarations(colors) {
  return Object.entries(colorTokens)
    .filter(([token]) => colors[token])
    .map(([token, property]) => `--${property}: ${colors[token]};`)
    .join(' ');
}

export function useTheme(source, initialConfig) {
  const [result, setResult] = useState({ config: initialConfig || null, error: false });

  useEffect(() => {
    if (initialConfig) return;
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(source, { signal: controller.signal });
        if (!response.ok) throw new Error(`Theme request returned ${response.status}`);
        const config = await response.json();
        setResult({ config, error: false });
      } catch {
        if (!controller.signal.aborted) setResult({ config: null, error: true });
      }
    }

    load();
    return () => controller.abort();
  }, [source, initialConfig]);

  return result;
}

function School({ agents }) {
  const running = agents.filter(agent => agent.running).length;
  const done = agents.length - running;
  const summary = [running && `${running} working`, done && `${done} done`].filter(Boolean).join(' · ');

  return (
    <div className="studio-group" data-subagent-group="">
      <button type="button" tabIndex={-1} aria-expanded="true" aria-description={summary} aria-label={`${agents.length} ${agents.length === 1 ? 'subagent' : 'subagents'}`}>
        <span aria-hidden="true">
          {agents.map((agent, slot) => (
            <span key={slot}><span className={icons[agent.provider]} data-provider-kind={agent.provider.toLowerCase()} /></span>
          ))}
        </span>
        <span><span>{summary}</span><span className={running ? 'text-info' : undefined} /></span>
      </button>
      <div data-slot="collapsible-panel" hidden>
        {agents.map((agent, slot) => (
          <div key={slot} data-v2-item-type="subagent" aria-description={agent.running ? 'Running' : 'Completed'}>
            <span aria-hidden="true">
              <span className={icons[agent.provider]} data-provider-kind={agent.provider.toLowerCase()} />
              <span className={agent.running ? 'bg-info' : 'bg-success'} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewConversation({ slug, parent, agents, conversation, activity, reasoning, mob, onMobChange, studio }) {
  const isMinecraft = slug === 'minecraft';
  const [provider, model = models[parent]] = parent.split('|');
  const pickerLabel = reasoning ? `${model.replace(/ (?:low|medium|high|max)$/i, '')}, ${reasoning}` : model;
  const working = activity === 'Coding' || activity === 'Reasoning';
  const status = { Idle: 'Settled', Coding: 'Working 37s', Reasoning: 'Thinking', Approval: 'Needs approval', Error: 'Tool failed', Background: 'Other thread working' };
  return (
    <div className={studio ? 'preview-shell' : undefined}>
      {studio && <aside className="preview-rail" data-slot="sidebar" aria-label="Sample sidebar">
        <div className="preview-app"><PanelLeft size={15} aria-hidden="true" /> <strong>Workspace</strong></div>
        <span data-sidebar-row={working ? 'shelf:working' : 'shelf:settled'}>{working ? 'Working' : 'Recent threads'}</span>
        <div data-thread-item="">
          <div className="preview-thread-card" data-sidebar-row="thread:preview" aria-current="page">
            <span>{conversation ? 'Refine the workspace' : 'New thread'}</span>
            {working && <span className="text-info-foreground"><svg width="8" height="8" aria-hidden="true"><circle cx="4" cy="4" r="3" fill="currentColor" /></svg> {status[activity]}</span>}
          </div>
        </div>
        <div className="sample-threads"><span>Review recent changes</span><span>Draft release notes</span><span>Explore the theme API</span></div>
      </aside>}
      <div className="preview-workspace" data-chat-canvas="" data-preview-scene={slug} data-preview-conversation={conversation || undefined}
        data-mc-activity={isMinecraft ? activity : undefined}>
        {studio && <div className="preview-topline" data-chat-header=""><FolderGit2 size={14} aria-hidden="true" />
          <span>Studio demo</span><span aria-hidden="true">/</span><strong>{conversation ? 'Refine the workspace' : 'New thread'}</strong>
        </div>}
        {studio && conversation && <aside className="preview-details" data-thread-details-card="" aria-label="Sample thread details">
          <strong>Thread details</strong><span><GitBranch size={13} aria-hidden="true" /> main</span><span>3 changed files</span>
        </aside>}
        <div className="demo" data-workspace-area="conversation">
          <div className="chat-canvas" data-assistant-citation-viewport="">
            {agents.length > 0 && <School agents={agents} />}
            {conversation && <div className="messages-timeline-scroll preview-messages" aria-label="Sample conversation" tabIndex={0}>
              <div data-timeline-row-kind="user"><p data-user-message-bubble="">Can we make the workspace easier to scan?</p></div>
              <div data-timeline-row-kind="assistant"><p>I tightened the thread list and gave the composer a little more room. The current branch is visible beside the message box.</p><ul><li>Grouped recent threads under the project.</li><li>Matched the sidebar and composer colors.</li></ul></div>
            </div>}
          </div>
        </div>
        <div className="preview-composer" data-workspace-area="composer">
          <div className="new-thread">
            {!conversation && <h1>{studio ? 'What should we build?' : 'New thread'}</h1>}
            <div className="composer" data-chat-composer-main-surface="">
              {isMinecraft ? <div data-chat-composer-body="">Ask anything…</div> : <span>Ask anything…</span>}
              <div className="composer-tools" aria-hidden={!onMobChange || undefined}>
                <Paperclip size={14} aria-hidden="true" />
                <span data-chat-provider-model-picker="" aria-label={`${provider} ${pickerLabel}`}>{pickerLabel}</span>
                {onMobChange && <select className="mob-select" aria-label="Mob buddy" value={mob} onChange={event => onMobChange(event.target.value)}>
                  <option value="auto">Match model</option>
                  {Object.entries(minecraftMobs).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>}
                <span className="submit" data-chat-composer-compact-send="" aria-hidden="true">
                  {isMinecraft && working ? <Square size={10} fill="currentColor" /> : <ArrowUp size={14} />}
                </span>
              </div>
            </div>
            <div className="checkout">
              {isMinecraft
                ? <span className="preview-branch"><GitBranch size={12} aria-hidden="true" /> workbench</span>
                : <><GitBranch size={12} aria-hidden="true" /> main</>}
              {isMinecraft && <><span data-mc-preview-status="" role={onMobChange ? 'status' : undefined}>{status[activity]}</span>
                {conversation && <span className="diff-counts" aria-label="84 additions, 16 deletions">
                  <span className="text-diff-addition-foreground">+84</span>
                  <span className="text-diff-deletion-foreground">−16</span>
                </span>}</>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ThemePreview({ slug, theme = themes[slug], config, error, appearance, onAppearanceChange, studio = false, parent = 'OpenAI', agents = emptyAgents, activity = 'Idle', reasoning, mob, onMobChange }) {
  const previewCss = useContext(PreviewStyles);
  const [frame, setFrame] = useState(null);
  const [conversation, setConversation] = useState(false);
  const preview = useRef(null);
  const iframe = useRef(null);
  const ready = Boolean(previewCss && config && frame);

  function attachLoadedFrame() {
    const next = iframe.current?.contentDocument;
    if (next?.body?.id === 'preview-root' && next.readyState === 'complete') setFrame(next);
  }

  // The frame can finish loading before React hydrates the page.
  useEffect(attachLoadedFrame, []);

  useEffect(() => {
    if (frame) frame.documentElement.classList.toggle('dark', appearance === 'dark');
  }, [frame, appearance]);

  useEffect(() => {
    if (!frame) return;

    let visible = !('IntersectionObserver' in window);
    const updatePlayback = () => frame.documentElement.toggleAttribute('data-paused', !visible || document.hidden);
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      updatePlayback();
    }) : null;

    observer?.observe(preview.current);
    updatePlayback();
    document.addEventListener('visibilitychange', updatePlayback);
    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', updatePlayback);
    };
  }, [frame]);

  return (
    <div className="preview" data-theme={slug} data-preview-appearance={appearance} aria-busy={!ready && !error} ref={preview}>
      <div className="preview-toolbar">
        {studio ? <label className="preview-state">Scene <select aria-label="Preview conversation state" value={conversation ? 'conversation' : 'new'} onChange={event => setConversation(event.target.value === 'conversation')} disabled={!ready}>
          <option value="new">New thread</option><option value="conversation">Conversation</option>
        </select></label> : <span className="window-title">Live preview</span>}
        <AppearanceControl label={theme.name + ' preview appearance'} appearance={appearance} onChange={onAppearanceChange} disabled={!ready} compact={!studio} />
      </div>
      <div className={studio ? 'preview-viewport studio-viewport' : 'preview-viewport'}>
        <iframe
          title={`Live ${theme.name} preview`}
          sandbox="allow-same-origin"
          tabIndex={studio ? 0 : -1}
          srcDoc={frameSource}
          ref={iframe}
          onLoad={attachLoadedFrame}
        />
        {!ready && (
          <p className="preview-status" role="status">{error ? 'Preview unavailable. You can still download the original theme.' : 'Loading preview…'}</p>
        )}
        <noscript><p className="preview-status">Enable JavaScript to use the live preview.</p></noscript>
      </div>
      {ready && createPortal(
        <>
          <style>{previewCss}</style>
          <style>{`
            :root:not(.dark) { ${colorDeclarations(previewColors(config, 'light'))} }
            :root.dark { ${colorDeclarations(previewColors(config, 'dark'))} }
            ${config.css}
          `}</style>
        </>,
        frame.head,
      )}
      {ready && createPortal(<PreviewConversation slug={slug} parent={parent} agents={agents} conversation={conversation}
        activity={activity} reasoning={reasoning} mob={mob} onMobChange={onMobChange} studio={studio} />, frame.body)}
    </div>
  );
}

export function GalleryPreview({ slug, theme }) {
  const { config, error } = useTheme(theme.download);
  const [appearance, setAppearance] = useState(theme.galleryAppearance || theme.appearance || 'dark');
  return <ThemePreview slug={slug} theme={theme} config={config} error={error} appearance={appearance} onAppearanceChange={setAppearance} parent={theme.previewProvider} />;
}
