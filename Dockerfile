FROM node:20-bookworm-slim AS web-build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=10000
ENV PYTHONUNBUFFERED=1
ENV FOOD_MODEL_PYTHON_BIN=python3

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 python3.10-distutils python3.10-venv curl libgomp1 \
    && curl -sS https://bootstrap.pypa.io/get-pip.py | python3.10 \
    && ln -sf python3.10 /usr/bin/python3 \
    && ln -sf python3.10 /usr/bin/python \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY food_dataset/requirements.txt ./food_dataset/requirements.txt
RUN python -m pip install --no-cache-dir -r ./food_dataset/requirements.txt

COPY server ./server
COPY food_dataset ./food_dataset
COPY public ./public
COPY --from=web-build /app/dist ./dist

EXPOSE 10000

CMD ["node", "server/index.js"]
