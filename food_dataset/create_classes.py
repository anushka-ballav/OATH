import os
import json

# Read folder names
folders = sorted(os.listdir("images"))

# Create mapping
class_indices = {name: i for i, name in enumerate(folders)}

# Save
with open("classes.json", "w") as f:
    json.dump(class_indices, f)

print("✅ classes.json created!")