import { ThemeStudio } from '../components/theme-studio';
import { themes } from '../themes';

export const metadata = {
  title: themes['minecraft-retro'].name,
  description: themes['minecraft-retro'].studioDescription,
};

export default function BlockworksPage() {
  return <ThemeStudio slug="minecraft-retro" />;
}
