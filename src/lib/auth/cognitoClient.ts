import {
  CognitoUserPool,
  CognitoUser,
  CognitoUserAttribute,
  AuthenticationDetails,
  CognitoUserSession,
  CognitoRefreshToken
} from 'amazon-cognito-identity-js';
import { getConfig } from '../runtimeConfig';

async function getUserPool(): Promise<CognitoUserPool> {
  const config = await getConfig();
  const userPoolId = config.cognitoUserPoolId;
  
  if (!userPoolId || userPoolId.includes('placeholder') || !userPoolId.includes('_')) {
    throw new Error('AWS Cognito is not configured. Please set a valid UserPoolId (e.g., us-east-1_abcdef123) in your configuration.');
  }

  return new CognitoUserPool({
    UserPoolId: userPoolId,
    ClientId: config.cognitoClientId,
  });
}

export async function signUp(
  username: string,
  password: string,
  email: string,
  additionalAttributes?: Record<string, string>
): Promise<any> {
  const userPool = await getUserPool();
  const attributeList: CognitoUserAttribute[] = [];

  attributeList.push(
    new CognitoUserAttribute({
      Name: 'email',
      Value: email,
    })
  );

  if (additionalAttributes) {
    Object.entries(additionalAttributes).forEach(([key, value]) => {
      attributeList.push(
        new CognitoUserAttribute({
          Name: key,
          Value: value,
        })
      );
    });
  }

  return new Promise((resolve, reject) => {
    userPool.signUp(username, password, attributeList, [], (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

export async function confirmSignUp(username: string, code: string): Promise<string> {
  const userPool = await getUserPool();
  const userData = {
    Username: username,
    Pool: userPool,
  };
  const cognitoUser = new CognitoUser(userData);

  return new Promise((resolve, reject) => {
    cognitoUser.confirmRegistration(code, true, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result || 'SUCCESS');
      }
    });
  });
}

export async function signIn(username: string, password: string): Promise<CognitoUserSession> {
  const userPool = await getUserPool();
  const userData = {
    Username: username,
    Pool: userPool,
  };
  const cognitoUser = new CognitoUser(userData);

  const authenticationDetails = new AuthenticationDetails({
    Username: username,
    Password: password,
  });

  return new Promise((resolve, reject) => {
    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: (session) => {
        resolve(session);
      },
      onFailure: (err) => {
        reject(err);
      },
      newPasswordRequired: () => {
        reject(new Error('NEW_PASSWORD_REQUIRED'));
      },
    });
  });
}

export async function signOut(): Promise<void> {
  const userPool = await getUserPool();
  const cognitoUser = userPool.getCurrentUser();
  if (cognitoUser) {
    cognitoUser.signOut();
  }
}

export async function getCurrentSession(): Promise<CognitoUserSession | null> {
  try {
    const userPool = await getUserPool();
    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) {
      return null;
    }

    return new Promise((resolve) => {
      cognitoUser.getSession((err: any, session: CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          resolve(null);
        } else {
          resolve(session);
        }
      });
    });
  } catch (err: any) {
    console.warn("Cognito is not configured or UserPoolId is invalid, proceeding as guest session:", err.message);
    return null;
  }
}

export async function refreshSession(
  refreshTokenString: string,
  username: string
): Promise<CognitoUserSession> {
  const userPool = await getUserPool();
  const userData = {
    Username: username,
    Pool: userPool,
  };
  const cognitoUser = new CognitoUser(userData);
  const refreshToken = new CognitoRefreshToken({ RefreshToken: refreshTokenString });

  return new Promise((resolve, reject) => {
    cognitoUser.refreshSession(refreshToken, (err, session) => {
      if (err) {
        reject(err);
      } else {
        resolve(session);
      }
    });
  });
}
