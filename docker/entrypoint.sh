#!/bin/sh
# entrypoint.sh

# Set a default backend URL if RUNTIME_BACKEND_URL is not set
# You can change 'https://api.production.example.com' to your actual default production URL
DEFAULT_PROD_URL="https://iptvnator-playlist-parser-api.vercel.app" # Using one of the previously seen prod URLs as default
BACKEND_URL_TO_USE=${RUNTIME_BACKEND_URL:-$DEFAULT_PROD_URL}

# Paths to the template and final config file within the container
CONFIG_TEMPLATE_FILE="/usr/share/nginx/html/assets/config.template.json"
CONFIG_FILE="/usr/share/nginx/html/assets/config.json"

# Replace the placeholder in the template and create the final config.json
# Using a temporary file to avoid issues with sed -i if config.json is a symlink or special file (though unlikely here)
if [ -f "$CONFIG_TEMPLATE_FILE" ]; then
  echo "Generating config.json from template with BACKEND_URL: $BACKEND_URL_TO_USE"
  sed "s#%%BACKEND_URL_PLACEHOLDER%%#${BACKEND_URL_TO_USE}#g" "$CONFIG_TEMPLATE_FILE" > "$CONFIG_FILE"
  echo "config.json generated successfully:"
  cat "$CONFIG_FILE"
else
  echo "WARNING: Config template file not found at $CONFIG_TEMPLATE_FILE. Creating a default config.json."
  echo "{\"BACKEND_URL\": \"${BACKEND_URL_TO_USE}\"}" > "$CONFIG_FILE"
  cat "$CONFIG_FILE"
fi

# Add a small delay to ensure config.json is written before Nginx might try to serve it (usually not an issue)
# sleep 1

echo "Starting Nginx..."
# Execute the original CMD (nginx)
exec nginx -g 'daemon off;'
