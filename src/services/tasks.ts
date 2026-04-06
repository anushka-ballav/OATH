import { TaskItem } from '../types';

const safeJson = async <T,>(response: Response): Promise<T | null> => {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

export const fetchTasks = async (userId: string): Promise<TaskItem[]> => {
  const response = await fetch(`/api/tasks?userId=${encodeURIComponent(userId)}`);
  const payload = await safeJson<{ tasks?: TaskItem[] }>(response);

  if (!response.ok) {
    throw new Error(payload?.tasks ? 'Unable to load tasks.' : 'Unable to load tasks.');
  }

  return Array.isArray(payload?.tasks) ? payload!.tasks : [];
};

export const createTask = async ({
  userId,
  identifier,
  name,
  title,
  dueAt,
  dueDate,
}: {
  userId: string;
  identifier: string;
  name?: string;
  title: string;
  dueAt?: string | null;
  dueDate?: string;
}): Promise<TaskItem> => {
  const response = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      identifier,
      name,
      title,
      dueAt: dueAt || '',
      dueDate: dueDate || '',
    }),
  });

  const payload = await safeJson<{ task?: TaskItem; message?: string }>(response);

  if (!response.ok || !payload?.task) {
    throw new Error(payload?.message || 'Unable to create task.');
  }

  return payload.task;
};

export const updateTask = async ({
  userId,
  identifier,
  name,
  taskId,
  patch,
}: {
  userId: string;
  identifier: string;
  name?: string;
  taskId: string;
  patch: Partial<Pick<TaskItem, 'title' | 'completed' | 'dueAt' | 'dueDate'>>;
}): Promise<TaskItem> => {
  const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      identifier,
      name,
      patch,
    }),
  });

  const payload = await safeJson<{ task?: TaskItem; message?: string }>(response);

  if (!response.ok || !payload?.task) {
    throw new Error(payload?.message || 'Unable to update task.');
  }

  return payload.task;
};

export const deleteTask = async (userId: string, taskId: string): Promise<void> => {
  const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}?userId=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });

  const payload = await safeJson<{ message?: string }>(response);

  if (!response.ok) {
    throw new Error(payload?.message || 'Unable to delete task.');
  }
};

