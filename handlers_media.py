import os
import json
import boto3
from botocore.config import Config

def generate_presigned_url_handler(event, context):
    """
    AWS Lambda handler for skrimchat-api to generate a presigned S3 PUT URL.
    
    Expected event payload (body):
    {
        "path": "pulse-media/userId/postId/filename.jpg",
        "contentType": "image/jpeg"
    }
    
    Response payload:
    {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
        },
        "body": "{\"uploadUrl\": \"https://...\"}"
    }
    """
    try:
        # 1. Parse request body
        body_str = event.get('body', '') or '{}'
        body = json.loads(body_str)
        
        path = body.get('path')
        content_type = body.get('contentType')
        
        if not path or not content_type:
            return {
                "statusCode": 400,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                "body": json.dumps({"error": "Missing 'path' or 'contentType' parameters in request body."})
            }
            
        # 2. Retrieve bucket and region dynamically from environment
        bucket_name = os.environ.get('S3_BUCKET_NAME')
        region_name = os.environ.get('AWS_REGION')
        
        if not bucket_name:
            return {
                "statusCode": 500,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                "body": json.dumps({"error": "S3_BUCKET_NAME environment variable is not configured."})
            }
            
        # 3. Initialize S3 client using environment config
        s3_config = Config(
            signature_version='s3v4',
            region_name=region_name
        )
        s3_client = boto3.client('s3', config=s3_config)
        
        # 4. Generate presigned URL for PUT operation
        presigned_url = s3_client.generate_presigned_url(
            ClientMethod='put_object',
            Params={
                'Bucket': bucket_name,
                'Key': path,
                'ContentType': content_type
            },
            ExpiresIn=3600  # 1 hour expiry
        )
        
        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps({"uploadUrl": presigned_url})
        }
        
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps({"error": f"Internal Server Error generating presigned URL: {str(e)}"})
        }
