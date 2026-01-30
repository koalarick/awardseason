FROM node:20-alpine

WORKDIR /app

# Build argument for API URL
ARG VITE_API_URL=http://localhost:3001
ENV VITE_API_URL=$VITE_API_URL

# Copy package files
COPY package*.json ./
# Install dependencies
# Use npm install instead of npm ci to handle lock file updates during development
RUN npm install

# Copy source code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Run dev server with hot reload
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
