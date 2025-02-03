FROM node:latest-alpine

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy the rest of the application files
COPY . .

# Expose port 3000 inside the container
EXPOSE 3000

# Start the application
CMD ["node", "index.js"]

# Map port 3000 inside the container to port 80 on the host
docker run -p 80:3000 crypto-screener
