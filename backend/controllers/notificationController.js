import { getNotificationStatus, sendEmail, sendSMS } from '../utils/notifications.js';

export const notificationStatus = async (req, res) => {
  res.status(200).json({
    success: true,
    data: getNotificationStatus(),
  });
};

/** Admin test endpoint */
export const testNotification = async (req, res) => {
  try {
    const { type, to, message } = req.body;
    if (!to || !message) {
      return res.status(400).json({ success: false, message: 'to and message required' });
    }

    let result;
    if (type === 'sms') {
      result = await sendSMS({ to, message });
    } else {
      result = await sendEmail({
        to,
        subject: 'Madina Bazar Test',
        text: message,
        html: `<p>${message}</p>`,
      });
    }

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
