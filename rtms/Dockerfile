FROM node:20-slim

WORKDIR /app

# Install OpenSSL for Prisma and CA certificates for RTMS TLS
# Install libstdc++6 from Debian Trixie for GLIBCXX_3.4.32 (required by @zoom/rtms v1.0 native binding)
RUN echo "deb http://deb.debian.org/debian trixie main" > /etc/apt/sources.list.d/trixie.list && \
    apt-get update && \
    apt-get install -y openssl ca-certificates && \
    apt-get install -y -t trixie libstdc++6 && \
    rm /etc/apt/sources.list.d/trixie.list && \
    rm -rf /var/lib/apt/lists/*

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
