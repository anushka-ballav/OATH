import { GenderType } from '../types';

export const genderOptions: GenderType[] = ['Female', 'Male', 'Other'];

const PROFILE_GENDER_KEY = 'oath-preferred-gender';

export const normalizeGender = (value: unknown): GenderType => {
  if (value === 'Female' || value === 'Male' || value === 'Other') {
    return value;
  }

  return 'Other';
};

export const readPreferredGender = (): GenderType => {
  try {
    return normalizeGender(window.localStorage.getItem(PROFILE_GENDER_KEY));
  } catch {
    return 'Other';
  }
};

export const savePreferredGender = (gender: GenderType) => {
  try {
    window.localStorage.setItem(PROFILE_GENDER_KEY, gender);
  } catch {
    // Ignore storage errors and keep the form usable.
  }
};
