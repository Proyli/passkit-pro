// backend/services/renderEmail.js
function safe(str, fallback = "") {
  return (str ?? "").toString().trim() || fallback;
}

exports.renderEmail = function renderEmail(htmlTemplate, ctx) {
  return (htmlTemplate || "")
    .replace(/\[displayName\]/g, safe(ctx.displayName, "Cliente"))
    .replace(/{{BUTTON_TEXT}}/g, safe(ctx.buttonText, "Guardar en el móvil"))
    .replace(/{{GOOGLE_WALLET_URL}}/g, safe(ctx.googleUrl))
    .replace(/{{APPLE_WALLET_URL}}/g, safe(ctx.appleUrl));
};
