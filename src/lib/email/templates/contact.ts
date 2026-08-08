export function renderContactEmail(input: { listingTitle: string; message: string }) {
  const title = input.listingTitle.trim().replaceAll(/\s+/g, " ").slice(0, 120);
  const message = input.message.trim();
  return {
    subject: `Handover enquiry: ${title}`,
    text: `Someone with a verified email is interested in your handover listing “${title}”.\n\n${message}\n\nReply to this email to contact the sender. Handover never asks you to pay through this message.`,
    html: `<h1>New handover enquiry</h1><p>Someone with a verified email is interested in <strong>${escapeHtml(title)}</strong>.</p><blockquote>${escapeHtml(message).replaceAll("\n", "<br>")}</blockquote><p>Reply to this email to contact the sender. Handover never asks you to pay through this message.</p>`,
  };
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
