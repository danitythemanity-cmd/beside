// Offline jargon dictionary. Live mode merges in terms found by Claude.
// Plain versions are written to read naturally when swapped into a sentence.
export const DICTIONARY = {
  // Exam and anatomy
  'right lower quadrant': 'lower right side of your belly',
  'left lower quadrant': 'lower left side of your belly',
  'epigastric': 'upper belly',
  'abdomen': 'belly',
  'abdominal': 'belly',
  'thoracic': 'chest',
  'cardiac': 'heart',
  'renal': 'kidney',
  'hepatic': 'liver',
  'gastrointestinal': 'stomach and gut',
  'gi': 'stomach and gut',
  'tenderness': 'soreness when pressed',
  'palpate': 'gently press on',
  'palpation': 'gentle pressing with hands',
  'auscultate': 'listen with a stethoscope to',
  'vitals': 'heart rate, breathing, and temperature',
  'vital signs': 'heart rate, breathing, and temperature',
  'bilateral': 'on both sides',
  'distal': 'farther from the body',
  'lesion': 'sore or unusual spot',
  'edema': 'swelling',
  'inflammation': 'swelling inside the body',
  'inflamed': 'swollen',
  'nausea': 'feeling like you might throw up',
  'emesis': 'throwing up',
  'syncope': 'fainting',
  'dyspnea': 'trouble breathing',
  'febrile': 'having a fever',
  'afebrile': 'no fever',
  'tachycardia': 'fast heartbeat',
  'bradycardia': 'slow heartbeat',
  'hypertension': 'high blood pressure',
  'hypotension': 'low blood pressure',
  'hypoglycemia': 'low blood sugar',
  'hyperglycemia': 'high blood sugar',
  'contusion': 'bruise',
  'laceration': 'deep cut',
  'fracture': 'broken bone',
  'sprain': 'stretched or torn ligament',
  'malaise': 'feeling unwell',
  'lethargic': 'very tired and slow',
  // Conditions
  'appendicitis': 'a swollen appendix (a small part of your gut)',
  'appendix': 'appendix (a small part of your gut)',
  'gastroenteritis': 'a stomach bug',
  'uti': 'bladder infection',
  'urinary tract infection': 'bladder infection',
  'pneumonia': 'a lung infection',
  'migraine': 'a very bad headache',
  'idiopathic': 'with no known cause',
  'benign': 'not dangerous',
  'malignant': 'cancer',
  'acute': 'sudden',
  'chronic': 'long-lasting',
  'asymptomatic': 'without symptoms',
  'comorbidity': 'another health condition',
  'prognosis': 'what we expect will happen',
  'diagnosis': 'what is wrong',
  'differential': 'list of possible causes',
  // Tests and procedures
  'abdominal ultrasound': 'image of your belly made with sound waves',
  'ultrasound': 'image made with sound waves',
  'ct scan': 'detailed X-ray scan',
  'ct': 'detailed X-ray scan',
  'mri': 'detailed body scan using magnets',
  'x-ray': 'picture of the inside of your body',
  'imaging': 'scans or X-rays',
  'cbc': 'blood test',
  'complete blood count': 'blood test',
  'bloodwork': 'blood tests',
  'blood draw': 'taking a little blood',
  'labs': 'tests',
  'urinalysis': 'pee test',
  'urine sample': 'pee sample',
  'ekg': 'heart rhythm test',
  'ecg': 'heart rhythm test',
  'biopsy': 'taking a tiny piece to test',
  'iv': 'a small tube in your vein',
  'intravenous': 'through a vein',
  'catheter': 'thin tube',
  'sutures': 'stitches',
  'rule it out': 'make sure it isn’t that',
  'rule out': 'make sure it isn’t',
  // Medicines and orders
  'npo': 'nothing to eat or drink',
  'nothing by mouth': 'nothing to eat or drink',
  'prn': 'only when you need it',
  'bid': 'twice a day',
  'tid': 'three times a day',
  'qd': 'once a day',
  'analgesic': 'pain medicine',
  'nsaid': 'anti-swelling pain medicine',
  'antibiotic': 'medicine that kills germs',
  'antiemetic': 'medicine to stop throwing up',
  'sedation': 'medicine to help you relax or sleep',
  'contraindicated': 'not safe for you',
  'adverse reaction': 'bad reaction',
  'side effects': 'unwanted effects',
  'prescription': 'medicine order',
  'referral': 'sending you to another doctor',
  'outpatient': 'without staying overnight',
  'inpatient': 'staying in the hospital',
  'admit': 'keep you in the hospital',
  'discharge': 'let you go home',
  'follow-up': 'next appointment',
  'triage': 'check how urgent it is',
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const ENTRIES = Object.entries(DICTIONARY).map(([term, plain]) => ({ term, plain }))

// Terms present in text: extra (from Claude) take priority over the dictionary.
export function findTerms(text, extra = []) {
  const found = []
  const seen = new Set()
  for (const t of [...extra, ...ENTRIES]) {
    const key = t.term?.toLowerCase()
    if (!key || seen.has(key) || !t.plain) continue
    if (new RegExp(`(^|[^\\w-])${escape(t.term)}(?=$|[^\\w-])`, 'i').test(text)) {
      found.push({ term: t.term, plain: t.plain })
      seen.add(key)
    }
  }
  return found
}

// Split text into plain and jargon segments. Longest term wins on overlap.
export function decode(text, terms = []) {
  if (!text) return []
  if (!terms?.length) return [{ text }]
  const sorted = [...terms].sort((a, b) => b.term.length - a.term.length)
  const re = new RegExp(`(^|[^\\w-])(${sorted.map((t) => escape(t.term)).join('|')})(?=$|[^\\w-])`, 'gi')
  const segments = []
  let last = 0
  for (const m of text.matchAll(re)) {
    const start = m.index + m[1].length
    if (start > last) segments.push({ text: text.slice(last, start) })
    const t = sorted.find((x) => x.term.toLowerCase() === m[2].toLowerCase())
    segments.push({ term: m[2], plain: t.plain })
    last = start + m[2].length
  }
  if (last < text.length) segments.push({ text: text.slice(last) })
  return segments
}

// Plain-language version for screen readers: "belly (medical term: abdomen)".
export function plainText(text, terms) {
  return decode(text, terms)
    .map((s) => (s.term ? `${s.plain} (medical term: ${s.term})` : s.text))
    .join('')
}

// Plain-language version with jargon swapped out entirely (offline "simpler").
export function swapText(text, terms) {
  return decode(text, terms)
    .map((s) => (s.term ? s.plain : s.text))
    .join('')
}

export function countTerms(text, terms) {
  return decode(text, terms).filter((s) => s.term).length
}
