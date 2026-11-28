import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
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
    jwt({ token, account, profile }) {
      if (account?.provider === 'github') {
        token.githubId = account.providerAccountId;
        token.githubLogin = profile?.login;
        delete token.submissionToken;
        delete token.submissionExpires;
        if (account.access_token && /(?:^|[ ,])(public_repo|repo)(?:$|[ ,])/.test(account.scope || '')) {
          token.submissionToken = account.access_token;
          token.submissionExpires = Math.min(Date.now() + 15 * 60_000, (account.expires_at || Infinity) * 1000);
        }
      }
      if (!(token.submissionExpires > Date.now())) {
        delete token.submissionToken;
        delete token.submissionExpires;
      }
      return token;
    },
    session({ session, token }) {
      return {
        expires: session.expires, githubId: token.githubId, githubLogin: token.githubLogin,
        canSubmit: Boolean(token.submissionToken),
      };
    },
  },
};

export async function githubSession() {
  if (!githubSignInAvailable) return null;
  const session = await getServerSession(authOptions);
  return /^\d+$/.test(session?.githubId ?? '') ? session : null;
}

export async function githubLikeIdentity() {
  const session = await githubSession();
  return session ? 'github:' + session.githubId : null;
}

export async function githubSubmissionToken(request) {
  if (!githubSignInAvailable) return null;
  const token = await getToken({ req: request, secret: NEXTAUTH_SECRET });
  return token?.submissionExpires > Date.now() ? token.submissionToken : null;
}
