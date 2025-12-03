# Base image for Node.js applications
# CRITICAL FIX: Changing base image to node:18-bullseye-slim to align with
# the ODBC driver repository versions (Debian 11 / Bullseye).
FROM node:18-bullseye-slim as base

# Set working directory for the container
WORKDIR /usr/src/app

# --- START FIX: Install Dependencies and ODBC Driver Safely ---

# FIX 1: Install required tools and ensure certificates are updated
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends \
    curl \
    gnupg \
    unixodbc-dev \
    # Ensure ca-certificates is installed for SSL trust
    ca-certificates \
    apt-transport-https \
    lsb-release \
    && rm -rf /var/lib/apt/lists/*

# FIX 2: Consolidate key and repository list installation
# We no longer need the -k flag or the -t bullseye flag as the base image is Bullseye.
RUN curl -sSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > /usr/share/keyrings/microsoft-prod.gpg && \
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/debian/11/prod bullseye main" > /etc/apt/sources.list.d/mssql-release.list

# Install ODBC Driver 18 for SQL Server
# Rerun update and install the package normally
RUN apt-get update && \
    ACCEPT_EULA=Y apt-get install -y msodbcsql18

# --- END FIX ---

# Copy package.json and install Node dependencies
COPY server/package*.json ./
RUN npm install
RUN npm install -g nodemon

# Copy the rest of the application source code
COPY server/ .

# Expose the port the Node.js app is listening on
EXPOSE 8080

# Command to run the application
CMD ["node", "server.js"]