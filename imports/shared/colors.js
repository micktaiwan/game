export function colorForGoal(goal) {
  if (goal === 'harvest') return 0xffd166; // amber
  if (goal === 'explore') return 0xbc66ff; // violet
  if (goal === 'defend') return 0x2da8ff; // blue
  if (goal === 'attack') return 0xff4d4d; // red
  return 0x32d296; // green idle/default
}


