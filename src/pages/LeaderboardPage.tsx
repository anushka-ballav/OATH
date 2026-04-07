import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Crown,
  Gift,
  Link2,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Swords,
  Target,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { CardShell } from '../components/CardShell';
import { ProgressBar } from '../components/ProgressBar';
import { useApp } from '../context/AppContext';
import { classNames } from '../lib/utils';
import {
  acceptLeaderboardInvite,
  createLeaderboardInvite,
  fetchInvitePreview,
  fetchLeaderboardSnapshot,
} from '../services/leaderboard';
import { syncDailyLogToServer, syncProfileToServer } from '../services/serverSync';
import { LeaderboardEntry, LeaderboardInvite, LeaderboardInvitePreview } from '../types';

const getInviteCodeFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get('invite')?.trim() || '';
};

const clearInviteFromUrl = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete('invite');
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, '', next);
};

const formatLastSeen = (lastSeen?: string) => {
  if (!lastSeen) return 'Waiting for first sync';

  return `Last sync ${new Date(lastSeen).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })}`;
};

const getLeagueTone = (league?: string) => {
  switch (league) {
    case 'Mythic':
      return 'border-fuchsia-400/35 bg-fuchsia-500/15 text-fuchsia-100';
    case 'Diamond':
      return 'border-sky-300/35 bg-sky-400/15 text-sky-100';
    case 'Gold':
      return 'border-amber-300/35 bg-amber-400/15 text-amber-100';
    case 'Silver':
      return 'border-slate-300/35 bg-slate-400/15 text-slate-100';
    default:
      return 'border-orange-400/35 bg-orange-500/15 text-orange-100';
  }
};

type RankedEntry = LeaderboardEntry & {
  rank: number;
  displayName: string;
  leadFromAbove: number;
  isYou: boolean;
};

const rankEntries = (entries: LeaderboardEntry[], currentUserId?: string) =>
  entries
    .slice()
    .sort((first, second) => second.points - first.points)
    .map((entry, index, items) => ({
      ...entry,
      rank: index + 1,
      displayName: entry.userId === currentUserId ? `${entry.name} (You)` : entry.name,
      leadFromAbove: index === 0 ? 0 : Math.max(0, items[index - 1].points - entry.points),
      isYou: entry.userId === currentUserId,
    }));

const BadgeRow = ({ badges }: { badges?: string[] }) => {
  if (!badges?.length) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {badges.map((badge) => (
        <span
          key={badge}
          className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/75 dark:text-orange-100/90"
        >
          {badge}
        </span>
      ))}
    </div>
  );
};

const PodiumCard = ({ entry }: { entry: RankedEntry }) => (
  <div
    className={classNames(
      'glass rounded-[26px] border border-orange-400/20 p-4 text-center',
      entry.rank === 1 ? 'xl:-translate-y-3' : '',
    )}
  >
    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/90 via-amber-400/85 to-sky-500/80 text-lg font-bold text-white">
      #{entry.rank}
    </div>
    <p className="mt-4 font-display text-xl text-black sm:text-2xl">{entry.displayName}</p>
    <div className="mt-2 flex items-center justify-center gap-2">
      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getLeagueTone(entry.league)}`}>
        {entry.league}
      </span>
      <span className="rounded-full border border-orange-400/25 bg-orange-500/15 px-3 py-1 text-xs font-semibold text-orange-50">
        Lv {entry.level || 1}
      </span>
    </div>
    <p className="mt-4 text-3xl font-semibold text-black">{entry.points}</p>
    <p className="muted-text text-sm">Season XP</p>
    <BadgeRow badges={entry.badges} />
  </div>
);

const LeaderboardRow = ({
  entry,
  tone = 'global',
}: {
  entry: RankedEntry;
  tone?: 'global' | 'friend';
}) => (
  <div
    className={classNames(
      'soft-surface rounded-[24px] border border-orange-400/15 px-4 py-4',
      entry.isYou ? 'ring-1 ring-orange-400/35' : '',
    )}
  >
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/20 to-sky-500/15 text-sm font-semibold text-black">
            #{entry.rank}
          </span>
          <p className="truncate font-semibold text-black">{entry.displayName}</p>
          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getLeagueTone(entry.league)}`}>
            {entry.league}
          </span>
          {entry.isFriend ? (
            <span className="rounded-full border border-sky-300/25 bg-sky-400/15 px-2.5 py-1 text-xs font-semibold text-sky-100">
              Rival
            </span>
          ) : null}
        </div>

        <div className="mt-3 grid gap-2 text-sm text-black/80 dark:text-orange-100/80 sm:grid-cols-2 xl:grid-cols-4">
          <p>{entry.questsCompleted || 0}/{entry.questCount || 5} quests complete</p>
          <p>{entry.streakDays || 0} day streak</p>
          <p>{entry.weeklyWins || 0} strong days this week</p>
          <p>{entry.isOnline ? 'Online now' : formatLastSeen(entry.lastSeen)}</p>
        </div>

        <div className="mt-3">
          <ProgressBar
            value={entry.questCount ? Math.round(((entry.questsCompleted || 0) / entry.questCount) * 100) : 0}
            colorClass="bg-gradient-to-r from-orange-500 via-amber-400 to-sky-500"
          />
        </div>

        <BadgeRow badges={entry.badges} />
      </div>

      <div className="w-full rounded-[22px] border border-orange-400/20 bg-white/60 px-4 py-3 text-left dark:bg-white/5 sm:w-auto sm:text-right">
        <p className="text-sm uppercase tracking-[0.18em] text-black/65 dark:text-orange-100/75">
          {tone === 'friend' ? 'Rival Score' : 'Season XP'}
        </p>
        <p className="mt-1 text-3xl font-semibold text-black">{entry.points}</p>
        <div className="mt-2 space-y-1 text-xs text-black/70 dark:text-orange-100/75">
          <p>Level {entry.level || 1}</p>
          <p>{entry.xpToNextLevel || 0} XP to next level</p>
          {entry.leadFromAbove > 0 ? <p>{entry.leadFromAbove} XP behind the player above</p> : <p>Holding first place</p>}
          {(entry.trendPoints || 0) !== 0 ? (
            <p className={entry.trendPoints! > 0 ? 'text-emerald-300' : 'text-rose-300'}>
              {entry.trendPoints! > 0 ? '+' : ''}
              {entry.trendPoints} from your previous session
            </p>
          ) : null}
        </div>
      </div>
    </div>
  </div>
);

const MetricCard = ({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
}) => (
  <CardShell>
    <div className="flex items-center gap-3">
      <div className="rounded-2xl bg-blue-100 p-3 text-black">{icon}</div>
      <div>
        <p className="text-sm uppercase tracking-[0.22em] text-black">{label}</p>
        <p className="text-xl font-semibold text-black sm:text-2xl">{value}</p>
        <p className="muted-text mt-1 text-xs">{hint}</p>
      </div>
    </div>
  </CardShell>
);

export const LeaderboardPage = () => {
  const { session, profile, currentLog, markEasterEggFound } = useApp();
  const [globalEntries, setGlobalEntries] = useState<LeaderboardEntry[]>([]);
  const [friendEntries, setFriendEntries] = useState<LeaderboardEntry[]>([]);
  const [activeInvite, setActiveInvite] = useState<LeaderboardInvite | null>(null);
  const [invitePreview, setInvitePreview] = useState<LeaderboardInvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [isAcceptingInvite, setIsAcceptingInvite] = useState(false);

  const inviteCode = useMemo(() => getInviteCodeFromUrl(), []);

  const loadSnapshot = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!session || !profile) return;

    if (!silent) {
      setLoading(true);
    }

    try {
      await syncProfileToServer(session, profile);
      await syncDailyLogToServer(session, profile, currentLog);

      const snapshot = await fetchLeaderboardSnapshot(session.userId);
      setGlobalEntries(snapshot.globalEntries);
      setFriendEntries(snapshot.friendEntries);
      setActiveInvite(snapshot.activeInvite);
      setError('');

      if (!snapshot.activeInvite && !inviteCode) {
        const invite = await createLeaderboardInvite({
          session,
          name: profile.name,
        });

        setActiveInvite(invite);
        setInviteMessage('Invite link ready. Share it with a friend to start a rivalry.');
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the leaderboard right now.');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!session || !profile) return;
    void loadSnapshot();
  }, [session?.userId, profile?.userId]);

  useEffect(() => {
    if (!session || !profile) return;
    void loadSnapshot({ silent: true });
  }, [
    session?.userId,
    profile?.userId,
    currentLog.date,
    currentLog.studyMinutes,
    currentLog.waterIntakeMl,
    currentLog.caloriesBurned,
    currentLog.caloriesConsumed,
    currentLog.completedWorkoutTasks.length,
    currentLog.wakeUpTime,
  ]);

  useEffect(() => {
    if (!session || !profile) return;

    const interval = window.setInterval(() => {
      void syncDailyLogToServer(session, profile, currentLog);
      void loadSnapshot({ silent: true });
    }, 30_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [session?.userId, profile?.userId, currentLog]);

  useEffect(() => {
    if (!inviteCode || !session) {
      setInvitePreview(null);
      return;
    }

    let cancelled = false;

    const loadInvitePreview = async () => {
      try {
        const preview = await fetchInvitePreview(inviteCode, session.userId);
        if (!cancelled) {
          setInvitePreview(preview);
        }
      } catch (previewError) {
        if (!cancelled) {
          setInviteMessage(
            previewError instanceof Error ? previewError.message : 'Unable to read this invite link right now.',
          );
        }
      }
    };

    void loadInvitePreview();

    return () => {
      cancelled = true;
    };
  }, [inviteCode, session?.userId]);

  const rankedGlobal = useMemo(
    () => rankEntries(globalEntries, session?.userId),
    [globalEntries, session?.userId],
  );
  const rankedFriends = useMemo(
    () => rankEntries(friendEntries, session?.userId),
    [friendEntries, session?.userId],
  );
  const yourEntry = useMemo(
    () => rankedGlobal.find((entry) => entry.userId === session?.userId) ?? null,
    [rankedGlobal, session?.userId],
  );
  const podiumEntries = rankedGlobal.slice(0, 3);
  const friendsBehindYou = rankedFriends.filter((entry) => entry.userId !== session?.userId && (yourEntry?.points || 0) > entry.points).length;

  const handleCopyInvite = async () => {
    if (!activeInvite?.inviteUrl) return;

    try {
      await navigator.clipboard.writeText(activeInvite.inviteUrl);
      setCopyState('copied');
      setInviteMessage('Invite link copied. Send it to your friend.');
      window.setTimeout(() => setCopyState('idle'), 2200);
    } catch {
      setInviteMessage(`Copy this link manually: ${activeInvite.inviteUrl}`);
    }
  };

  const handleGenerateInvite = async (force = false) => {
    if (!session || !profile) return;

    setIsCreatingInvite(true);

    try {
      const invite = await createLeaderboardInvite({
        session,
        name: profile.name,
        force,
      });

      setActiveInvite(invite);
      setInviteMessage(force ? 'Fresh challenge link generated.' : 'Invite link is ready to share.');
      setCopyState('idle');
    } catch (inviteError) {
      setInviteMessage(
        inviteError instanceof Error ? inviteError.message : 'Unable to generate a friend invite right now.',
      );
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const handleAcceptInvite = async () => {
    if (!session || !profile || !invitePreview?.code) return;

    setIsAcceptingInvite(true);

    try {
      const result = await acceptLeaderboardInvite({
        inviteCode: invitePreview.code,
        session,
        name: profile.name,
      });

      setInvitePreview(result.invite);
      setInviteMessage(`You are now connected with ${invitePreview.inviterName}. Rivalry unlocked.`);
      clearInviteFromUrl();
      await loadSnapshot({ silent: true });
    } catch (acceptError) {
      setInviteMessage(
        acceptError instanceof Error ? acceptError.message : 'Unable to join this invite link right now.',
      );
    } finally {
      setIsAcceptingInvite(false);
    }
  };

  if (loading && !rankedGlobal.length) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="glass flex items-center gap-3 rounded-2xl border border-orange-400/20 px-5 py-4 text-black">
          <LoaderCircle className="animate-spin" size={18} />
          Loading the arena...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-32 sm:pb-28">
      <header className="glass hero-glow rounded-[32px] border border-orange-400/20 p-5 shadow-card">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm uppercase tracking-[0.24em] text-black">Gamified Leaderboard</p>
            <h1 className="mt-2 font-display text-2xl text-black sm:text-4xl">
              Turn your routine into a rivalry arena
            </h1>
            <p className="muted-text mt-3 text-sm sm:text-base">
              Your leaderboard is now powered by live server data, rolling season XP, streak bonuses, daily quest
              completion, and one-tap invite links for friends.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-[360px]">
            <div className="rounded-[24px] border border-white/40 bg-white/65 px-4 py-4 dark:bg-white/5">
              <p className="text-xs uppercase tracking-[0.18em] text-black/60 dark:text-orange-100/75">Your League</p>
              <p className="mt-2 text-2xl font-semibold text-black">{yourEntry?.league || 'Bronze'}</p>
              <p className="muted-text mt-1 text-sm">Level {yourEntry?.level || 1}</p>
            </div>
            <div className="rounded-[24px] border border-white/40 bg-white/65 px-4 py-4 dark:bg-white/5">
              <p className="text-xs uppercase tracking-[0.18em] text-black/60 dark:text-orange-100/75">Invite Link</p>
              <p className="mt-2 text-sm font-semibold text-black">
                {activeInvite ? activeInvite.code.toUpperCase() : 'Generating...'}
              </p>
              <p className="muted-text mt-1 text-sm">Single-use rivalry join link</p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<Zap size={18} />}
          label="Season XP"
          value={`${yourEntry?.points || 0}`}
          hint={`${yourEntry?.xpToNextLevel || 0} XP to your next level`}
        />
        <MetricCard
          icon={<Trophy size={18} />}
          label="Global Rank"
          value={yourEntry ? `#${yourEntry.rank}` : '--'}
          hint={`${rankedGlobal.length} players in the arena`}
        />
        <MetricCard
          icon={<Target size={18} />}
          label="Quest Pace"
          value={`${yourEntry?.questsCompleted || 0}/${yourEntry?.questCount || 5}`}
          hint="Daily habit quests completed"
        />
        <MetricCard
          icon={<Swords size={18} />}
          label="Rivals Beaten"
          value={`${friendsBehindYou}`}
          hint={`${rankedFriends.length} friends tracked on your board`}
        />
      </div>

      {invitePreview ? (
        <CardShell className="border border-sky-300/25 bg-gradient-to-r from-sky-500/10 via-white/70 to-orange-500/10 dark:from-sky-500/10 dark:via-white/5 dark:to-orange-500/10">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-black">Incoming Challenge</p>
              <h2 className="mt-2 font-display text-xl text-black sm:text-2xl">
                {invitePreview.inviterName} invited you into their rivalry board
              </h2>
              <p className="muted-text mt-2 text-sm">
                League {invitePreview.inviterLeague}, Level {invitePreview.inviterLevel}, {invitePreview.inviterPoints} season XP.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleAcceptInvite}
                disabled={!invitePreview.canJoin || isAcceptingInvite}
                className="btn-glow w-full rounded-2xl bg-gradient-to-r from-sky-500 to-blue-500 px-5 py-3 font-semibold text-white transition hover:brightness-105 disabled:opacity-60 sm:w-auto"
              >
                {isAcceptingInvite ? 'Joining...' : invitePreview.alreadyFriends ? 'Already Joined' : 'Join Rivalry'}
              </button>
              <button
                type="button"
                onClick={() => {
                  clearInviteFromUrl();
                  setInvitePreview(null);
                }}
                className="soft-surface w-full rounded-2xl px-5 py-3 font-semibold text-black sm:w-auto"
              >
                Dismiss
              </button>
            </div>
          </div>
        </CardShell>
      ) : null}

      {error ? (
        <div className="rounded-[24px] border border-rose-300/25 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {inviteMessage ? (
        <div className="rounded-[24px] border border-emerald-300/25 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-100">
          {inviteMessage}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.1fr,0.9fr]">
        <CardShell>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-black">Global Podium</p>
              <p className="muted-text mt-1 text-sm">Top players based on rolling season XP and streak bonuses.</p>
            </div>
            <span className="self-start rounded-full border border-orange-400/25 bg-orange-500/15 px-3 py-1 text-xs font-semibold text-orange-100 sm:self-auto">
              Live ranking
            </span>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            {podiumEntries.length ? (
              podiumEntries.map((entry) => <PodiumCard key={entry.userId || entry.id} entry={entry} />)
            ) : (
              <div className="soft-surface rounded-[24px] px-4 py-4 text-sm text-black">No players have synced yet.</div>
            )}
          </div>
        </CardShell>

        <CardShell>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-2xl bg-blue-100 p-3 text-black">
              <Gift size={18} />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-black">Reward Track</p>
              <h2 className="mt-1 font-display text-2xl text-black">
                {yourEntry?.league || 'Bronze'} League Progress
              </h2>
            </div>
          </div>

          <div className="mt-5 rounded-[24px] border border-orange-400/20 bg-white/60 p-4 dark:bg-white/5">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-black/60 dark:text-orange-100/70">Current Level</p>
                <p className="mt-2 text-3xl font-semibold text-black">Lv {yourEntry?.level || 1}</p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs uppercase tracking-[0.2em] text-black/60 dark:text-orange-100/70">Next Reward</p>
                <p className="mt-2 text-lg font-semibold text-black">
                  {yourEntry?.xpToNextLevel || LEADERBOARD_LEVEL_FALLBACK} XP left
                </p>
              </div>
            </div>

            <div className="mt-4">
              <ProgressBar
                value={yourEntry?.xpProgressPercent || 0}
                colorClass="bg-gradient-to-r from-orange-500 via-amber-400 to-sky-500"
              />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="soft-surface rounded-[20px] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-black/60 dark:text-orange-100/75">Strong Days</p>
                <p className="mt-2 text-xl font-semibold text-black">{yourEntry?.weeklyWins || 0}</p>
              </div>
              <div className="soft-surface rounded-[20px] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-black/60 dark:text-orange-100/75">Current Streak</p>
                <p className="mt-2 text-xl font-semibold text-black">{yourEntry?.streakDays || 0} days</p>
              </div>
            </div>

            <BadgeRow badges={yourEntry?.badges} />
          </div>
        </CardShell>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.95fr,1.05fr]">
        <CardShell>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-black">Invite A Friend</p>
              <p className="muted-text mt-1 text-sm">
                Share your rivalry link. Your friend can open it, log in, and join your leaderboard directly.
              </p>
            </div>
            <Link2 size={18} className="text-black" />
          </div>

          <div className="mt-5 rounded-[24px] border border-orange-400/20 bg-white/70 p-4 dark:bg-white/5">
            <p className="text-xs uppercase tracking-[0.18em] text-black/60 dark:text-orange-100/75">Share Link</p>
            <div className="mt-3 rounded-[18px] border border-orange-400/20 bg-black/5 px-4 py-4 text-sm text-black [overflow-wrap:anywhere] dark:bg-black/20 dark:text-orange-50">
              {activeInvite?.inviteUrl || 'Generating a challenge link...'}
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleCopyInvite}
                disabled={!activeInvite?.inviteUrl}
                className="btn-glow flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-400 px-5 py-3 font-semibold text-black transition hover:brightness-105 disabled:opacity-60"
              >
                {copyState === 'copied' ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                {copyState === 'copied' ? 'Copied' : 'Copy Invite Link'}
              </button>

              <button
                type="button"
                onClick={() => void handleGenerateInvite(true)}
                disabled={isCreatingInvite}
                className="soft-surface flex items-center justify-center gap-2 rounded-2xl px-5 py-3 font-semibold text-black"
              >
                {isCreatingInvite ? <LoaderCircle size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                Generate New Link
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="soft-surface rounded-[20px] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-black/60 dark:text-orange-100/75">Status</p>
                <p className="mt-2 text-lg font-semibold text-black">{activeInvite?.status || 'pending'}</p>
              </div>
              <div className="soft-surface rounded-[20px] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-black/60 dark:text-orange-100/75">Code</p>
                <p
                  className="mt-2 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-lg font-semibold text-black"
                  title={activeInvite?.code?.toUpperCase() || '--'}
                >
                  {activeInvite?.code.toUpperCase() || '--'}
                </p>
              </div>
              <div className="soft-surface rounded-[20px] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-black/60 dark:text-orange-100/75">Expires</p>
                <p className="mt-2 text-sm font-semibold text-black">
                  {activeInvite?.expiresAt
                    ? new Date(activeInvite.expiresAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })
                    : '--'}
                </p>
              </div>
            </div>
          </div>
        </CardShell>

        <CardShell>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-2xl bg-blue-100 p-3 text-black">
              <ShieldCheck size={18} />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-black">How It Works</p>
              <h2 className="mt-1 font-display text-2xl text-black">Fully live rivalry flow</h2>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {[
              {
                icon: <Link2 size={16} />,
                title: 'Share the generated link',
                body: 'The link is single-use and carries your invite code.',
              },
              {
                icon: <Users size={16} />,
                title: 'Friend opens it and logs in',
                body: 'The app reads the URL and prepares the join action automatically.',
              },
              {
                icon: <Swords size={16} />,
                title: 'Join creates a rivalry',
                body: 'Both accounts are linked on the server so the friend board stays synced.',
              },
              {
                icon: <Crown size={16} />,
                title: 'Scores update from real activity',
                body: 'XP uses live server logs, streaks, quests, and weekly momentum.',
              },
            ].map((item) => (
              <div key={item.title} className="soft-surface rounded-[22px] px-4 py-4">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/60 text-black dark:bg-white/10 dark:text-orange-50">
                    {item.icon}
                  </span>
                  <div>
                    <p className="font-semibold text-black">{item.title}</p>
                    <p className="muted-text mt-1 text-sm">{item.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardShell>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <CardShell>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-black">Friend Rivalries</p>
              <p className="muted-text mt-1 text-sm">Private board for people who joined through your invite flow.</p>
            </div>
            <span className="self-start rounded-full border border-sky-300/25 bg-sky-500/15 px-3 py-1 text-xs font-semibold text-sky-100 sm:self-auto">
              {rankedFriends.length} rivals
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {rankedFriends.length ? (
              rankedFriends.map((entry) => (
                <LeaderboardRow key={entry.userId || entry.id} entry={entry} tone="friend" />
              ))
            ) : (
              <div className="soft-surface rounded-[22px] px-4 py-4 text-sm text-black">
                No rivals yet. Copy the invite link above and send it to a friend.
              </div>
            )}
          </div>
        </CardShell>

        <CardShell>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <button
                type="button"
                onClick={() => markEasterEggFound('arena-title')}
                className="text-left"
                title="Global Arena"
              >
                <p className="text-sm uppercase tracking-[0.24em] text-black">Global Arena</p>
              </button>
              <p className="muted-text mt-1 text-sm">Everyone who has synced activity is ranked here automatically.</p>
            </div>
            <span className="self-start rounded-full border border-orange-400/25 bg-orange-500/15 px-3 py-1 text-xs font-semibold text-orange-100 sm:self-auto">
              {rankedGlobal.filter((entry) => entry.isOnline).length} online
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {rankedGlobal.length ? (
              rankedGlobal.slice(0, 3).map((entry) => (
                <LeaderboardRow key={entry.userId || entry.id} entry={entry} tone="global" />
              ))
            ) : (
              <div className="soft-surface rounded-[22px] px-4 py-4 text-sm text-black">
                Leaderboard entries will appear after users sync their profile and daily progress.
              </div>
            )}
          </div>
        </CardShell>
      </div>
    </div>
  );
};

const LEADERBOARD_LEVEL_FALLBACK = 120;
