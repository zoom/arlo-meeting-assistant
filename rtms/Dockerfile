FROM node:20-slim

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy Prisma schema
COPY prisma ./prisma/

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY . .

# Expose port
EXPOSE 3002

# Start server
CMD ["npm", "start"]
