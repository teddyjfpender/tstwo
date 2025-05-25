
export interface GrindOps<C> {
  grind(channel: C, powBits: number): number;
}

