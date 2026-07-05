FROM node:22.22.3-alpine

WORKDIR /workspace

COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm install

COPY . .

EXPOSE 4200

CMD ["npm", "run", "dev", "-w", "@open-logistirio/web"]
