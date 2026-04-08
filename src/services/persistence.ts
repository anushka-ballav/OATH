import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { AppState, DailyLog, LeaderboardEntry, UserProfile } from '../types';
import { db, isFirebaseConfigured } from './firebase';

const USER_SNAPSHOT_COLLECTION = 'userSnapshots';
type UserSnapshotPayload = Partial<
  Pick<
    AppState,
    | 'profile'
    | 'logs'
    | 'tasks'
    | 'bmiHistory'
    | 'streakHistory'
    | 'notifications'
    | 'easterEggsFound'
    | 'achievementsUnlocked'
    | 'darkMode'
  >
> & {
  updatedAt?: string;
};

export const syncProfile = async (profile: UserProfile) => {
  if (!isFirebaseConfigured || !db) return;
  await setDoc(doc(db, 'users', profile.userId), profile);
};

export const syncDailyLog = async (userId: string, log: DailyLog) => {
  if (!isFirebaseConfigured || !db) return;
  await setDoc(doc(db, 'dailyLogs', `${userId}-${log.date}`), { ...log, userId });
};

export const syncUserSnapshot = async (
  userId: string,
  snapshot: Partial<
    Pick<
      AppState,
      | 'profile'
      | 'logs'
      | 'tasks'
      | 'bmiHistory'
      | 'streakHistory'
      | 'notifications'
      | 'easterEggsFound'
      | 'achievementsUnlocked'
      | 'darkMode'
    >
  >,
) => {
  if (!isFirebaseConfigured || !db || !userId) return;

  await setDoc(
    doc(db, USER_SNAPSHOT_COLLECTION, userId),
    {
      ...snapshot,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
};

export const fetchUserSnapshot = async (
  userId: string,
): Promise<UserSnapshotPayload | null> => {
  if (!isFirebaseConfigured || !db || !userId) return null;

  const snapshot = await getDoc(doc(db, USER_SNAPSHOT_COLLECTION, userId));
  if (!snapshot.exists()) return null;

  const data = snapshot.data() as UserSnapshotPayload;
  return data;
};

export const subscribeToUserSnapshot = (
  userId: string,
  onUpdate: (snapshot: UserSnapshotPayload | null) => void,
): (() => void) | null => {
  if (!isFirebaseConfigured || !db || !userId) return null;

  return onSnapshot(doc(db, USER_SNAPSHOT_COLLECTION, userId), (snapshot) => {
    if (!snapshot.exists()) {
      onUpdate(null);
      return;
    }

    onUpdate(snapshot.data() as UserSnapshotPayload);
  });
};

export const subscribeToUserProfile = (
  userId: string,
  onUpdate: (profile: UserProfile | null) => void,
): (() => void) | null => {
  if (!isFirebaseConfigured || !db || !userId) return null;

  return onSnapshot(doc(db, 'users', userId), (snapshot) => {
    if (!snapshot.exists()) {
      onUpdate(null);
      return;
    }

    onUpdate(snapshot.data() as UserProfile);
  });
};

export const subscribeToDailyLogs = (
  userId: string,
  onUpdate: (logs: DailyLog[]) => void,
): (() => void) | null => {
  if (!isFirebaseConfigured || !db || !userId) return null;

  const logsQuery = query(collection(db, 'dailyLogs'), where('userId', '==', userId));
  return onSnapshot(logsQuery, (snapshot) => {
    const logs = snapshot.docs
      .map((entry) => {
        const data = entry.data() as DailyLog & { userId?: string };
        const { userId: _userId, ...log } = data;
        return log as DailyLog;
      })
      .filter((log) => typeof log.date === 'string' && log.date.length > 0)
      .sort((first, second) => first.date.localeCompare(second.date));

    onUpdate(logs);
  });
};

export const clearCloudData = async (userId: string) => {
  if (!isFirebaseConfigured || !db) return;

  await deleteDoc(doc(db, 'users', userId));
  await deleteDoc(doc(db, 'leaderboard', userId));
  await deleteDoc(doc(db, USER_SNAPSHOT_COLLECTION, userId));

  const logsQuery = query(collection(db, 'dailyLogs'), where('userId', '==', userId));
  const logsSnapshot = await getDocs(logsQuery);

  await Promise.all(logsSnapshot.docs.map((entry) => deleteDoc(entry.ref)));
};

export const hydrateRemoteState = async (state: AppState): Promise<AppState> => state;

export const syncLeaderboardPresence = async ({
  userId,
  name,
  identifier,
  points,
}: {
  userId: string;
  name: string;
  identifier: string;
  points: number;
}) => {
  if (!isFirebaseConfigured || !db) return;

  await setDoc(
    doc(db, 'leaderboard', userId),
    {
      userId,
      name,
      identifier,
      points,
      lastSeen: new Date().toISOString(),
    },
    { merge: true },
  );
};

export const subscribeToLeaderboard = (
  onEntries: (entries: LeaderboardEntry[]) => void,
): (() => void) | null => {
  if (!isFirebaseConfigured || !db) return null;

  return onSnapshot(collection(db, 'leaderboard'), (snapshot) => {
    const now = Date.now();
    const entries = snapshot.docs.map((entry) => {
      const data = entry.data() as LeaderboardEntry;
      const lastSeen = data.lastSeen;
      const isOnline = lastSeen ? now - new Date(lastSeen).getTime() < 90_000 : false;

      return {
        ...data,
        id: entry.id,
        isOnline,
      };
    });

    onEntries(entries);
  });
};
