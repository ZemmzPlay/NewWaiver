/**
 * English copy. This object is the shape every other locale must match — `ar.ts`
 * is typed against it, so a missing Arabic string is a compile error rather
 * than an English word appearing in the middle of an Arabic sentence.
 *
 * Voice, from the design system's CONTENT FUNDAMENTALS: loud, warm, inviting.
 * Short imperative sentences. Display lines in caps. Excitement comes from the
 * size and colour of the type, not from exclamation marks in body copy.
 */
export const en = {
  // Locale and direction are derived from the locale itself in index.ts, so the
  // dictionary only carries what has to be written by a human.
  meta: {
    name: 'English',
    /** Shown on the toggle: the language it switches *to*, in that language. */
    switchTo: 'العربية',
  },

  common: {
    back: 'Back',
    next: 'Next',
    cancel: 'Cancel',
    tryAgain: 'Try again',
    optional: 'Optional',
    minutes: 'minutes',
    min: 'MIN',
    code: 'Code',
    mobile: 'Mobile',
    email: 'Email',
    loading: 'One moment…',
    /**
     * "Layla", "Layla and Omar", "Layla, Omar and Nur".
     *
     * A language owns its own conjunction. Arabic joins with waw, which attaches
     * to the following word with no space, and separates with an Arabic comma —
     * neither of which a shared helper could know.
     */
    joinNames: (names: string[]): string => {
      if (names.length <= 1) return names[0] ?? '';
      return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
    },
  },

  steps: {
    of: (current: number, total: number) => `Step ${current} of ${total}`,
    package: 'Pick a package',
    waiver: 'Read the waiver',
    guardian: 'Your details',
    children: 'Your children',
    consent: 'Sign',
  },

  footer: {
    privacy:
      'Zawaya is the data controller for the details you give us. Children’s data is deleted 30 days after the event. Full notice in the waiver.',
  },

  landing: {
    title: 'PLAY ZONES',
    softPlay: 'Soft Play',
    bouncyCastles: 'Bouncy Castles',
    zoneNote: {
      accompanied: 'You stay with your child',
      drop_off: 'You may leave — we’ll email you',
    },
    takesAbout: 'Takes about a minute.',
    alreadyRegistered: 'Been here already?',
    alreadyRegisteredBody:
      'Get your code sent to your phone number and open your page again.',
    findMyCode: 'Find my code',
    ticker: ['SOCKS ON', 'NO SHOES', 'NO COSTUME PROPS', 'STAY CONTACTABLE'],
  },

  packageStep: {
    heading: 'Pick a package',
    help: 'You can change the zone or the length for each child in a moment.',
  },

  waiverStep: {
    version: (n: number) => `Version ${n}`,
    readToEnd: 'Read it to the end. The button unlocks when you reach the bottom.',
    keepScrolling: 'Keep scrolling to the end of the waiver.',
    accept: 'I have read this',
  },

  guardianStep: {
    heading: 'Your details',
    help: 'We only use these during the event, and to reach you if your child’s time is nearly up.',
    fullName: 'Your full name',
    fullNameError: 'Enter your full name.',
    relation: 'You are the child’s',
    relationError: 'Pick one.',
    relationOther: 'How are you related?',
    relationOtherError: 'Tell us how you are related.',
    relations: {
      mother: 'Mother',
      father: 'Father',
      guardian: 'Legal guardian',
      other: 'Other',
    },
    mobile: 'Mobile',
    mobilePlaceholder: '050 123 4567',
    mobileHint: 'UAE numbers can be typed as 050 123 4567.',
    mobileSaved: (e164: string) => `We will save this as ${e164}. Staff may call you; we do not text.`,
    mobileError: 'That doesn’t look like a mobile number.',
    mobileMissing: 'Enter your mobile number.',
    email: 'Email',
    emailHint: 'This is where the 5-minute warning goes, so check it carefully.',
    emailError: 'That doesn’t look like an email address.',
    emailMissing: 'Enter your email address.',
    didYouMean: 'Did you mean',
    useIt: 'Use it',
    next: 'Next — your children',
  },

  childrenStep: {
    heading: 'Your children',
    help: 'Add everyone going in. You can change a zone or a length for each child.',
    child: (n: number) => `Child ${n}`,
    remove: 'Remove',
    childName: 'Child’s name',
    age: 'Age',
    ageHint: 'Tap their age in years.',
    zoneAndLength: 'Zone and length',
    addNote: 'Add a medical note',
    note: 'Anything we should know',
    notePlaceholder: 'Allergies, asthma, a recent injury, anything relevant to their safety.',
    noteHint: 'Shown to the counter staff in red. Deleted 30 days after the event.',
    addChild: 'Add another child',
    next: 'Next — sign',
    supervision: {
      accompanied: 'You stay inside the zone with your child for the whole session.',
      drop_off:
        'You may leave the zone. Stay on site, keep your phone with you, and come back before the end time.',
    },
  },

  consentStep: {
    heading: 'Sign',
    help: 'We record which version of the waiver you accepted, and when.',
    agree: (v: number) => `I have read and agree to the waiver (version ${v})`,
    agreeDetail:
      'Including the supervision rules, the health declaration, and permission for emergency first aid.',
    agreeError: 'You need to accept the waiver to continue.',
    signature: 'Your name, as your signature',
    signatureError: 'Enter the name you are signing with.',
    editEmail: 'Change',
    photoNoticeTitle: 'We take photos in the zones',
    photoNoticeBody:
      'Our team photographs and films the play zones for Carnival’s own marketing, and your child may appear. If you would rather they did not, tell a staff member at the counter and we will keep them out of shot.',
    marketing: 'Email me when Carnival is in town',
    marketingDetail: 'Events only. Unsubscribe from any message.',
    submit: 'Get my code',
    submitting: 'Sending…',
  },

  status: {
    registered: (name: string) => `You are registered, ${name}`,
    added: 'Added to your family',
    yourCode: 'Your code',
    showAtCounter:
      'Show this at the counter. A staff member will start the clock and print a sticker for each child.',
    doThisNow: 'Do this now',
    keepOpen: 'Keep this page open.',
    keepOpenBody:
      'It counts down for each child and it is faster than email in a loud hall. We have also emailed you this link.',
    screenshotIt: 'Screenshot this page.',
    screenshotBody:
      'If your battery dies or the signal drops, the picture still has your code on it.',
    notStarted: 'Not started yet',
    clockStarts: 'The clock starts when you reach the counter.',
    collected: 'Finished and collected.',
    finishesAt: 'Finishes at',
    timeWasUp: (time: string, zone: string) =>
      `Time was up at ${time}. Please come back to the ${zone} counter now.`,
    ruleNotice:
      'No child leaves a zone without their adult. In the Bouncy Castles you will be asked for this code before your child is released.',
  },

  find: {
    heading: 'Open your page',
    help: 'Enter the mobile number you registered with. We’ll email you a 6-digit code.',
    mobile: 'Mobile number',
    sendCode: 'Send me a code',
    sending: 'Sending…',
    codeHeading: 'Check your email',
    codeHelp: (hint: string) => `We sent a 6-digit code to ${hint}. It works for 10 minutes.`,
    otpLabel: 'The 6-digit code',
    verify: 'Open my page',
    verifying: 'Checking…',
    resend: 'Send it again',
    resent: 'Sent. Check your inbox and your spam folder.',
    useCode: 'I have my registration code',
    codeEntry: 'Registration code',
    codeEntryHint: 'Six digits, from your email or your child’s sticker.',
    openPage: 'Open my page',
    notFound: 'We could not find that mobile number. Ask a staff member at either counter.',
    badOtp: 'That code is not right, or it has expired. Send a new one.',
    tooMany: 'Too many tries. Wait a minute and start again.',
    codeError: 'That code is six digits, like 482 109.',
  },

  counter: {
    /** The line the staffer reads aloud. PRD s4. */
    greeting: (guardian: string, children: string) => `Welcome ${guardian} — and hello ${children}!`,
    greetingNoChildren: (guardian: string) => `Welcome ${guardian}`,
    endShift: 'End shift',
    overview: 'Overview',
    overviewTitle: 'THE WHOLE FLOOR',
    readOnly: 'Read-only',
    supervisorsOnly: 'Supervisors only',
    supervisorsOnlyBody: 'Sign in with a supervisor PIN to see both zones at once.',
    inZone: (n: number) => `${n} inside`,
    ofCapacity: (n: number, cap: number) => `${n} of ${cap}`,
    overdueHere: (n: number) => `${n} overdue`,
    nobodyInZone: 'Empty',
    totalRegisteredToday: 'Registered today',
    totalChildrenToday: 'Children today',
    totalInside: 'Inside now',
    totalOverdue: 'Overdue now',
    totalCheckedOut: 'Collected today',
    emailProblems: 'Email did not arrive',
    emailProblemsBody: 'These families will not get the 5-minute warning. Correct the address at the counter.',
    emailProblemsNone: 'Every address we have tried has been accepted.',
    liveChildren: (n: number) => `${n} inside now`,
    updated: 'Updates every 10 seconds',
    console: 'Counter console',
    signedIn: (role: string) => `Signed in · ${role}`,
    checkIn: 'Check in',
    board: 'Zone board',
    pickup: 'Pickup queue',
    clear: 'Clear',
    go: 'Go',
    pinRejected: 'That PIN was not recognised.',
    findFamily: 'Find a family',
    findPlaceholder: 'Name, mobile, or code',
    findHint: 'Type any part of a name, the mobile number, or the six-digit code.',
    searching: 'Searching…',
    noMatch: 'Nothing matched. Try their mobile number, or the code on their phone.',
    searchAgain: '← Search again',
    insideNow: (n: number) => `${n} inside now`,
    relation: 'Relation',
    waiverSigned: (v: number) => `Waiver v${v} signed`,
    noWaiver: 'No waiver on file',
    emailStatus: (s: string) => `Email ${s}`,
    noConsent:
      'No consent on file against the current waiver. Do not start a session — send them back to the QR.',
    emailFailedTitle: 'Their email did not arrive.',
    emailFailedBody:
      'Read the address back to them now. The 5-minute warning will not reach them until it is fixed — tell them to keep their live page open.',
    alreadyInside: (name: string, zone: string, time: string) =>
      `${name} is already inside ${zone} until ${time}.`,
    whoIsGoingIn: 'Who is going in?',
    age: (n: number) => `Age ${n}`,
    picked: (zone: string) => `Picked ${zone}`,
    medicalNote: 'Medical note',
    stubRef: 'Ticket stub reference (optional)',
    stubPlaceholder: 'From the POS receipt',
    start: (n: number) => `Start & print — ${n} ${n === 1 ? 'child' : 'children'}`,
    starting: 'Starting…',
    sayThis: 'Say this out loud',
    backAt: 'BACK AT',
    script: (names: string, time: string) =>
      `“${names} at ${time}. It is printed on the sticker, and you will get an email five minutes before.”`,
    scriptDropOff: '“Keep your code with you — we ask for it before we hand your child back.”',
    scriptAccompanied: '“Please stay inside the zone with them.”',
    printedBrowser: 'The label printer did not answer, so the sticker opened in a print dialog instead.',
    printedFailed: (time: string) =>
      `No sticker printed. Write the name, the zone and ${time} on a blank sticker — the timer and the emails are running either way.`,
    nextFamily: 'Next family',
    nobodyInside: 'Nobody is inside right now.',
    inside: (n: number) => `${n} inside`,
    checkOut: 'Check out',
    checkOutConfirmTitle: 'Check out this child?',
    checkOutConfirmBody: (name: string) => `${name} will be marked as picked up.`,
    confirmCheckOut: 'Yes, check out',
    release: 'Release…',
    releasing: 'Releasing',
    registeredTo: (name: string) => `Registered to ${name}.`,
    releaseWarning: 'No child leaves without their adult. Ask for the code before you hand them over.',
    codeCheck: 'Registration code',
    wrongCode: 'That is not this family’s code.',
    someoneElse: 'Someone else is collecting',
    itIsGuardian: 'It is the guardian',
    whoCollecting: 'Who is collecting?',
    whoCollectingPlaceholder: 'Full name, as they give it',
    supervisorPin: 'Supervisor PIN',
    confirmRelease: 'Confirm release',
    confirming: 'Confirming…',
    pickupQueue: 'PICKUP QUEUE',
    waiting: (n: number) => `${n} waiting`,
    nobodyWaiting: 'NOBODY WAITING',
    nobodyWaitingBody: 'Every child is either inside on time, or collected.',
    hoursOver: 'hours over · out',
    minutesOver: 'minutes over · out',
    attempts: (n: number) => `${n} ${n === 1 ? 'attempt' : 'attempts'}`,
    escalate: 'Escalate now.',
    escalateAttempts: (n: number) => `${n} attempts and no answer.`,
    escalateMinutes: (n: number) => `${n} minutes overdue.`,
    escalateAction: 'Tell the supervisor and start ADNEC’s lost-child procedure.',
    call: (name: string) => `Call ${name}`,
    logAttempt: 'Log the attempt',
    collected: 'Collected',
    howDidCallGo: 'How did the call go?',
    onTheWay: 'On their way',
    answered: 'Answered',
    noAnswer: 'No answer',
    printAgain: 'Print again',
    nothingToPrint: 'Nothing to print.',

    staffAdmin: 'Staff accounts',
    staffAdminTitle: 'STAFF ACCOUNTS',
    addStaff: 'Add a staff account',
    fullNameField: 'Full name',
    pinField: 'PIN',
    pinHint: '4 to 8 digits, whatever they will remember at 8am.',
    roleField: 'Role',
    zoneField: 'Zone (optional)',
    noZone: 'No zone',
    roleStaffer: 'Staffer',
    rolePickup: 'Pickup marshal',
    roleSupervisor: 'Supervisor',
    roleAdmin: 'Admin',
    createAccount: 'Create account',
    creatingAccount: 'Creating…',
    accountCreated: (name: string) => `${name}’s account is ready.`,
    resetPin: 'Reset PIN',
    newPinField: 'New PIN',
    confirmResetPin: 'Set new PIN',
    pinResetDone: 'PIN reset.',
    deactivate: 'Deactivate',
    reactivate: 'Reactivate',
    activeLabel: 'Active',
    inactiveLabel: 'Inactive',
    noStaffYet: 'No staff accounts yet.',
  },

  errors: {
    generic: 'We could not save that. Try again, and if it keeps happening ask a staff member.',
    validation: 'Some of the details need another look. Go back and check the highlighted fields.',
    waiverSuperseded:
      'The waiver was updated while you were reading. Please reload the page and accept the new version.',
    unknownPackage: 'That zone or length is no longer available. Please go back and pick another.',
  },
};

/**
 * `en` is written without `as const` on purpose: the dictionary type has to be
 * `string`, not the literal English words, or `ar.ts` could never satisfy it.
 */
export type Dictionary = typeof en;
