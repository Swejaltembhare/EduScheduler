// import dotenv from "dotenv";
// import nodemailer from "nodemailer";

// dotenv.config();

// const emailPass = process.env.EMAIL_PASSWORD
//   ? process.env.EMAIL_PASSWORD.replace(/\s/g, "")
//   : "";

// const transporter = nodemailer.createTransport({
//   service: "gmail",
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: emailPass,
//   },
// });

// transporter.verify((error, success) => {
//   if (error) {
//     console.error("Email transporter error:", error.message);
//   } else {
//     console.log("Email transporter ready");
//   }
// });

// export default transporter;



import dotenv from "dotenv";
dotenv.config();

// Drop-in replacement for the old nodemailer transporter.
// All existing files call `transporter.sendMail(mailOptions)` the same way
// they did with nodemailer — this just routes it through Brevo's HTTP API
// (port 443) instead of raw SMTP (which Render's free tier blocks).

const parseAddress = (input) => {
  // Handles both "user@x.com" and '"Name" <user@x.com>' formats
  if (!input) return undefined;
  const match = input.match(/"?([^"<]*)"?\s*<(.+)>/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { email: input.trim() };
};

const toRecipientArray = (input) => {
  if (!input) return [];
  const list = Array.isArray(input) ? input : input.split(",");
  return list.map((addr) => ({ email: addr.trim() }));
};

const transporter = {
  sendMail: async (mailOptions) => {
    const { from, to, bcc, cc, subject, html } = mailOptions;

    const payload = {
      sender: parseAddress(from) || { email: process.env.EMAIL_USER },
      to: toRecipientArray(to),
      subject,
      htmlContent: html,
    };

    if (bcc) payload.bcc = toRecipientArray(bcc);
    if (cc) payload.cc = toRecipientArray(cc);

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "api-key": process.env.BREVO_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      const err = new Error(data.message || "Brevo email send failed");
      err.brevoResponse = data;
      throw err;
    }

    // Match nodemailer's response shape so existing code using
    // `info.messageId` keeps working without changes.
    return { messageId: data.messageId };
  },
};

export default transporter;