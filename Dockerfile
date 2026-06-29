FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV STATE_FILE=/app/data/state.json

COPY package.json ./
COPY server.js ./
COPY src ./src
COPY prompts ./prompts
COPY pwa ./pwa
COPY user ./user
COPY scripts ./scripts

RUN mkdir -p /app/data /app/cache/tts

EXPOSE 3000

CMD ["node", "server.js"]
