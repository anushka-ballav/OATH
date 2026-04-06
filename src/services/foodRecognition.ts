import { FoodEntry } from '../types';
import { randomId } from '../lib/utils';

type NutritionPreset = {
  keywords: string[];
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sugarG: number;
  fiberG: number;
  sodiumMg: number;
};

const keywordFoods: NutritionPreset[] = [
  {
    keywords: ['pizza', 'margherita', 'pepperoni'],
    name: 'Pizza',
    calories: 285,
    proteinG: 12,
    carbsG: 36,
    fatG: 10,
    sugarG: 4,
    fiberG: 2,
    sodiumMg: 640,
  },
  {
    keywords: ['burger', 'cheeseburger'],
    name: 'Burger',
    calories: 520,
    proteinG: 28,
    carbsG: 40,
    fatG: 28,
    sugarG: 9,
    fiberG: 2,
    sodiumMg: 1100,
  },
  {
    keywords: ['sandwich', 'sub'],
    name: 'Sandwich',
    calories: 320,
    proteinG: 16,
    carbsG: 38,
    fatG: 11,
    sugarG: 5,
    fiberG: 3,
    sodiumMg: 720,
  },
  {
    keywords: ['salad'],
    name: 'Salad Bowl',
    calories: 260,
    proteinG: 8,
    carbsG: 18,
    fatG: 14,
    sugarG: 6,
    fiberG: 7,
    sodiumMg: 420,
  },
  {
    keywords: ['rice', 'biryani'],
    name: 'Rice Meal',
    calories: 430,
    proteinG: 12,
    carbsG: 66,
    fatG: 12,
    sugarG: 4,
    fiberG: 4,
    sodiumMg: 820,
  },
  {
    keywords: ['pasta', 'spaghetti'],
    name: 'Pasta',
    calories: 390,
    proteinG: 13,
    carbsG: 58,
    fatG: 10,
    sugarG: 6,
    fiberG: 3,
    sodiumMg: 680,
  },
];

const fallbackMocks = [
  { name: 'Detected Meal', calories: 300 },
  { name: 'Savory Meal', calories: 340 },
  { name: 'Home-Cooked Plate', calories: 380 },
];

const lowConfidenceLabels = new Set(['donut', 'doughnut', 'cookie', 'cupcake', 'muffin', 'dessert']);

export const estimateCaloriesFromName = (name: string) => {
  const normalized = name.trim().toLowerCase();
  const match = keywordFoods.find((item) => item.keywords.some((keyword) => normalized.includes(keyword)));
  return match?.calories ?? 300;
};

export const estimateNutritionFromName = (name: string, calories?: number) => {
  const resolvedCalories = typeof calories === 'number' && Number.isFinite(calories) && calories > 0 ? calories : estimateCaloriesFromName(name);
  return estimateNutritionFromLabel(name, resolvedCalories);
};

const clamp0 = (value: number) => Math.max(0, value);
const round1 = (value: number) => Math.round(value * 10) / 10;

const estimateNutritionFromLabel = (label: string, calories: number) => {
  const normalized = label.trim().toLowerCase();
  const preset = keywordFoods.find((item) => item.keywords.some((keyword) => normalized.includes(keyword)));

  if (preset) {
    const scale = calories > 0 ? calories / preset.calories : 1;

    return {
      proteinG: round1(clamp0(preset.proteinG * scale)),
      carbsG: round1(clamp0(preset.carbsG * scale)),
      fatG: round1(clamp0(preset.fatG * scale)),
      sugarG: round1(clamp0(preset.sugarG * scale)),
      fiberG: round1(clamp0(preset.fiberG * scale)),
      sodiumMg: Math.round(clamp0(preset.sodiumMg * scale)),
    };
  }

  // Generic estimate: protein 18%, fat 30%, carbs remainder.
  const proteinCalories = calories * 0.18;
  const fatCalories = calories * 0.3;
  const carbsCalories = Math.max(0, calories - proteinCalories - fatCalories);

  const proteinG = round1(clamp0(proteinCalories / 4));
  const fatG = round1(clamp0(fatCalories / 9));
  const carbsG = round1(clamp0(carbsCalories / 4));

  return {
    proteinG,
    carbsG,
    fatG,
    sugarG: round1(clamp0(carbsG * 0.12)),
    fiberG: round1(clamp0(Math.min(10, carbsG * 0.08))),
    sodiumMg: Math.round(clamp0(600 + calories * 1.2)),
  };
};

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Unable to read image file.'));
    reader.readAsDataURL(file);
  });

export const createFoodEntry = ({
  name,
  calories,
  imageName,
  source,
  proteinG,
  carbsG,
  fatG,
  sugarG,
  fiberG,
  sodiumMg,
}: {
  name: string;
  calories: number;
  imageName?: string;
  source: FoodEntry['source'];
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  sugarG?: number;
  fiberG?: number;
  sodiumMg?: number;
}): FoodEntry => ({
  id: randomId(),
  name,
  calories,
  proteinG,
  carbsG,
  fatG,
  sugarG,
  fiberG,
  sodiumMg,
  source,
  createdAt: new Date().toISOString(),
  imageName,
});

const buildMockFood = (file: File, attempt: number) => {
  const normalizedName = file.name.toLowerCase();
  const keywordMatch = keywordFoods.find((item) =>
    item.keywords.some((keyword) => normalizedName.includes(keyword)),
  );

  if (keywordMatch) {
    const nutrition = estimateNutritionFromLabel(keywordMatch.name, keywordMatch.calories);
    return createFoodEntry({
      name: keywordMatch.name,
      calories: keywordMatch.calories,
      ...nutrition,
      source: 'mock',
      imageName: file.name,
    });
  }

  const fallback = fallbackMocks[Math.min(attempt, fallbackMocks.length - 1)];
  const nutrition = estimateNutritionFromLabel(fallback.name, fallback.calories);

  return createFoodEntry({
    ...fallback,
    ...nutrition,
    source: 'mock',
    imageName: file.name,
  });
};

export const analyzeFoodImage = async (file: File, attempt = 0): Promise<FoodEntry> => {
  try {
    const imageDataUrl = await fileToDataUrl(file);
    const response = await fetch('/api/ai/scan-food', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageDataUrl,
        fileName: file.name,
        attempt,
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as {
        name: string;
        calories: number;
        proteinG?: number;
        carbsG?: number;
        fatG?: number;
        sugarG?: number;
        fiberG?: number;
        sodiumMg?: number;
        source: FoodEntry['source'];
      };

      const calories = Math.max(1, Math.round(data.calories || 250));
      const hasMacros =
        (data.proteinG ?? 0) + (data.carbsG ?? 0) + (data.fatG ?? 0) + (data.sugarG ?? 0) + (data.fiberG ?? 0) > 1;
      const nutrition = hasMacros ? {
        proteinG: data.proteinG,
        carbsG: data.carbsG,
        fatG: data.fatG,
        sugarG: data.sugarG,
        fiberG: data.fiberG,
        sodiumMg: data.sodiumMg,
      } : estimateNutritionFromLabel(data.name || file.name, calories);

      return createFoodEntry({
        name: data.name || 'Detected Meal',
        calories,
        ...nutrition,
        source: data.source || 'groq',
        imageName: file.name,
      });
    }

    const errorData = (await response.json()) as { message?: string; detail?: string; source?: string };
    if (errorData.source === 'groq-error') {
      throw new Error(`AI scan error: ${errorData.detail || errorData.message || 'Groq food scan failed.'}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('AI scan error:')) {
      throw error;
    }
    // Continue below for non-AI/server failures only.
  }

  const apiKey = import.meta.env.VITE_SPOONACULAR_API_KEY;

  if (apiKey) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`https://api.spoonacular.com/food/images/analyze?apiKey=${apiKey}`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = (await response.json()) as {
          category?: { name?: string };
          nutrition?: {
            calories?: { value?: number };
            fat?: { value?: number };
            protein?: { value?: number };
            carbs?: { value?: number };
            sugar?: { value?: number };
            fiber?: { value?: number };
            sodium?: { value?: number };
          };
        };

        const guessedName = data.category?.name?.trim() || 'Detected Meal';
        const safeName = lowConfidenceLabels.has(guessedName.toLowerCase()) ? 'Detected Meal' : guessedName;
        const calories = Math.max(1, Math.round(data.nutrition?.calories?.value ?? 250));
        const nutrition = {
          proteinG: data.nutrition?.protein?.value,
          carbsG: data.nutrition?.carbs?.value,
          fatG: data.nutrition?.fat?.value,
          sugarG: data.nutrition?.sugar?.value,
          fiberG: data.nutrition?.fiber?.value,
          sodiumMg: data.nutrition?.sodium?.value,
        };
        const hasMacros =
          (nutrition.proteinG ?? 0) + (nutrition.carbsG ?? 0) + (nutrition.fatG ?? 0) + (nutrition.sugarG ?? 0) > 1;
        const finalNutrition = hasMacros ? nutrition : estimateNutritionFromLabel(safeName, calories);

        return {
          ...createFoodEntry({
            name: safeName,
            calories,
            ...finalNutrition,
            source: 'spoonacular',
            imageName: file.name,
          }),
          imageName: file.name,
        };
      }
    } catch {
      // Network failures fall back to deterministic mocks.
    }
  }

  return buildMockFood(file, attempt);
};
