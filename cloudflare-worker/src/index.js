const COOKIE_NAME = "decap_oauth_state";
const COOKIE_MAX_AGE = 600; // 10 min

function randomHex(bytes = 16) {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return [...array].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function getCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = cookieHeader.split(";").map((part) => part.trim());

  for (const cookie of cookies) {
    const [key, ...rest] = cookie.split("=");
    if (key === name) {
      return decodeURIComponent(rest.join("="));
    }
  }

  return null;
}

function buildCookie(name, value, maxAge = COOKIE_MAX_AGE) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${maxAge}`
  ].join("; ");
}

function clearCookie(name) {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function html(body, status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders
    }
  });
}

function text(message, status = 200, extraHeaders = {}) {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders
    }
  });
}

function getAllowedOrigin(env) {
  return env.ALLOWED_ORIGIN;
}

function renderCallbackPage({ status, payload, allowedOrigin, message }) {
  const safeOrigin = JSON.stringify(allowedOrigin);
  const safePayload = JSON.stringify(payload);
  const safeMessage = JSON.stringify(message);

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Authentification Decap</title>
</head>
<body style="font-family:Segoe UI,Arial,sans-serif;background:#0b1020;color:#eef4ff;display:grid;place-items:center;min-height:100vh;margin:0;">
  <div style="text-align:center;padding:24px;border:1px solid rgba(255,255,255,.1);border-radius:18px;background:rgba(255,255,255,.04);max-width:520px;">
    <h1 style="margin-top:0;font-size:1.2rem;">Authentification CMS</h1>
    <p style="margin:0;color:#b9c6dd;">${message}</p>
  </div>

  <script>
    (function () {
      const allowedOrigin = ${safeOrigin};
      const payload = ${safePayload};

      if (!window.opener) {
        document.body.insertAdjacentHTML(
          "beforeend",
          '<p style="text-align:center;color:#ff7c7c;margin-top:16px;">Fenêtre parente introuvable.</p>'
        );
        return;
      }

      const receiveMessage = (event) => {
        if (event.origin !== allowedOrigin) {
          return;
        }

        window.opener.postMessage(payload, allowedOrigin);
        window.removeEventListener("message", receiveMessage, false);
        window.close();
      };

      window.addEventListener("message", receiveMessage, false);
      window.opener.postMessage("authorizing:github", allowedOrigin);
    })();
  </script>
</body>
</html>
  `.trim();
}

async function exchangeCodeForToken({ code, redirectUri, env }) {
  const body = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    client_secret: env.GITHUB_CLIENT_SECRET,
    code,
    redirect_uri: redirectUri
  });

  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    throw new Error(`Échec GitHub OAuth (${response.status})`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error_description || data.error || "Erreur OAuth GitHub");
  }

  if (!data.access_token) {
    throw new Error("Token GitHub manquant");
  }

  return data.access_token;
}

async function handleAuth(request, env) {
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider");

  if (provider !== "github") {
    return text("Provider invalide", 400);
  }

  const state = randomHex(16);
  const redirectUri = `${url.origin}/callback?provider=github`;
  const scope = env.GITHUB_SCOPE || "public_repo,user";

  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", scope);
  authorizeUrl.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      "Location": authorizeUrl.toString(),
      "Set-Cookie": buildCookie(COOKIE_NAME, state)
    }
  });
}

async function handleCallback(request, env) {
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider");

  if (provider !== "github") {
    return text("Provider invalide", 400);
  }

  const allowedOrigin = getAllowedOrigin(env);
  if (!allowedOrigin) {
    return text("ALLOWED_ORIGIN manquant", 500);
  }

  const error = url.searchParams.get("error");
  if (error) {
    return html(
      renderCallbackPage({
        status: "error",
        payload: `authorization:github:error:${JSON.stringify({ error })}`,
        allowedOrigin,
        message: "Connexion refusée ou annulée."
      }),
      200,
      {
        "Set-Cookie": clearCookie(COOKIE_NAME)
      }
    );
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = getCookie(request, COOKIE_NAME);

  if (!code) {
    return text("Code GitHub manquant", 400, {
      "Set-Cookie": clearCookie(COOKIE_NAME)
    });
  }

  if (!state || !cookieState || state !== cookieState) {
    return text("État OAuth invalide", 400, {
      "Set-Cookie": clearCookie(COOKIE_NAME)
    });
  }

  try {
    const redirectUri = `${url.origin}/callback?provider=github`;
    const token = await exchangeCodeForToken({ code, redirectUri, env });

    return html(
      renderCallbackPage({
        status: "success",
        payload: `authorization:github:success:${JSON.stringify({ token })}`,
        allowedOrigin,
        message: "Connexion réussie. Tu peux fermer cette fenêtre."
      }),
      200,
      {
        "Set-Cookie": clearCookie(COOKIE_NAME)
      }
    );
  } catch (err) {
    return html(
      renderCallbackPage({
        status: "error",
        payload: `authorization:github:error:${JSON.stringify({ error: err.message })}`,
        allowedOrigin,
        message: `Erreur : ${err.message}`
      }),
      200,
      {
        "Set-Cookie": clearCookie(COOKIE_NAME)
      }
    );
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/auth") {
      return handleAuth(request, env);
    }

    if (url.pathname === "/callback") {
      return handleCallback(request, env);
    }

    return text("OAuth proxy Decap CMS opérationnel.");
  }
};