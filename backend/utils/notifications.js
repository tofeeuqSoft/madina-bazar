/**
 * Email (Nodemailer) + SMS (generic HTTP / Twilio-style) notifications
 * Configure via .env — works without credentials (logs only in dev)
 */

const isEmailConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const isMimSmsConfigured = () =>
  Boolean(process.env.MIMSMS_USERNAME && process.env.MIMSMS_API_KEY);

const isSmsConfigured = () =>
  Boolean(
    isMimSmsConfigured() ||
      (process.env.SMS_API_URL && process.env.SMS_API_KEY) ||
      (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM)
  );

/**
 * Send email
 */
export const sendEmail = async ({ to, subject, html, text }) => {
  if (!to) return { success: false, message: 'No recipient' };

  if (!isEmailConfigured()) {
    console.log('[Email skipped — not configured]', { to, subject });
    return { success: true, skipped: true, message: 'Email not configured (logged only)' };
  }

  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text: text || subject,
      html: html || `<p>${text || subject}</p>`,
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('sendEmail error:', error.message);
    return { success: false, message: error.message };
  }
};

/**
 * Send SMS — supports:
 * 1) Generic HTTP API (SMS_API_URL with {{to}} {{message}} or POST JSON)
 * 2) Twilio
 */
export const sendSMS = async ({ to, message }) => {
  if (!to || !message) return { success: false, message: 'Phone and message required' };

  // Normalize BD numbers to 8801XXXXXXXXX style if needed
  let phone = String(to).replace(/\s+/g, '');
  if (phone.startsWith('01') && phone.length === 11) {
    phone = `88${phone}`;
  }

  if (!isSmsConfigured()) {
    console.log('[SMS skipped — not configured]', { to: phone, message });
    return { success: true, skipped: true, message: 'SMS not configured (logged only)' };
  }

  try {
    // 1) MimSMS (Bangladesh) — https://api.mimsms.com/api/SmsSending/SMS
    if (isMimSmsConfigured()) {
      const url = process.env.MIMSMS_API_URL || 'https://api.mimsms.com/api/SmsSending/SMS';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          UserName: process.env.MIMSMS_USERNAME,
          Apikey: process.env.MIMSMS_API_KEY,
          MobileNumber: phone, // 8801XXXXXXXXX
          CampaignId: `MB${Date.now()}`,
          SenderName: process.env.MIMSMS_SENDER_ID || 'MadinaBazar',
          TransactionType: 'T', // Transactional (OTP)
          Message: message,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.Message || data?.message || 'MimSMS failed');
      return { success: true, provider: 'mimsms', data };
    }

    // 2) Twilio
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const from = process.env.TWILIO_FROM;
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const body = new URLSearchParams({
        To: phone.startsWith('+') ? phone : `+${phone}`,
        From: from,
        Body: message,
      });

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization:
            'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Twilio SMS failed');
      return { success: true, sid: data.sid };
    }

    // Generic BD SMS API (e.g. BulkSMSBD, SSL Wireless style)
    const apiUrl = process.env.SMS_API_URL;
    const apiKey = process.env.SMS_API_KEY;
    const sender = process.env.SMS_SENDER_ID || 'MadinaBazar';

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Api-Key': apiKey,
      },
      body: JSON.stringify({
        api_key: apiKey,
        senderid: sender,
        number: phone,
        to: phone,
        message,
        text: message,
      }),
    });

    const data = await res.json().catch(() => ({}));
    return { success: res.ok, data };
  } catch (error) {
    console.error('sendSMS error:', error.message);
    return { success: false, message: error.message };
  }
};

/**
 * Order placed notification
 */
export const notifyOrderPlaced = async (order, customer) => {
  const orderNo = order.orderNumber;
  const total = order.totalAmount;
  const phone = order.shippingAddress?.phone || customer?.phone;
  const email = customer?.email;

  const smsMsg = `Madina Bazar: Order #${orderNo} placed successfully. Total ৳${total}. We will confirm soon.`;
  const emailHtml = `
    <h2>Order Confirmed</h2>
    <p>Thank you for ordering from <strong>Madina Bazar</strong>.</p>
    <p><strong>Order:</strong> #${orderNo}<br/>
    <strong>Total:</strong> ৳${total}<br/>
    <strong>Payment:</strong> ${order.paymentMethod} (${order.paymentStatus})</p>
    <p>We will update you when your order is on the way.</p>
  `;

  const results = {};
  if (phone) results.sms = await sendSMS({ to: phone, message: smsMsg });
  if (email) {
    results.email = await sendEmail({
      to: email,
      subject: `Order #${orderNo} placed — Madina Bazar`,
      html: emailHtml,
      text: smsMsg,
    });
  }
  return results;
};

/**
 * Order status change notification
 */
export const notifyOrderStatus = async (order, customer, newStatus) => {
  const orderNo = order.orderNumber;
  const phone = order.shippingAddress?.phone || customer?.phone;
  const email = customer?.email;

  const statusMessages = {
    Confirmed: `Your order #${orderNo} has been confirmed.`,
    Processing: `Your order #${orderNo} is being prepared.`,
    'Ready for Delivery': `Your order #${orderNo} is ready for delivery.`,
    'Out for Delivery': `Your order #${orderNo} is out for delivery.`,
    Delivered: `Your order #${orderNo} has been delivered. Thank you!`,
    Cancelled: `Your order #${orderNo} has been cancelled.`,
  };

  const msg =
    statusMessages[newStatus] ||
    `Order #${orderNo} status updated to: ${newStatus}`;
  const fullSms = `Madina Bazar: ${msg}`;

  const results = {};
  if (phone) results.sms = await sendSMS({ to: phone, message: fullSms });
  if (email) {
    results.email = await sendEmail({
      to: email,
      subject: `Order #${orderNo} — ${newStatus}`,
      html: `<p>${msg}</p><p>Payment: ${order.paymentMethod} / ${order.paymentStatus}</p>`,
      text: fullSms,
    });
  }
  return results;
};

/**
 * Delivery OTP — customer shares it with the rider as proof of delivery.
 * OTP itself only travels over SMS/notification channels, never admin APIs.
 */
export const notifyDeliveryOtp = async (order, customer, otp) => {
  const orderNo = order.orderNumber;
  const phone = order.shippingAddress?.phone || customer?.phone;
  const msg = `Madina Bazar: your delivery code for order #${orderNo} is ${otp}. Share it with the rider on delivery.`;
  const results = {};
  if (phone) results.sms = await sendSMS({ to: phone, message: msg });
  if (customer?.email) {
    results.email = await sendEmail({
      to: customer.email,
      subject: `Delivery code for order #${orderNo}`,
      text: msg,
    });
  }
  return results;
};

export const getNotificationStatus = () => ({
  email: isEmailConfigured(),
  sms: isSmsConfigured(),
  mimsms: isMimSmsConfigured(),
});

export { isEmailConfigured, isMimSmsConfigured, isSmsConfigured };
