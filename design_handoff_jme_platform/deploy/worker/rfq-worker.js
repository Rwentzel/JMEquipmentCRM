/**
 * JME RFQ Cloudflare Worker
 * Handles quote requests and support requests from the storefront and support hub,
 * validates per request type, generates a reference ID, sends via Resend.
 *
 * Secrets required:
 *   RFQ_TO: parts@jmequipment.net
 *   RFQ_FROM: noreply@jmequipment.net
 *   RESEND_KEY: your Resend API key
 *   ALLOW_ORIGIN: https://jmequipment.net,https://parts.jmequipment.net (CORS whitelist;
 *                 comma-separated, one entry per host — one Worker serves both
 *                 tracks. The first entry is the default for unknown origins.)
 *
 * Bindings required:
 *   RATE_LIMIT_KV (KV namespace)
 *
 * Request types (body.request_type). Unknown or missing types fall back to parts-rfq
 * so existing storefront/YITH payloads keep working unchanged.
 */

const REQUEST_TYPES = {
  'parts-rfq': {
    label: 'Parts quote request',
    prefix: 'RFQ',
    // Fields that must be present and non-empty
    required: ['name', 'email', 'part_number'],
    requireQuantity: true
  },
  'manual-request': {
    label: 'Manual / documentation request',
    prefix: 'REQ',
    required: ['email'],
    // At least one of these identifies the machine
    requireAnyOf: ['serial', 'machine_model']
  },
  'service-request': {
    label: 'Field service request',
    prefix: 'REQ',
    required: ['name', 'phone', 'notes']
  },
  'fitment-check': {
    label: 'Fitment confirmation request',
    prefix: 'REQ',
    required: ['email', 'part_number'],
    requireAnyOf: ['serial', 'machine_model']
  },
  'epc-lookup': {
    label: 'Parts diagram (EPC) lookup',
    prefix: 'REQ',
    required: ['email', 'serial']
  },
  'sales-inquiry': {
    label: 'Sales inquiry',
    prefix: 'REQ',
    required: ['name', 'email']
  }
};

const filled = (v) => typeof v === 'string' ? v.trim().length > 0 : v != null && v !== '';

const resolveType = (body) => {
  const key = typeof body.request_type === 'string' ? body.request_type.trim() : '';
  return REQUEST_TYPES[key] ? key : 'parts-rfq';
};

const validate = (body, typeKey) => {
  const spec = REQUEST_TYPES[typeKey];
  const errors = [];

  // Honeypot first — a filled honeypot is always a bot
  if (filled(body.honeypot)) errors.push('honeypot triggered');

  spec.required.forEach((field) => {
    if (!filled(body[field])) errors.push(field + ' required');
  });

  if (spec.required.indexOf('email') !== -1 || filled(body.email)) {
    if (filled(body.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      errors.push('valid email required');
    }
  }

  if (spec.requireAnyOf && !spec.requireAnyOf.some((f) => filled(body[f]))) {
    errors.push('one of ' + spec.requireAnyOf.join(' / ') + ' required');
  }

  if (spec.requireQuantity) {
    const q = Number(body.quantity);
    if (!Number.isFinite(q) || q < 1) errors.push('quantity must be >= 1');
  }

  // Every support request needs a way to reply
  if (!filled(body.email) && !filled(body.phone)) errors.push('email or phone required');

  return errors;
};

const generateReferenceID = (prefix) => {
  const now = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${now}-${rand}`;
};

const formatEmail = (refID, typeKey, data) => {
  const spec = REQUEST_TYPES[typeKey];
  const lines = [
    `Reference: ${refID}`,
    `Request type: ${spec.label} (${typeKey})`,
    `Submitted: ${new Date().toISOString()}`,
    '',
    'REQUESTOR',
    `Name: ${data.name || '(not provided)'}`,
    `Email: ${data.email || '(not provided)'}`,
    `Company: ${data.company || '(not provided)'}`,
    `Phone: ${data.phone || '(not provided)'}`,
    '',
    'REQUEST DETAILS'
  ];

  if (data.part_number) lines.push(`Part / SKU: ${data.part_number}`);
  if (data.quantity) lines.push(`Quantity: ${data.quantity}`);
  if (data.machine_model) lines.push(`Machine model: ${data.machine_model}`);
  if (data.serial) lines.push(`Serial number: ${data.serial}`);
  if (data.doc_type) lines.push(`Documentation requested: ${data.doc_type}`);
  if (data.service_type) lines.push(`Service type: ${data.service_type}`);
  if (data.topic) lines.push(`Topic: ${data.topic}`);
  if (Array.isArray(data.items) && data.items.length) {
    lines.push('Request list:');
    data.items.forEach((it) => {
      lines.push(`  - ${it.sku || '(no sku)'} · ${it.name || ''} · qty ${it.qty || 1}`);
    });
  }

  lines.push('', 'NOTES', data.notes || '(none)', '', `SOURCE PAGE: ${data.source_page || 'Direct'}`);
  lines.push('', '---', 'Automated submission from jmequipment.net.');
  lines.push(`Reply to: ${data.email || data.phone || 'no contact supplied'}`);
  lines.push('Reference this ID in all correspondence. No pricing is published online;');
  lines.push('fitment, lead time, and freight are confirmed by the parts desk before quoting.');

  return lines.join('\n');
};

// ALLOW_ORIGIN may list several hosts, comma-separated; the request's Origin
// is echoed back only when it is one of them, else the first entry is sent.
const allowOriginFor = (origin, configured) => {
  const list = String(configured || 'https://jmequipment.net').split(',').map((s) => s.trim()).filter(Boolean);
  return list.includes(origin) ? origin : list[0];
};

const cors = (origin, allowedOrigin) => ({
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': origin === allowedOrigin ? origin : allowedOrigin,
  'Vary': 'Origin'
});

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin');
    const allowedOrigin = allowOriginFor(origin, env.ALLOW_ORIGIN);
    const headers = cors(origin, allowedOrigin);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin === allowedOrigin ? origin : allowedOrigin,
          'Vary': 'Origin',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
    }

    const typeKey = resolveType(body);
    const spec = REQUEST_TYPES[typeKey];

    const errors = validate(body, typeKey);
    if (errors.length > 0) {
      return new Response(JSON.stringify({
        error: 'Validation failed',
        request_type: typeKey,
        details: errors
      }), { status: 422, headers });
    }

    // Rate limit: simple per-IP check (production: use durable objects or KV)
    const ip = request.headers.get('CF-Connecting-IP');
    const rateLimitKey = `rl:${ip}`;
    const count = await env.RATE_LIMIT_KV.get(rateLimitKey) || '0';
    if (parseInt(count) > 10) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }), { status: 429, headers });
    }
    await env.RATE_LIMIT_KV.put(rateLimitKey, String(parseInt(count) + 1), { expirationTtl: 3600 });

    const refID = generateReferenceID(spec.prefix);
    const emailBody = formatEmail(refID, typeKey, body);
    const subjectDetail = body.part_number || body.serial || body.machine_model || spec.label;

    try {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: env.RFQ_FROM,
          to: env.RFQ_TO,
          reply_to: body.email || undefined,
          subject: `${refID} · ${spec.label}: ${subjectDetail}`,
          text: emailBody,
          html: `<pre>${emailBody.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`
        })
      });

      if (!resendRes.ok) {
        const resendErr = await resendRes.text();
        console.error('Resend error:', resendErr);
        return new Response(JSON.stringify({ error: 'Email delivery failed' }), { status: 500, headers });
      }
    } catch (e) {
      console.error('Resend request failed:', e.message);
      return new Response(JSON.stringify({ error: 'Email service error' }), { status: 500, headers });
    }

    return new Response(JSON.stringify({
      status: 'success',
      request_type: typeKey,
      reference_id: refID,
      message: `Request received. Reference: ${refID}`,
      reply_to: body.email || body.phone || null
    }), { status: 200, headers });
  }
};
