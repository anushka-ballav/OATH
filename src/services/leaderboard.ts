import {
  LeaderboardInvite,
  LeaderboardInvitePreview,
  LeaderboardSnapshot,
  UserSession,
} from '../types';

const readJson = async <T>(response: Response): Promise<T> => {
  const payload = (await response.json().catch(() => null)) as { message?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.message || 'Leaderboard request failed.');
  }

  return payload as T;
};

export const fetchLeaderboardSnapshot = async (userId: string, identifier?: string) => {
  const params = new URLSearchParams();
  if (userId) params.set('userId', userId);
  if (identifier) params.set('identifier', identifier.trim().toLowerCase());
  const response = await fetch(`/api/leaderboard?${params.toString()}`);
  return readJson<LeaderboardSnapshot>(response);
};

export const createLeaderboardInvite = async ({
  session,
  name,
  force = false,
}: {
  session: UserSession;
  name?: string;
  force?: boolean;
}) => {
  const response = await fetch('/api/leaderboard/invite', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: session.userId,
      identifier: session.identifier,
      name,
      force,
    }),
  });

  const payload = await readJson<{ invite: LeaderboardInvite }>(response);
  return payload.invite;
};

export const fetchInvitePreview = async (inviteCode: string, userId?: string, identifier?: string) => {
  const params = new URLSearchParams();
  if (userId) params.set('userId', userId);
  if (identifier) params.set('identifier', identifier.trim().toLowerCase());
  const query = params.toString();
  const response = await fetch(
    `/api/leaderboard/invite/${encodeURIComponent(inviteCode)}${query ? `?${query}` : ''}`,
  );
  const payload = await readJson<{ invite: LeaderboardInvitePreview }>(response);
  return payload.invite;
};

export const acceptLeaderboardInvite = async ({
  inviteCode,
  session,
  name,
}: {
  inviteCode: string;
  session: UserSession;
  name?: string;
}) => {
  const response = await fetch('/api/leaderboard/join', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inviteCode,
      userId: session.userId,
      identifier: session.identifier,
      name,
    }),
  });

  return readJson<{ invite: LeaderboardInvitePreview }>(response);
};
