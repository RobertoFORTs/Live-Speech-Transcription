import fetch from 'node-fetch';
export class AuthToken {
  constructor(appId, appSecret) {
    this.appId = appId;
    this.appSecret = appSecret;
  }
  async getAccessToken() {
    const fetchResponse = await fetch('https://api.symbl.ai/oauth2/token:generate', {
      method: 'post',
      headers: {
        'Content-Type': "application/json",
      },
      body: JSON.stringify({
        type: 'application',
        appId: this.appId,
        appSecret: this.appSecret
      })
    });
    const responseBody = await fetchResponse.json();
    const accessToken = responseBody['accessToken'];
    return accessToken;
  }
}
