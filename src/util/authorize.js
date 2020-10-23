import open from 'open';
import http from 'http';
import destroyer from 'server-destroy';

const PORT = 8080;

export async function getOAuthToken(authUrl, redirectParam) {
  return new Promise((resolve, reject) => {
    const base = `http://localhost:${PORT}`;
    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, base);
        const token = url.searchParams.get('token');
        // Most browsers are not allowed to close themselves, so just set a simple message.
        // TODO: redirect browser to success url?
        res.end('Authentication successful! Please return to the console.');
        server.destroy();
        resolve(token);
      } catch (err) {
        reject(err);
      }
    }).listen(PORT, async () => {
      const url = new URL(authUrl);
      url.searchParams.append(redirectParam, base);
      const process = await open(url.toString());
      process.unref();
    });
    destroyer(server);
  });
}
