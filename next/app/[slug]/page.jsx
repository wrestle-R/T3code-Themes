import { notFound } from 'next/navigation';
import { ThemeStudio } from '../components/theme-studio';
import { communityTheme, getCatalog } from '../lib/catalog';
import { themes } from '../themes';

export async function generateStaticParams() {
  return (await getCatalog()).filter(({ slug }) => !Object.hasOwn(themes, slug)).map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const result = await communityTheme((await params).slug);
  return result ? { title: result.entry.name, description: result.entry.description } : {};
}

export default async function CommunityThemePage({ params }) {
  const result = await communityTheme((await params).slug);
  if (!result) notFound();
  return <ThemeStudio slug={result.entry.slug} theme={result.entry} initialConfig={result.config} />;
}
