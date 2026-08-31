FROM node:20-alpine AS local

WORKDIR /app

COPY package*.json ./
RUN HUSKY=0 npm ci --include=dev

COPY . .

RUN chmod +x docker/entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["sh", "docker/entrypoint.sh"]
