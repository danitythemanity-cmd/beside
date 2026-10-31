// Static product data: communication profiles, accommodations, card prompts,
// phrase board, pain options, and the fictional sample patient. No real people.

export const MODES = [
  { id: 'nonverbal', label: 'Nonverbal or uses AAC', short: 'Nonverbal', icon: 'MessageCircle' },
  { id: 'autistic', label: 'Autistic', short: 'Autistic', icon: 'Sparkles' },
  { id: 'deaf', label: 'Deaf or hard of hearing', short: 'Deaf / HoH', icon: 'Ear' },
  { id: 'speech', label: 'Speech disability', short: 'Speech', icon: 'Languages' },
  { id: 'cognitive', label: 'Cognitive or learning disability', short: 'Cognitive', icon: 'Brain' },
  { id: 'other', label: 'Something else', short: 'Other', icon: 'Accessibility' },
]

// Every accommodation Beside knows how to request and track.
export const ACCOMMODATIONS = {
  direct: { need: 'Speak to me directly', detail: 'Talk to me, not the person with me.' },
  time: { need: 'Give me time to answer', detail: 'I may need 10 seconds or more to reply.' },
  warn: { need: 'Warn me before touching', detail: 'Tell me what you will do, then count down.' },
  written: { need: 'Written next steps', detail: 'Give me the plan in writing, in plain words.' },
  quiet: { need: 'Quiet room, machines muted', detail: 'Noise and beeping overwhelm me.' },
  lights: { need: 'Dimmer lights', detail: 'Bright lights are painful for me.' },
  plain: { need: 'Plain language', detail: 'Short sentences. No medical jargon.' },
  captions: { need: 'Captions or written words', detail: 'I read what is said.' },
  face: { need: 'Face me when you speak', detail: 'I lip-read and watch your face.' },
  interpreter: { need: 'Sign language interpreter', detail: 'I use ASL.' },
  yesno: { need: 'Ask yes or no questions', detail: 'Questions I can answer with one tap help most.' },
  breaks: { need: 'Breaks when I ask', detail: 'I may need a short pause.' },
}

// Suggested accommodations for each communication profile (used in onboarding).
export const MODE_SUGGESTIONS = {
  nonverbal: ['direct', 'time', 'yesno'],
  autistic: ['warn', 'quiet', 'lights', 'direct'],
  deaf: ['captions', 'face', 'interpreter'],
  speech: ['time', 'yesno', 'direct'],
  cognitive: ['plain', 'written', 'time'],
  other: ['written'],
}

// The four "This is me" prompts, with tap-to-add suggestions for onboarding.
export const CARD_SECTIONS = [
  {
    id: 'communicate',
    title: 'How I communicate',
    prompt: 'How do you talk and understand best?',
    suggestions: [
      'I don’t speak out loud, but I understand everything you say.',
      'I answer by tapping my phone.',
      'Give me ten seconds. I’m not ignoring you.',
      'I read lips. Please face me.',
      'Please use short sentences.',
    ],
  },
  {
    id: 'overwhelm',
    title: 'What overwhelms me',
    prompt: 'What makes a visit hard for you?',
    suggestions: [
      'Bright lights.',
      'Beeping machines.',
      'Being touched without warning.',
      'Several people talking at once.',
      'Being rushed.',
    ],
  },
  {
    id: 'pain',
    title: 'How pain shows up for me',
    prompt: 'How can staff tell you are hurting?',
    suggestions: [
      'I go very still and quiet.',
      'I might rock or press my hands together.',
      'A calm face does not mean I’m fine.',
      'I may laugh or smile when I’m in pain.',
    ],
  },
  {
    id: 'needs',
    title: 'What I need from you',
    prompt: 'What helps you most?',
    suggestions: [
      'Talk to me, not my companion.',
      'Warn me before you touch me.',
      'Write down the next steps.',
      'A quiet room if you have one.',
    ],
  },
]

// Phrase board, AAC style. `accom` links a phrase to an accommodation request.
export const BOARD = [
  { id: 'yes', label: 'Yes', say: 'Yes.', tone: 'yes' },
  { id: 'no', label: 'No', say: 'No.', tone: 'no' },
  { id: 'wait', label: 'Wait, please', say: 'Please wait. I’m thinking.', accom: 'time' },
  { id: 'stop', label: 'Stop', say: 'Stop, please.', tone: 'no' },
  { id: 'repeat', label: 'Say it again', say: 'Can you say that again?' },
  { id: 'unsure', label: 'I don’t know', say: 'I don’t know.' },
  { id: 'pain', label: 'It hurts', say: 'It hurts.' },
  { id: 'scared', label: 'I’m scared', say: 'I’m scared.' },
  { id: 'break', label: 'I need a break', say: 'I need a short break, please.', accom: 'breaks' },
  { id: 'lights', label: 'Too bright', say: 'The lights are too bright for me.', accom: 'lights' },
  { id: 'loud', label: 'Too loud', say: 'It’s too loud in here for me.', accom: 'quiet' },
  { id: 'bathroom', label: 'Bathroom', say: 'I need the bathroom.' },
  { id: 'water', label: 'Water', say: 'Can I have some water?' },
  { id: 'help', label: 'I need help', say: 'I need help, please.' },
  { id: 'thanks', label: 'Thank you', say: 'Thank you.' },
]

export const REGIONS = {
  head: { label: 'Head', clinical: 'head' },
  chest: { label: 'Chest', clinical: 'chest' },
  upper: { label: 'Upper belly', clinical: 'epigastric region' },
  rlq: { label: 'Lower right belly', clinical: 'right lower quadrant (RLQ)' },
  llq: { label: 'Lower left belly', clinical: 'left lower quadrant (LLQ)' },
  back: { label: 'Back', clinical: 'back' },
  arms: { label: 'Arms', clinical: 'upper extremities' },
  legs: { label: 'Legs', clinical: 'lower extremities' },
}
export const QUALITIES = ['Sharp', 'Dull', 'Burning', 'Throbbing', 'Cramping', 'Worse when I move']
export const SEVERITIES = [
  { value: 2, label: 'A little' },
  { value: 5, label: 'Medium' },
  { value: 7, label: 'Bad' },
  { value: 10, label: 'Worst ever' },
]
export const DURATIONS = ['Today', '1–2 days', '3 days', 'A week or more']

export const SAMPLE_PROFILE = {
  id: 'sample-sam',
  name: 'Sam',
  fullName: 'Sam Rivera',
  pronouns: 'they/them',
  age: 24,
  modes: ['nonverbal', 'autistic'],
  companion: { name: 'Ana', relation: 'Mom' },
  card: {
    communicate: 'I don’t speak out loud, but I understand everything you say. I answer by tapping my phone. Give me ten seconds. I’m not ignoring you.',
    overwhelm: 'Bright lights, beeping machines, being touched without warning, and several people talking at once.',
    pain: 'I go very still and quiet. I might rock or press my hands together. A calm face does not mean I’m fine.',
    needs: 'Talk to me, not my mom. Warn me before you touch me. Write down the next steps. A quiet room if you have one.',
  },
  accommodations: ['direct', 'warn', 'written', 'quiet'],
  voice: { rate: 1, voiceURI: null },
  sample: true,
}

export const SAMPLE_CLINICIAN = { name: 'Dr. Okafor', role: 'Urgent care physician' }

export function cardSections(profile) {
  return CARD_SECTIONS.map((s) => ({ ...s, body: profile?.card?.[s.id] ?? '' })).filter((s) => s.body.trim())
}
