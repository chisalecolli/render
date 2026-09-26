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

# Download official J2ME MIDP 2.0 & CLDC 1.1 stubs from Maven Central
RUN wget -O midpapi20.jar https://repo1.maven.org/maven2/org/microemu/midpapi20/2.0.4/midpapi20-2.0.4.jar
RUN wget -O cldcapi11.jar https://repo1.maven.org/maven2/org/microemu/cldcapi11/2.0.4/cldcapi11-2.0.4.jar

COPY . .

ENV PORT=4000
EXPOSE 4000

CMD ["node", "server.js"]
