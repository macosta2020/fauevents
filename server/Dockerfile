# Base image for Node.js applications
FROM node:20-slim as base

# Set working directory for the container
WORKDIR /usr/src/app

# Install necessary dependencies for MSSQL driver (ODBC)
# This is a critical step for Node.js connecting to Azure SQL on Linux.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    curl \
    gnupg2 \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Microsoft ODBC Driver 18 for SQL Server
RUN curl [https://packages.microsoft.com/keys/microsoft.asc](https://packages.microsoft.com/keys/microsoft.asc) | apt-key add - && \
    curl [https://packages.microsoft.com/config/debian/11/prod.list](https://packages.microsoft.com/config/debian/11/prod.list) > /etc/apt/sources.list.d/mssql-release.list && \
    apt-get update && \
    ACCEPT_EULA=Y apt-get install -y msodbcsql18 unixodbc-dev

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
