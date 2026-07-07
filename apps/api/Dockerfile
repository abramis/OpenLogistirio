FROM node:22.22.3-alpine

WORKDIR /workspace

RUN apk add --no-cache mysql-client

COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "-w", "@open-logistirio/api"]
