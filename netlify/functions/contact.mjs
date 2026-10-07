// Reçoit les formulaires du site et envoie un email via l'API Brevo.
// La clé API reste côté serveur : variables d'environnement Netlify
//   BREVO_API_KEY   clé API Brevo (Site configuration > Environment variables)
//   CONTACT_TO      adresse qui reçoit les messages
//   CONTACT_SENDER  expéditeur validé dans Brevo

const LABELS = {
  profil: "Profil",
  prenom: "Prénom",
  nom: "Nom",
  email: "Email",
  telephone: "Téléphone",
  how_know_cohalinkk: "Comment nous avez-vous connus ?",
  message: "Message",
  privacy_accepted: "Politique de confidentialité acceptée",
  type_demande: "Type de demande",
  identifiant_utilisateur: "Identifiant utilisateur",
  urgence: "Urgence",
  methode_reponse: "Méthode de réponse",
  rgpd_consent: "Consentement RGPD",
};

const IGNORED = new Set(["website", "how_know_other"]);

const escapeHtml = (value = "") =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || "");

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let data;
  try {
    data = Object.fromEntries(await req.formData());
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  // Anti-bot : champ caché qui doit rester vide. On répond OK sans rien envoyer.
  if (data.website) {
    return new Response("ok");
  }

  if (!isEmail(data.email) || !String(data.message || "").trim()) {
    return new Response("Champs requis manquants", { status: 400 });
  }

  const { BREVO_API_KEY, CONTACT_TO, CONTACT_SENDER } = process.env;
  if (!BREVO_API_KEY || !CONTACT_TO || !CONTACT_SENDER) {
    console.error("Variables d'environnement Brevo manquantes");
    return new Response("Server misconfigured", { status: 500 });
  }

  const rows = Object.entries(data)
    .filter(([key, value]) => !IGNORED.has(key) && String(value).trim() !== "")
    .map(
      ([key, value]) =>
        `<tr><td style="padding:4px 12px 4px 0;vertical-align:top"><b>${escapeHtml(
          LABELS[key] || key
        )}</b></td><td style="padding:4px 0;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`
    )
    .join("");

  const fullName = [data.prenom, data.nom].filter(Boolean).join(" ").trim();
  const subject = data.type_demande
    ? `[Confidentialité] ${data.type_demande} — ${fullName || data.email}`
    : `[Contact${data.profil ? ` ${data.profil}` : ""}] ${fullName || data.email}`;

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: "Site CohaLinkk", email: CONTACT_SENDER },
      to: [{ email: CONTACT_TO }],
      replyTo: { email: data.email, name: fullName || undefined },
      subject: subject.slice(0, 200),
      htmlContent: `<h2>Nouveau message depuis cohalinkk.fr</h2><table>${rows}</table>`,
    }),
  });

  if (!res.ok) {
    console.error("Erreur Brevo", res.status, await res.text());
    return new Response("Erreur d'envoi", { status: 502 });
  }

  return new Response("ok");
};

export const config = { path: "/api/contact" };
