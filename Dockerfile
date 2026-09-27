FROM node:22-alpine

WORKDIR /app

# node_modules vive num volume nomeado; o diretório precisa existir com o dono
# certo para que o volume herde as permissões na primeira criação.
RUN mkdir -p /app/node_modules && chown -R node:node /app
USER node

COPY --chown=node:node package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

EXPOSE 5173

# Reinstala na subida caso package.json tenha mudado desde a criação do volume.
CMD ["sh", "-c", "npm install --no-audit --no-fund && npm run dev"]
