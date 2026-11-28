import { getServerSession } from 'next-auth';
import GitHub from 'next-auth/providers/github';

const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, NEXTAUTH_SECRET } = process.env;
export const githubSignInAvailable = Boolean(GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET && NEXTAUTH_SECRET);

export const authOptions = {
  secret: NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
  providers: [
    GitHub({
      clientId: GITHUB_CLIENT_ID,
      clientSecret: GITHUB_CLIENT_SECRET,
      checks: ['pkce', 'state'],
      authorization: { params: { scope: 'read:user' } },
      userinfo: {
        async request({ client, tokens }) {
          return client.userinfo(tokens.access_token);
        },
      },
      profile(profile) {
        return { id: String(profile.id) };
      },
    }),
  ],
  callbacks: {
    jwt({ token, account }) {
      if (account?.provider === 'github') token.githubId = account.providerAccountId;
      return token;
    },
    session({ session, token }) {
      return { expires: session.expires, githubId: token.githubId };
    },
  },
};

export async function githubLikeIdentity() {
  if (!githubSignInAvailable) return null;
  const session = await getServerSession(authOptions);
  return /^\d+$/.test(session?.githubId ?? '') ? 'github:' + session.githubId : null;
}
