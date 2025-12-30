# Use Node.js 20 Alpine for a smaller image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application files
COPY . .

# Create storage directory and initialize JSON files
RUN mkdir -p /app/storage && \
    echo '{}' > /app/storage/afkData.json && \
    echo '{}' > /app/storage/blacklist.json && \
    echo '{}' > /app/storage/chatMemory.json && \
    echo '{}' > /app/storage/commandUsage.json && \
    echo '{}' > /app/storage/convoSummaries.json && \
    echo '{}' > /app/storage/memory.json && \
    echo '{}' > /app/storage/msgData.json && \
    echo '{}' > /app/storage/userProfiles.json

# Set environment variables
ENV NODE_ENV=production

# Run the bot
CMD ["node", "index.js"]
