FROM node:20-slim

WORKDIR /app

# Install OpenSSL for Prisma and CA certificates for RTMS TLS
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Create logs directory for RTMS SDK
RUN mkdir -p /app/logs && chmod 777 /app/logs

# Set CA certificate path for RTMS SDK
ENV ZM_RTMS_CA=/etc/ssl/certs/ca-certificates.crt

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
