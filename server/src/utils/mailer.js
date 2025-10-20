"use strict";

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({ jsonTransport: true });

async function sendEmailVerification({ to, verifyUrl }) {
  const mailOptions = {
    from: "no-reply@easyappz.local",
    to,
    subject: "Verify your email",
    text: `Please confirm your email by clicking the link: ${verifyUrl}`,
    html: `<p>Please confirm your email by clicking the link:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
  };

  const info = await transporter.sendMail(mailOptions);
  // Log generated email for debugging/testing purposes
  try {
    console.log("Verification email prepared:", {
      to,
      verifyUrl,
      envelope: info && info.envelope,
      messageId: info && info.messageId,
    });
  } catch (e) {
    console.log("Verification email prepared for:", to, "url:", verifyUrl);
  }

  return true;
}

module.exports = {
  sendEmailVerification,
};
