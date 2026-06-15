// api/create-payment-intent.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

function isTruthy(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function toMetadataValue(value) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).slice(0, 500);
}

export default async function handler(req, res) {
  // Permitir CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Si es preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const {
      amount,
      email,
      name,
      phone,
      cleaningType,
      frequency,
      senderName,
      senderEmail,
      recipientName,
      recipientEmail,
      personalMessage,
      giftCardAmount,
      giftCardDiscount,
      giftCardFinalAmount,
      isGiftCard
    } = req.body;

    if (!amount || !email || !name || !phone) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    const giftCardPurchase = isTruthy(isGiftCard);

    if (giftCardPurchase) {
      const missingGiftCardFields = [];

      if (!senderName) missingGiftCardFields.push('senderName');
      if (!senderEmail) missingGiftCardFields.push('senderEmail');
      if (!recipientName) missingGiftCardFields.push('recipientName');
      if (!recipientEmail) missingGiftCardFields.push('recipientEmail');
      if (giftCardAmount === undefined || giftCardAmount === null || giftCardAmount === '') missingGiftCardFields.push('giftCardAmount');
      if (giftCardDiscount === undefined || giftCardDiscount === null || giftCardDiscount === '') missingGiftCardFields.push('giftCardDiscount');
      if (giftCardFinalAmount === undefined || giftCardFinalAmount === null || giftCardFinalAmount === '') missingGiftCardFields.push('giftCardFinalAmount');

      if (missingGiftCardFields.length > 0) {
        return res.status(400).json({
          error: `Faltan datos requeridos de la gift card: ${missingGiftCardFields.join(', ')}`
        });
      }
    }

    const metadata = {
      email: toMetadataValue(email),
      name: toMetadataValue(name),
      phone: toMetadataValue(phone),
      cleaningType: toMetadataValue(cleaningType || 'regular'),
      frequency: toMetadataValue(frequency || 'weekly')
    };

    if (giftCardPurchase) {
      Object.assign(metadata, {
        isGiftCard: 'true',
        senderName: toMetadataValue(senderName),
        senderEmail: toMetadataValue(senderEmail),
        recipientName: toMetadataValue(recipientName),
        recipientEmail: toMetadataValue(recipientEmail),
        personalMessage: toMetadataValue(personalMessage || ''),
        giftCardAmount: toMetadataValue(giftCardAmount),
        giftCardDiscount: toMetadataValue(giftCardDiscount),
        giftCardFinalAmount: toMetadataValue(giftCardFinalAmount)
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount),
      currency: 'usd',
      metadata,
      receipt_email: email,
      description: `Cleaning Service - ${cleaningType || 'regular'} (${frequency || 'weekly'})`
    });

    res.status(200).json({ 
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });

  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(400).json({ 
      error: error.message || 'Error al procesar el pago'
    });
  }
}
