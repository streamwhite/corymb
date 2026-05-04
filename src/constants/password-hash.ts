export const PASSWORD_HASH_ALGORITHM = "bcrypt" as const;

export function bcryptHashOptions(cost: number) {
  return {
    algorithm: PASSWORD_HASH_ALGORITHM,
    cost,
  } as const;
}
