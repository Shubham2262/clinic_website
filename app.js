// app.js (updated — persists phone properly and hides past slots for today's date in IST)
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ---------- Config ----------
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/clinicdb';
const ADMIN_KEY = process.env.ADMIN_KEY || 'admin123';
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM_EMAIL = process.env.FROM_EMAIL || SMTP_USER || 'no-reply@clinic.local';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'shriramdahatonde@gmail.com';

// ---------- Mailer ----------
let mailer = null;
if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
  mailer = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
  mailer.verify().then(() => console.log('SMTP ready')).catch(err => {
    console.warn('SMTP verify failed:', err && err.message ? err.message : err);
    mailer = null;
  });
} else {
  console.warn('SMTP not configured. Emails will be logged but not actually sent.');
}

// ---------- MongoDB ----------
mongoose.set('strictQuery', true);
mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected:', MONGODB_URI))
  .catch(err => { console.error('MongoDB connection error:', err); process.exit(1); });

const { Schema } = mongoose;

// Models (same as before; include published flags)
const ServiceSchema = new Schema({
  title: String, description: String, icon: String, published: { type: Boolean, default: true }, createdAt: { type: Date, default: Date.now }
});
const Service = mongoose.model('Service', ServiceSchema);

const BlogSchema = new Schema({
  title: String, summary: String, content: String, image: String, published: { type: Boolean, default: false }, createdAt: { type: Date, default: Date.now }
});
const Blog = mongoose.model('Blog', BlogSchema);

const TestimonialSchema = new Schema({
  name: String, text: String, image: String, rating: { type: Number, default: 5 }, published: { type: Boolean, default: false }, createdAt: { type: Date, default: Date.now }
});
const Testimonial = mongoose.model('Testimonial', TestimonialSchema);

const BookingSchema = new Schema({
  name: { type: String, required: true },
  contact: { type: String, required: true }, // raw contact field (legacy)
  email: String,
  phone: String,
  service: String,
  dateISO: { type: String, required: true }, // 'YYYY-MM-DD'
  slot: { type: String, required: true }, // '09:00' etc
  notes: String,
  status: { type: String, default: 'pending' }, // pending, confirmed, cancelled
  createdAt: { type: Date, default: Date.now }
});
BookingSchema.index({ dateISO: 1, slot: 1 }, { unique: true });
const Booking = mongoose.model('Booking', BookingSchema);
Booking.init().catch(err => console.warn('Booking.index init:', err && err.message ? err.message : err));

// ---------- Helpers ----------

// generate time slots (unchanged)
function generateRangeSlots(startHHMM, endHHMM, stepMinutes) {
  const slots = [];
  const [sh, sm] = startHHMM.split(':').map(Number);
  const [eh, em] = endHHMM.split(':').map(Number);
  let cur = new Date(0, 0, 0, sh, sm, 0);
  const end = new Date(0, 0, 0, eh, em, 0);
  while (cur <= end) {
    const hh = String(cur.getHours()).padStart(2, '0');
    const mm = String(cur.getMinutes()).padStart(2, '0');
    slots.push(`${hh}:${mm}`);
    cur = new Date(cur.getTime() + stepMinutes * 60000);
  }
  return slots;
}
function generateSlots() {
  const morning = generateRangeSlots('09:00', '13:30', 30);
  const evening = generateRangeSlots('17:00', '21:00', 30);
  return [...morning, ...evening];
}

// compute current date/time in IST (Asia/Kolkata, UTC+5:30)
function getCurrentIST() {
  // Get current UTC time, then add 5.5 hours
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000); // ms since epoch UTC
  const istOffset = 5.5 * 60 * 60 * 1000; // +5:30 in ms
  const istTime = new Date(utc + istOffset);
  return istTime;
}
function getISTDateISO(dateObj) {
  // return YYYY-MM-DD in IST for given Date object
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// parse slot "HH:MM" into minutes since midnight
function slotToMinutes(slotStr) {
  const [hh, mm] = slotStr.split(':').map(Number);
  return hh * 60 + mm;
}

// ---------- Admin middleware ----------
function requireAdmin(req, res, next) {
  const key = req.get('x-admin-key') || req.query.adminKey || req.body.adminKey;
  if (!key || key !== ADMIN_KEY) return res.status(401).json({ error: 'Admin key required' });
  next();
}

// ---------- Static files ----------
app.use(express.static(path.join(__dirname)));

// ---------- Public endpoints (published only) ----------
app.get('/api/services', async (req, res) => {
  try { const items = await Service.find({ published: true }).sort({ createdAt: -1 }).lean(); res.json(items); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.get('/api/blogs', async (req, res) => {
  try { const items = await Blog.find({ published: true }).sort({ createdAt: -1 }).lean(); res.json(items); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.get('/api/testimonials', async (req, res) => {
  try { const items = await Testimonial.find({ published: true }).sort({ createdAt: -1 }).lean(); res.json(items); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// create content (admin)
app.post('/api/services', requireAdmin, async (req, res) => { try { const s = new Service(req.body); await s.save(); res.json(s); } catch (err) { res.status(500).json({ error: err.message }); }});
app.post('/api/blogs', requireAdmin, async (req, res) => { try { const b = new Blog(req.body); await b.save(); res.json(b); } catch (err) { res.status(500).json({ error: err.message }); }});
app.post('/api/testimonials', requireAdmin, async (req, res) => { try { const t = new Testimonial(req.body); await t.save(); res.json(t); } catch (err) { res.status(500).json({ error: err.message }); }});

// ---------- Slots endpoint (now hides past slots for today's date in IST) ----------
app.get('/api/slots', async (req, res) => {
  try {
    const dateISO = req.query.date;
    if (!dateISO) return res.status(400).json({ error: 'date query required (YYYY-MM-DD)' });

    const allSlots = generateSlots();
    const bookings = await Booking.find({ dateISO }).lean();
    const takenSet = new Set(bookings.map(b => b.slot));

    // compute whether dateISO is today's IST date; if so, compute current IST minutes
    const istNow = getCurrentIST();
    const istDateISO = getISTDateISO(istNow);
    const isTodayIST = (dateISO === istDateISO);
    const currentISTMinutes = isTodayIST ? (istNow.getHours() * 60 + istNow.getMinutes()) : null;

    // build result: { slot, taken, expired }
    const result = allSlots.map(slot => {
      const taken = takenSet.has(slot);
      let expired = false;
      if (isTodayIST) {
        // if slot time is less than or equal to current time, consider expired
        const slotMin = slotToMinutes(slot);
        if (slotMin <= currentISTMinutes) expired = true;
      }
      return { slot, taken: taken || false, expired: expired || false };
    });

    res.json(result);
  } catch (err) {
    console.error('GET /api/slots error:', err);
    res.status(500).json({ error: err.message || 'server error' });
  }
});

// ---------- Create booking: accept explicit phone/email to avoid "N/A" ----------
app.post('/api/book', async (req, res) => {
  try {
    // Accept both legacy 'contact' and preferred 'email'/'phone'
    const { name, contact, email: bodyEmail, phone: bodyPhone, dateISO, slot, service, notes } = req.body;

    if (!name || !(contact || bodyEmail || bodyPhone) || !dateISO || !slot) {
      return res.status(400).json({ error: 'name, contact/email/phone, dateISO and slot are required' });
    }

    // Prefer explicit email/phone fields when provided
    const email = bodyEmail || (contact && String(contact).includes('@') ? contact : null);
    const phone = bodyPhone || (contact && !String(contact).includes('@') ? contact : null);

    const booking = new Booking({
      name,
      contact: contact || (bodyEmail || bodyPhone) || '',
      email: email || undefined,
      phone: phone || undefined,
      service,
      dateISO,
      slot,
      notes
    });

    await booking.save();

    // Notify admin of new booking (include phone & email)
    const adminMsg = `New appointment request:
Name: ${name}
Contact(raw): ${contact || ''}
Email: ${email || 'N/A'}
Phone: ${phone || 'N/A'}
Service: ${service || 'N/A'}
Date: ${dateISO}
Slot: ${slot}
Notes: ${notes || ''}
CreatedAt: ${new Date().toISOString()}
`;

    if (mailer) {
      mailer.sendMail({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        subject: `New appointment: ${name} ${dateISO} ${slot}`,
        text: adminMsg
      }).then(info => console.log('Admin notification sent:', info.messageId || info.response))
        .catch(err => console.warn('Admin notification failed:', err && err.message ? err.message : err));
    } else {
      console.log('Mailer disabled — admin notification would be:\n', adminMsg);
    }

    res.json({ success: true, id: booking._id });
  } catch (err) {
    if (err && err.code === 11000) return res.status(409).json({ error: 'Slot already taken' });
    console.error('POST /api/book error:', err);
    res.status(500).json({ error: err.message || 'server error' });
  }
});

// ---------- Admin: bookings list and change status (confirmation sends email including patient details) ----------
app.get('/api/bookings', requireAdmin, async (req, res) => {
  try {
    const items = await Booking.find({}).sort({ dateISO: 1, slot: 1 }).lean();
    res.json(items);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/bookings/:id/status', requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body;
    if (!['pending', 'confirmed', 'cancelled'].includes(status)) return res.status(400).json({ error: 'invalid status' });

    const updated = await Booking.findByIdAndUpdate(id, { status }, { new: true }).lean();
    if (!updated) return res.status(404).json({ error: 'Booking not found' });

    if (status === 'confirmed') {
      // send confirmation email containing patient details and CC to admin email
      const patientEmail = updated.email || (updated.contact && String(updated.contact).includes('@') ? updated.contact : null);
      const toList = patientEmail ? patientEmail : ADMIN_EMAIL;
      const ccList = patientEmail ? ADMIN_EMAIL : undefined;

      const mailSubject = `Appointment Confirmed - ${updated.name} - ${updated.dateISO} ${updated.slot}`;
      const mailText = `Dear ${updated.name},

Your appointment at AAYUSH Surgical Clinic has been CONFIRMED.

Patient details:
Name: ${updated.name}
Contact (raw): ${updated.contact || 'N/A'}
Email: ${updated.email || 'N/A'}
Phone: ${updated.phone || 'N/A'}

Appointment details:
Service: ${updated.service || 'N/A'}
Date: ${updated.dateISO}
Time: ${updated.slot}

Notes: ${updated.notes || 'N/A'}

If you need to reschedule or cancel, please contact us at +91 99609 95809.

Regards,
AAYUSH Surgical Clinic
`;

      if (mailer) {
        try {
          const info = await mailer.sendMail({ from: FROM_EMAIL, to: toList, cc: ccList, subject: mailSubject, text: mailText });
          console.log('Confirmation email sent:', info.messageId || info.response);
          return res.json({ updated, emailSent: true, emailInfo: info });
        } catch (mailErr) {
          console.warn('Confirmation email failed:', mailErr && mailErr.message ? mailErr.message : mailErr);
          return res.json({ updated, emailSent: false, emailError: mailErr && mailErr.message ? mailErr.message : String(mailErr) });
        }
      } else {
        console.log('Mailer disabled — would send confirmation to:', toList, 'cc:', ccList, '\n', mailText);
        return res.json({ updated, emailSent: false, emailError: 'Mailer not configured' });
      }
    }

    res.json({ updated });
  } catch (err) {
    console.error('POST /api/bookings/:id/status error:', err);
    res.status(500).json({ error: err.message || 'server error' });
  }
});

// serve admin HTML at /admin
app.get(['/admin','/admin/'], (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// root fallback
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// start
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
// Delete testimonial
app.delete('/api/testimonials/:id', async (req, res) => {
  try {
    const result = await Testimonial.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete testimonial' });
  }
});