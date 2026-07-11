#!/bin/sh
set -e

# Target paths for config.json
TARGET_PATH_APP="/app/dist/config.json"
TARGET_PATH_RELATIVE="./dist/config.json"
TARGET_PATH_NGINX="/usr/share/nginx/html/config.json"

echo "=========================================="
echo "Starting container entrypoint script..."
echo "Generating dynamic runtime config.json..."
echo "=========================================="

# Read environment variables and output formatted JSON
generate_json() {
  cat <<EOF
{
  "apiBaseUrl": "${API_BASE_URL:-placeholder-api-base-url}",
  "cognitoUserPoolId": "${COGNITO_USER_POOL_ID:-placeholder-cognito-user-pool-id}",
  "cognitoClientId": "${COGNITO_CLIENT_ID:-placeholder-cognito-client-id}",
  "cognitoDomain": "${COGNITO_DOMAIN:-placeholder-cognito-domain}",
  "cloudfrontDomain": "${CLOUDFRONT_DOMAIN:-placeholder-cloudfront-domain}",
  "s3Bucket": "${S3_BUCKET:-placeholder-s3-bucket}",
  "razorpayKeyId": "${RAZORPAY_KEY_ID:-placeholder-razorpay-key-id}",
  "awsRegion": "${AWS_REGION:-placeholder-aws-region}"
}
EOF
}

# Generate JSON payload
JSON_CONTENT=$(generate_json)

# Write to the Express/Node static server build directory
if [ -d "/app/dist" ]; then
  echo "Target directory /app/dist detected. Writing config.json..."
  echo "$JSON_CONTENT" > "$TARGET_PATH_APP"
elif [ -d "./dist" ]; then
  echo "Target directory ./dist detected. Writing config.json..."
  echo "$JSON_CONTENT" > "$TARGET_PATH_RELATIVE"
else
  # Ensure directory exists if we are running in an unexpected build path
  mkdir -p ./dist
  echo "Creating ./dist directory and writing config.json..."
  echo "$JSON_CONTENT" > "$TARGET_PATH_RELATIVE"
fi

# Write to standard Nginx static HTML path if it exists/is used
if [ -d "/usr/share/nginx/html" ]; then
  echo "Nginx directory /usr/share/nginx/html detected. Writing config.json..."
  echo "$JSON_CONTENT" > "$TARGET_PATH_NGINX"
fi

echo "Configuration generated successfully:"
echo "$JSON_CONTENT"
echo "=========================================="

# Pass control to CMD
if [ $# -gt 0 ]; then
  echo "Executing command: $@"
  exec "$@"
else
  echo "Starting production server via 'npm start'..."
  exec npm start
fi
