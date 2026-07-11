export interface RuntimeConfig {
  apiBaseUrl: string;
  cognitoUserPoolId: string;
  cognitoClientId: string;
  cognitoDomain: string;
  cloudfrontDomain: string;
  s3Bucket: string;
  razorpayKeyId: string;
  awsRegion: string;
}

let cachedConfig: RuntimeConfig | null = null;
let loadPromise: Promise<RuntimeConfig> | null = null;

export async function loadConfig(): Promise<RuntimeConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    try {
      const response = await fetch("/config.json");
      if (!response.ok) {
        throw new Error(`Failed to fetch /config.json: Status ${response.status} ${response.statusText}`);
      }
      const config = await response.json();

      // Validate required keys
      const requiredKeys: (keyof RuntimeConfig)[] = [
        "apiBaseUrl",
        "cognitoUserPoolId",
        "cognitoClientId",
        "cognitoDomain",
        "cloudfrontDomain",
        "s3Bucket",
        "razorpayKeyId",
        "awsRegion",
      ];

      for (const key of requiredKeys) {
        if (config[key] === undefined || config[key] === null || config[key] === "") {
          throw new Error(`Missing or empty required configuration key: ${key}`);
        }
      }

      cachedConfig = config as RuntimeConfig;
      return cachedConfig;
    } catch (error) {
      console.error("Failed to load runtime configuration:", error);
      loadPromise = null; // Reset to allow retries
      throw error;
    }
  })();

  return loadPromise;
}

export async function getConfig(): Promise<RuntimeConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }
  return loadConfig();
}
