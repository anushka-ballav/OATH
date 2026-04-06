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

export const fetchLeaderboardSnapshot = async (userId: string) => {
  const response = await fetch(`/api/leaderboard?userId=${encodeURIComponent(userId)}`);
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

export const fetchInvitePreview = async (inviteCode: string, userId?: string) => {
  const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  const response = await fetch(`/api/leaderboard/invite/${encodeURIComponent(inviteCode)}${query}`);
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
