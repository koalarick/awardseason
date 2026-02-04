declare module 'canvas-confetti' {
  export interface Options {
    angle?: number;
    spread?: number;
    startVelocity?: number;
    decay?: number;
    gravity?: number;
    ticks?: number;
    origin?: { x?: number; y?: number };
    colors?: string[];
    zIndex?: number;
    particleCount?: number;
    scalar?: number;
  }

  export interface GlobalOptions {
    resize?: boolean;
    useWorker?: boolean;
  }

  export interface CreateConfetti {
    (options?: Options): Promise<null>;
    reset?: () => void;
  }

  export interface Confetti {
    (options?: Options): Promise<null>;
    create: (canvas: HTMLCanvasElement, options?: GlobalOptions) => CreateConfetti;
    reset?: () => void;
  }

  const confetti: Confetti;
  export default confetti;
}
