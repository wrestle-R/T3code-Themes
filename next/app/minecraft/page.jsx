import { ThemeStudio } from '../components/theme-studio';
import { themes } from '../themes';

export const metadata = {
  title: themes['minecraft'].name,
  description: themes['minecraft'].studioDescription,
};

export default function BlockworksPage() {
  return <ThemeStudio slug="minecraft" />;
}
