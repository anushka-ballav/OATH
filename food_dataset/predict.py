import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras.preprocessing import image


def safe_number(value, default=0.0):
    try:
        if value is None:
            return float(default)
        as_text = str(value).strip()
        if not as_text:
            return float(default)
        return float(as_text)
    except Exception:
        return float(default)


def pretty_name(label):
    return str(label or "").replace("_", " ").strip().title() or "Detected Meal"


def load_class_mapping(path):
    with open(path, "r", encoding="utf-8") as source:
        class_indices = json.load(source)

    if not isinstance(class_indices, dict):
        raise ValueError("classes.json must be an object mapping class name to index.")

    reverse = {}
    for class_name, index in class_indices.items():
        reverse[int(index)] = str(class_name)
    return reverse


def load_nutrition_frame(path):
    df = pd.read_csv(path)
    df.columns = [str(column).strip().lower() for column in df.columns]
    if "food" not in df.columns:
        raise ValueError("nutrition.csv must include a 'food' column.")
    df["food"] = df["food"].astype(str).str.strip().str.lower()
    return df


def parse_args():
    root = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True)
    parser.add_argument("--model", default=str(root / "food_model.h5"))
    parser.add_argument("--classes", default=str(root / "classes.json"))
    parser.add_argument("--nutrition", default=str(root / "nutrition.csv"))
    return parser.parse_args()


def main():
    args = parse_args()

    model_path = Path(args.model).resolve()
    classes_path = Path(args.classes).resolve()
    nutrition_path = Path(args.nutrition).resolve()
    image_path = Path(args.image).resolve()

    if not image_path.exists():
        raise FileNotFoundError(f"Image file not found: {image_path}")
    if not model_path.exists():
        raise FileNotFoundError(f"Model file not found: {model_path}")
    if not classes_path.exists():
        raise FileNotFoundError(f"Classes file not found: {classes_path}")
    if not nutrition_path.exists():
        raise FileNotFoundError(f"Nutrition file not found: {nutrition_path}")

    class_names = load_class_mapping(classes_path)
    nutrition_df = load_nutrition_frame(nutrition_path)
    model = tf.keras.models.load_model(model_path)

    img = image.load_img(image_path, target_size=(224, 224))
    img_array = image.img_to_array(img) / 255.0
    img_array = np.expand_dims(img_array, axis=0)

    prediction = model.predict(img_array, verbose=0)
    predicted_index = int(np.argmax(prediction))
    confidence = float(np.max(prediction))

    raw_label = class_names.get(predicted_index, "detected_meal")
    normalized_label = str(raw_label).strip().lower()
    display_name = pretty_name(raw_label)

    nutrition = nutrition_df[nutrition_df["food"] == normalized_label]
    if nutrition.empty:
        nutrition = nutrition_df[nutrition_df["food"] == normalized_label.replace(" ", "_")]
    if nutrition.empty:
        nutrition = nutrition_df[nutrition_df["food"] == normalized_label.replace("_", " ")]

    nutrition_row = nutrition.iloc[0] if not nutrition.empty else {}

    payload = {
        "label": normalized_label,
        "name": display_name,
        "confidence": max(0.0, min(1.0, confidence)),
        "calories": round(max(1.0, safe_number(nutrition_row.get("calories"), 250))),
        "proteinG": round(max(0.0, safe_number(nutrition_row.get("protein"), 0.0)), 1),
        "carbsG": round(max(0.0, safe_number(nutrition_row.get("carbs"), 0.0)), 1),
        "fatG": round(max(0.0, safe_number(nutrition_row.get("fat"), 0.0)), 1),
        "sugarG": round(max(0.0, safe_number(nutrition_row.get("sugar"), 0.0)), 1),
        "fiberG": round(max(0.0, safe_number(nutrition_row.get("fibre"), 0.0)), 1),
        "sodiumMg": round(max(0.0, safe_number(nutrition_row.get("sodium"), 0.0))),
    }

    print(json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        sys.exit(1)
