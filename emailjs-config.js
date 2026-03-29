// ============================================================
//  BUBU DIET PLAN — EmailJS Configuration
//  For email reminders when Bubu hasn't logged her meals
//
//  Setup steps:
//  1. Create account at https://www.emailjs.com (free tier: 200/month)
//  2. Add a Gmail service → copy the Service ID
//  3. Create a template with these variables:
//     {{bubu_name}}, {{meal_name}}, {{meal_time}}, {{message}}
//  4. Copy Template ID and your Public Key (Account → API Keys)
// ============================================================

const EMAILJS_CONFIG = {
  publicKey:      "kZGrgu4YH5VCS50IZ",        // Account → API Keys
  serviceId:      "service_glbj3fm",        // e.g. "service_gmail"
  templateId:     "template_bmonv81",       // e.g. "template_bubu_reminder"
  recipientEmail: "priya.dizzy@gmail.com",     // Priyanka's email for reminders
  reminderDelayMins: 45,                    // Send reminder X mins after meal window opens
};
