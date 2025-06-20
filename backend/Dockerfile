# Përdor Node.js versionin 18 (i bazuar në Alpine Linux) si imazh bazë.
FROM node:18-alpine

# Vendos direktorinë e punës brenda kontejnerit. Kjo do të jetë /app.
WORKDIR /app

# Kopjo skedarët package.json dhe package-lock.json
# nga folderi 'backend' i kontekstit të ndërtimit (She4She/)
# në rrënjën e direktorisë së punës brenda kontejnerit (/app).
COPY backend/package*.json ./

# Instalo varësitë e npm.
RUN npm install --omit=dev

# Kopjo të gjithë skedarët e tjerë të aplikacionit
# nga folderi 'backend' i kontekstit të ndërtimit (She4She/)
# në rrënjën e direktorisë së punës brenda kontejnerit (/app).
COPY backend/. ./

# Kopjo folderin 'frontend'
# nga rrënja e kontekstit të ndërtimit (She4She/)
# në një folder të ri 'frontend' brenda direktorisë së punës (/app/frontend).
COPY frontend/. ./frontend

# Ekspozon portën që aplikacioni juaj Node.js dëgjon (porta 3000).
EXPOSE 3000

# Komanda që ekzekutohet kur kontejneri fillon.
CMD ["node", "server.js"]