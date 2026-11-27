const defaults = {
  dark: { canvas: '#101010', text: '#fafafa', textMuted: '#aaaaaa', surfaceRaised: '#202020', border: '#383838' },
  light: { canvas: '#e5e5e5', text: '#222222', textMuted: '#5d5d5d', surfaceRaised: '#fcfcfc', border: '#d4d4d4' },
};

export function previewColors(config, mode) {
  const colors = {
    ...defaults[mode],
    ...(config && { canvas: config.canvas, accent: config.accent }),
    ...config?.colors,
    ...config?.variants?.[mode],
  };

  return {
    sidebar: colors.surfaceRaised,
    sidebarForeground: colors.text,
    sidebarMutedForeground: colors.textMuted,
    sidebarRowSelected: colors.border,
    toolbar: colors.chrome || colors.surfaceRaised,
    toolbarForeground: colors.text,
    toolbarBorder: colors.border,
    messageSurface: colors.surfaceRaised,
    messageForeground: colors.text,
    surfaceOverlay: colors.surfaceRaised,
    accentForeground: colors.text,
    ...colors,
  };
}
