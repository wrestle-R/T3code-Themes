import NextAuth from 'next-auth';
import { authOptions, githubSignInAvailable } from '../../../lib/github-auth';

const handler = githubSignInAvailable
  ? NextAuth(authOptions)
  : () => new Response('GitHub sign-in is unavailable.', { status: 503 });

export { handler as GET, handler as POST };
