FROM tensorflow/tensorflow:2.13.0

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=10000
ENV PYTHONUNBUFFERED=1
ENV FOOD_MODEL_PYTHON_BIN=python3

# Install Node.js inside TensorFlow image
RUN apt-get update && apt-get install -y curl \
  && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
  && apt-get install -y nodejs \
  && rm -rf /var/lib/apt/lists/*

# Install Node deps
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Install Python deps
COPY food_dataset/requirements.txt ./food_dataset/requirements.txt
RUN pip install --no-cache-dir -r ./food_dataset/requirements.txt

# Copy app
COPY server ./server
COPY food_dataset ./food_dataset
COPY public ./public
COPY --from=web-build /app/dist ./dist

EXPOSE 10000

CMD ["node", "server/index.js"]
