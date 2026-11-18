import crypto from 'crypto';
import Shipment from '../../models/Shipment.js';
import RiderDeliveryAttempt from '../../models/RiderDeliveryAttempt.js';
import Settings from '../../models/Settings.js';

const OTP_TTL_MIN = 15;
const GPS_RADIUS_M = 2000;

const distanceM = (lng1, lat1, lat2, lng2) => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

// OTP issued when going OUT_FOR_DELIVERY (default proof: OTP + timestamp).
export const issueOtp = async (shipment) => {
  const otp = String(crypto.randomInt(100000, 999999));
  shipment.deliveryOtp = otp;
  shipment.deliveryOtpExpire = new Date(Date.now() + OTP_TTL_MIN * 60000);
  await shipment.save({ validateBeforeSave: false });
  return otp; // sent to CUSTOMER via SMS/notification channel (masked in admin)
};

export const verifyPod = async ({ shipment, otp, riderLng, riderLat, photo = '', signature = '' }) => {
  const settings = (await Settings.findOne()) || {};
  const otpRequired = settings.otpRequired !== false;
  const gpsRequired = settings.gpsRequired === true;

  let otpVerified = !otpRequired;
  if (otpRequired) {
    if (!otp || shipment.deliveryOtp !== String(otp) || !shipment.deliveryOtpExpire || shipment.deliveryOtpExpire < new Date()) {
      const e = new Error('Invalid or expired delivery OTP');
      e.statusCode = 400;
      e.code = 'POD_OTP_INVALID';
      throw e;
    }
    otpVerified = true;
  }

  let gpsVerified = false;
  let gpsDistanceM = null;
  const order = shipment.order;
  const addr = order?.shippingAddress || {};
  if (Number.isFinite(riderLng) && Number.isFinite(riderLat) && Number.isFinite(addr.latitude) && Number.isFinite(addr.longitude)) {
    gpsDistanceM = Math.round(distanceM(riderLng, riderLat, addr.latitude, addr.longitude));
    gpsVerified = gpsDistanceM <= (settings.gpsRadiusM || GPS_RADIUS_M);
    if (gpsRequired && !gpsVerified) {
      const e = new Error('Rider is too far from delivery location');
      e.statusCode = 400;
      e.code = 'POD_GPS_FAILED';
      throw e;
    }
  } else if (gpsRequired) {
    const e = new Error('GPS verification required but location unavailable');
    e.statusCode = 400;
    e.code = 'POD_GPS_MISSING';
    throw e;
  }

  shipment.deliveryOtp = '';
  shipment.deliveryOtpExpire = null;
  await shipment.save({ validateBeforeSave: false });

  return { otpVerified, gpsVerified, gpsDistanceM, photo, signature };
};

export const recordAttempt = ({ shipment, order, rider, outcome, failureReason = '', note = '', proof = {} }) =>
  RiderDeliveryAttempt.create({
    shipment: shipment._id,
    order: order._id || order,
    rider: rider._id || rider,
    outcome,
    failureReason,
    note,
    otpVerified: proof.otpVerified || false,
    gpsVerified: proof.gpsVerified || false,
    gpsDistanceM: proof.gpsDistanceM ?? null,
    photo: proof.photo || '',
    signature: proof.signature || '',
  });
