FROM node:24-slim

WORKDIR /app

COPY worker/package.json ./package.json
COPY worker/tsconfig.json ./tsconfig.json
COPY worker/src ./src

ENV NODE_ENV=production

CMD ["npm", "run", "start"]
