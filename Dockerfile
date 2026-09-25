FROM node:20-bookworm-slim

# Install OpenJDK (gives javac & jar) and wget
RUN apt-get update && apt-get install -y --no-install-recommends \
    openjdk-17-jdk-headless \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

# Download standard J2ME MIDP 2.0 stubs for compiling mobile apps
RUN wget -O midpapi20.jar https://github.com/flyve-mdm/midp20-stubs/raw/master/midpapi20.jar || true

COPY . .

ENV PORT=4000
EXPOSE 4000

CMD ["node", "server.js"]
