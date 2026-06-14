// Achievements system removed.
export const achievementService = {
  async evaluate(_userId: string, _poolId: string): Promise<void> {},
  async forUser(_userId: string) {
    return [];
  },
};
