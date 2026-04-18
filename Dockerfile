FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

ARG VITE_API_BASE_URL=http://localhost:8080
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine
WORKDIR /usr/share/nginx/html

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist ./

EXPOSE 8080
