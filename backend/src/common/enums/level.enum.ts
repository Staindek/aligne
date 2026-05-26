export enum ClassLevel {
  PRINCIPIANTE = 'principiante',
  INTERMEDIO = 'intermedio',
  AVANZADO = 'avanzado',
  ABIERTO = 'abierto',
}

const LEVEL_RANK: Record<ClassLevel, number> = {
  [ClassLevel.PRINCIPIANTE]: 1,
  [ClassLevel.INTERMEDIO]: 2,
  [ClassLevel.AVANZADO]: 3,
  [ClassLevel.ABIERTO]: 0,
};

/**
 * Una alumna puede tomar una clase si:
 * - La clase es ABIERTO (cualquiera)
 * - Su nivel es >= al nivel de la clase
 */
export function canTakeLevel(
  userLevel: ClassLevel,
  classLevel: ClassLevel,
): boolean {
  if (classLevel === ClassLevel.ABIERTO) return true;
  if (userLevel === ClassLevel.ABIERTO) return true;
  return LEVEL_RANK[userLevel] >= LEVEL_RANK[classLevel];
}
