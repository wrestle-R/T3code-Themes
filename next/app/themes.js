export const pondProviders = ['Claude', 'OpenAI', 'Gemini', 'OpenCode'];
export const russelGithub = 'https://github.com/wrestle-R';

export const minecraftMobs = {
  openai: 'Iron golem',
  claude: 'Copper golem',
  gemini: 'Allay',
  opencode: 'Enderman',
  creeper: 'Creeper',
  fox: 'Fox',
};

export const themes = {
  'koi-pond': {
    name: 'Koi pond',
    description: 'Claude, OpenAI, Gemini, and OpenCode each have their own fish and swimming pattern.',
    studioDescription: 'Pick your water colors, set the pace, and see how the fish swim together.',
    download: '/downloads/koi-pond.json',
    previewProvider: 'Claude',
    defaults: {
      dark: '#101010',
      light: '#e5e5e5',
      'claude-time': 72,
      'openai-time': 27,
      'gemini-time': 43,
      'opencode-time': 54,
    },
  },
  minecraft: {
    name: 'Minecraft',
    description: 'Deepslate surfaces, spruce messages, and one pixel mob on the composer.',
    studioDescription: 'Pick a mob on the prompt bar. Switch preview activity to see how it reacts.',
    download: '/downloads/minecraft.json',
    previewProvider: 'OpenAI',
    motionLabel: 'Keep the buddy still',
    defaults: { mob: 'auto' },
    author: 'Hike-12',
    github: 'https://github.com/Hike-12',
  },
  'nightfall-christmas': {
    name: 'Nightfall',
    description: 'Window lights, continuous snowfall, and a provider-colored snowman for each subagent.',
    studioDescription: 'Switch between a cozy winter night and a frosted morning.',
    download: '/downloads/nightfall-christmas.json',
    motionLabel: 'Pause snow and lights',
    defaults: { dark: '#101010', light: '#dde6ee', 'snow-intensity': 45, 'snow-speed': 35, 'light-brightness': 100, accumulation: true, snowmen: true },
  },
  'minecraft-retro': {
    name: 'Minecraft Retro',
    description: 'Vanilla mobs roam the chat beside a sword-shaped Nether portal.',
    studioDescription: 'Watch golems, allays, and endermen cross your workspace.',
    download: '/downloads/blockworks.json',
    previewProvider: 'OpenAI',
    motionLabel: 'Keep characters still',
    defaults: {},
  },
  'dark-texture': {
    name: 'Dark texture',
    listed: false,
    description: 'A fine charcoal grain in dark mode and the same texture on a light gray background.',
    studioDescription: 'Choose a background for each appearance and set how much grain shows through.',
    download: '/downloads/dark-texture.json',
    defaults: { dark: '#101010', light: '#e5e5e5', 'grain-strength': 72 },
  },
};

const tags = {
  'koi-pond': ['Animated', 'Nature'],
  minecraft: ['Animated', 'Pixel art'],
  'minecraft-retro': ['Animated', 'Voxel'],
  'nightfall-christmas': ['Animated', 'Seasonal'],
  'dark-texture': ['Minimal', 'Texture'],
};

const galleryOrder = ['koi-pond', 'nightfall-christmas', 'minecraft', 'minecraft-retro', 'dark-texture'];

export const builtInThemes = galleryOrder.map((slug, index) => ({
  slug,
  ...themes[slug],
  author: themes[slug].author || 'Russel',
  github: themes[slug].github || russelGithub,
  tags: tags[slug],
  galleryAppearance: index % 2 === 0 ? 'dark' : 'light',
}));
