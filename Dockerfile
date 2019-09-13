FROM node:8

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



CMD [ "npm", "start" ]
