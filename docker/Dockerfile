# Stage 1 - build environment
FROM node:22-alpine AS build

RUN apk add --no-cache python3 make g++ git

# Create app directory
WORKDIR /usr/src/app

# Swtich to node user
#RUN chown node:node ./
#USER node

COPY .npmrc ./
COPY package*.json ./

# Install app dependencies
RUN npm ci 

# Copy all required files
COPY . .

# Build the application
RUN npm run build:web

# Stage 2 - the production environment
FROM nginx:stable-alpine

# Copy artifacts and nignx.conf
COPY --from=build /usr/src/app/dist/browser /usr/share/nginx/html
COPY --from=build /usr/src/app/docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copy the config template directly. ng build should place it in dist/browser/assets if it's in src/assets
# However, to be sure it's available for the entrypoint, we copy it from the build stage's output.
# Assuming ng build copies src/assets to dist/browser/assets
COPY --from=build /usr/src/app/dist/browser/assets/config.template.json /usr/share/nginx/html/assets/config.template.json

# Copy entrypoint script and make it executable
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
# The CMD from nginx base image (nginx -g 'daemon off;') will be executed by the exec in entrypoint.sh
# Or, if entrypoint.sh doesn't use exec for the main process, CMD can be specified here.
# For clarity with exec in entrypoint.sh, this CMD is not strictly needed here if entrypoint ends with exec nginx...
# CMD ["nginx", "-g", "daemon off;"]