FROM node:8

# Add the neo4j repo to the packages list
RUN wget -O - https://debian.neo4j.org/neotechnology.gpg.key | apt-key add -
RUN echo 'deb http://debian.neo4j.org/repo stable/' | tee -a /etc/apt/sources.list.d/neo4j.list

# Grab the packages list & install neo4j cypher-shell
RUN apt-get update && apt-get install -y cypher-shell

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install
# If you are building your code for production
# RUN npm ci --only=production

# --- Everything before this stage is cached between builds if the dependencies don't change

# Bundle app source (exclude files by listing them in .dockerignore
COPY . .
RUN npm run build
EXPOSE 8082



CMD [ "sh", "./wrapper.sh" ]
