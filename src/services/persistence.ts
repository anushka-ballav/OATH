import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { AppState, DailyLog, LeaderboardEntry, UserProfile } from '../types';
import { db, isFirebaseConfigured } from './firebase';

export const syncProfile = async (profile: UserProfile) => {
  if (!isFirebaseConfigured || !db) return;
  await setDoc(doc(db, 'users', profile.userId), profile);
};

export const syncDailyLog = async (userId: string, log: DailyLog) => {
  if (!isFirebaseConfigured || !db) return;
  await setDoc(doc(db, 'dailyLogs', `${userId}-${log.date}`), { ...log, userId });
};

export const clearCloudData = async (userId: string) => {
  if (!isFirebaseConfigured || !db) return;

  await deleteDoc(doc(db, 'users', userId));
  await deleteDoc(doc(db, 'leaderboard', userId));

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
