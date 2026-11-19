// Plays the reminder ringtone on a loop. The background worker creates this
// hidden document when a task is due and closes it to stop the sound.
const tone = new Audio("sounds/ring.wav");
tone.loop = true;
tone.play().catch(() => {});
