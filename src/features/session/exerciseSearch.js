// This task, req #7: shared match predicate for every exercise search/picker
// (Add More, Type D swap, Auxiliary assignment) -- matches on name,
// abbreviation, body section, or muscle group so a coach can find "leg
// press" style candidates by region/muscle, not just by exact name.
// body_section/muscle_group come from the exercises table (0008_alter_
// exercises_add_taxonomy.sql) via useSessionCore's exerciseCatalog query.
export function matchesExerciseQuery(exercise, query) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    exercise.name.toLowerCase().includes(q) ||
    exercise.abbreviation.toLowerCase().includes(q) ||
    (exercise.body_section ?? '').toLowerCase().includes(q) ||
    (exercise.muscle_group ?? '').toLowerCase().includes(q)
  )
}
