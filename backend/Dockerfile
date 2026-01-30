FROM node:20-slim

WORKDIR /app

# Install OpenSSL, build tools, and required libraries for Prisma and native modules
RUN apt-get update && apt-get install -y openssl libssl3 ca-certificates python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install tsx globally for dev mode
RUN npm install -g tsx

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Rebuild native modules for Debian (bcrypt, etc.)
RUN npm rebuild bcrypt

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Expose port
EXPOSE 3001

# For development, use tsx watch. For production, build first
CMD ["npm", "run", "dev"]
