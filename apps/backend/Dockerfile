FROM node:20-alpine
WORKDIR /app/apps/backend

COPY apps/backend/package.json ./
RUN npm install

COPY apps/backend .
RUN npx prisma generate

EXPOSE 4000
CMD ["node", "src/server.js"]
