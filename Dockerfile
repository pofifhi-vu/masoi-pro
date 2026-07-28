FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all files
COPY . .

# Build the Vite frontend
RUN npm run build

# Expose port
EXPOSE 3001

# Start the server
CMD ["npm", "start"]
